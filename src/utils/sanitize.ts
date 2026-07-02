/**
 * Sanitizes AI-generated HTML to prevent XSS and style leaks.
 * Removes script tags, dangerous event handlers, and javascript: URLs.
 * Neutralizes global CSS leaks from generated <style> blocks.
 * Preserves all structural HTML (tables, SVG, lists, headings, etc.)
 */

const DANGEROUS_ATTR_RE = /^on[a-z]+$/i;
const DANGEROUS_PROTO_RE = /^\s*(javascript|vbscript|data:text\/html)/i;

let svgScopeSeq = 0;

/**
 * Naively scope CSS so its rules can only match elements inside `scope`.
 * Prefixes every selector group with the scope id. Handles the flat
 * `.cls { … } text { … }` CSS the model emits inside SVG diagrams;
 * at-rules (@media/@keyframes) are left as-is (rare in generated SVGs).
 */
function scopeCss(css: string, scope: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\})\s*([^{}@]+)\s*\{/g, (_m, brace, selectors) => {
      const scoped = (selectors as string)
        .split(',')
        .map(s => {
          const sel = s.trim();
          if (!sel) return '';
          // `svg { … }` should target the scoped svg itself, not a descendant
          return sel === 'svg' ? scope : `${scope} ${sel}`;
        })
        .filter(Boolean)
        .join(', ');
      return `${brace}\n${scoped} {`;
    });
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // 1. Strip <script> blocks entirely (content included)
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Strip <iframe> blocks
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // 3. Strip CSS expression() and behavior: (IE XSS vectors) from inline style/style blocks
  clean = clean.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, body, close) =>
    open + body
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/behavior\s*:[^;;"']*/gi, '')
    + close
  );

  // 4. Use DOMParser to walk the tree and strip dangerous attributes
  try {
    const doc = new DOMParser().parseFromString(`<div id="__s">${clean}</div>`, 'text/html');
    const root = doc.getElementById('__s');
    if (!root) return clean;

    // Kill global CSS leaks. Generated HTML sometimes carries a <style>
    // block — most often inside an SVG diagram — whose selectors (text,
    // div, h2, body…) become DOCUMENT-GLOBAL once the HTML is inlined,
    // silently restyling the entire app UI. Scope styles inside an <svg>
    // to that svg; remove any other <style> outright.
    root.querySelectorAll('style').forEach(styleEl => {
      const svg = styleEl.closest('svg');
      if (!svg) { styleEl.remove(); return; }
      let id = svg.getAttribute('id');
      if (!id || !/^[A-Za-z][\w-]*$/.test(id)) {
        id = `nm-svg-${Date.now().toString(36)}${svgScopeSeq++}`;
        svg.setAttribute('id', id);
      }
      styleEl.textContent = scopeCss(styleEl.textContent || '', `#${id}`);
    });

    // Document-level elements that have no business inside note content
    // and can hijack the page (external stylesheets, base URL rewrites).
    root.querySelectorAll('link, meta, base').forEach(el => el.remove());
    root.querySelectorAll('title').forEach(el => { if (!el.closest('svg')) el.remove(); });

    root.querySelectorAll('*').forEach(el => {
      const toRemove: string[] = [];
      for (const attr of Array.from(el.attributes)) {
        // Remove all event handlers (onclick, onload, onerror, etc.)
        if (DANGEROUS_ATTR_RE.test(attr.name)) {
          toRemove.push(attr.name);
          continue;
        }
        // Remove javascript:/vbscript:/data:text/html links
        if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(attr.name.toLowerCase())) {
          if (DANGEROUS_PROTO_RE.test(attr.value)) toRemove.push(attr.name);
        }
        // Strip srcdoc on iframes (belt-and-suspenders; iframes already stripped above)
        if (attr.name.toLowerCase() === 'srcdoc') toRemove.push(attr.name);
      }
      toRemove.forEach(n => el.removeAttribute(n));

      // position:fixed/sticky in inline styles can escape the editor page
      // and overlay the app chrome — pin generated content in normal flow.
      const styleAttr = el.getAttribute('style');
      if (styleAttr && /position\s*:\s*(fixed|sticky)/i.test(styleAttr)) {
        el.setAttribute('style', styleAttr.replace(/position\s*:\s*(fixed|sticky)[^;"']*;?/gi, ''));
      }
    });

    return root.innerHTML;
  } catch {
    // If DOMParser fails (SSR or unusual env) return the regex-cleaned version
    return clean;
  }
}
