/**
 * Sanitizes AI-generated HTML to prevent XSS and style leaks.
 * Removes script tags, dangerous event handlers, and javascript: URLs.
 * Neutralizes global CSS leaks from generated <style> blocks.
 * Preserves all structural HTML (tables, SVG, lists, headings, etc.)
 */

const DANGEROUS_ATTR_RE = /^on[a-z]+$/i;
const DANGEROUS_PROTO_RE = /^(javascript|vbscript|data:text\/html|data:application\/xhtml|data:image\/svg)/i;
// Browsers ignore tabs/newlines/control chars inside a URL scheme, so
// `java&#9;script:` still runs — compare against the value with them gone.
// (data:image/svg is blocked for links/frames only: as an <img> source it
// can't run script and is a legitimate diagram format, see isUrlAttrUnsafe.)
// eslint-disable-next-line no-control-regex
const URL_NOISE_RE = /[\u0000-\u0020\u007f-\u009f]+/g;
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster', 'background', 'codebase', 'srcset']);

function isUrlAttrUnsafe(el: Element, name: string, value: string): boolean {
  const v = value.replace(URL_NOISE_RE, '');
  if (!DANGEROUS_PROTO_RE.test(v)) return false;
  // An SVG data URI rendered as an image is inert.
  const tag = el.tagName.toLowerCase();
  if (/^data:image\/svg/i.test(v) && name === 'src' && (tag === 'img' || tag === 'source')) return false;
  return true;
}

// Elements that embed/execute foreign content. Stripped at the DOM level as
// well — the regex pass above is defeated by `</script >` and friends, and
// the print window renders through document.write, which DOES run scripts.
const BLOCKED_ELEMENTS = 'script, iframe, frame, frameset, object, embed, applet, portal, noscript';

/** Remove at-rules (other than @keyframes) from CSS — scopeCss can't scope
 * the selectors nested inside @media/@supports, and @import pulls in
 * arbitrary global CSS. */
function stripAtRules(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@', i);
    if (at === -1) { out += css.slice(i); break; }
    out += css.slice(i, at);
    const name = (/^@([\w-]+)/.exec(css.slice(at)) || [])[1]?.toLowerCase() || '';
    const brace = css.indexOf('{', at);
    const semi = css.indexOf(';', at);
    if (semi !== -1 && (brace === -1 || semi < brace)) { i = semi + 1; continue; } // @import …;
    if (brace === -1) break;
    let depth = 0, j = brace;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}' && --depth === 0) break;
    }
    if (/keyframes$/.test(name)) out += css.slice(at, j + 1);
    i = j + 1;
  }
  return out;
}

let svgScopeSeq = 0;

/**
 * Naively scope CSS so its rules can only match elements inside `scope`.
 * Prefixes every selector group with the scope id. Handles the flat
 * `.cls { … } text { … }` CSS the model emits inside SVG diagrams;
 * at-rules (@media/@keyframes) are left as-is (rare in generated SVGs).
 */
function scopeCss(css: string, scope: string): string {
  const keyframes: string[] = [];
  return stripAtRules(css.replace(/\/\*[\s\S]*?\*\//g, ''))
    // Keep @keyframes bodies (`from {` / `50% {`) out of the selector scoping.
    .replace(/@[\w-]*keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, m => { keyframes.push(m); return `\u0000${keyframes.length - 1}\u0000`; })
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
    })
    .replace(/\u0000(\d+)\u0000/g, (_m, n) => keyframes[Number(n)]);
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
    root.querySelectorAll(BLOCKED_ELEMENTS).forEach(el => el.remove());
    // SVG animation can rewrite an attribute after sanitizing:
    // <animate attributeName="href" to="javascript:…"> on an <a>.
    root.querySelectorAll('animate, set, animateMotion, animateTransform, animateColor').forEach(el => {
      const target = (el.getAttribute('attributeName') || '').toLowerCase();
      if (/href|^on|style/.test(target) || target === 'src') el.remove();
    });
    // <use> pointing outside the document can pull in script-bearing SVG.
    root.querySelectorAll('use').forEach(el => {
      for (const n of ['href', 'xlink:href']) {
        const v = el.getAttribute(n);
        if (v && !v.trim().startsWith('#')) el.removeAttribute(n);
      }
    });
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
        if (URL_ATTRS.has(attr.name.toLowerCase()) && isUrlAttrUnsafe(el, attr.name.toLowerCase(), attr.value)) {
          toRemove.push(attr.name);
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
