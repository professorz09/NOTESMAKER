/**
 * Sanitizes AI-generated HTML to prevent XSS.
 * Removes script tags, dangerous event handlers, and javascript: URLs.
 * Preserves all structural HTML (tables, SVG, lists, headings, etc.)
 */

const DANGEROUS_ATTR_RE = /^on[a-z]+$/i;
const DANGEROUS_PROTO_RE = /^\s*(javascript|vbscript|data:text\/html)/i;

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
    });

    return root.innerHTML;
  } catch {
    // If DOMParser fails (SSR or unusual env) return the regex-cleaned version
    return clean;
  }
}
