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

  // 3. Strip <style> blocks ENTIRELY. A note is rendered inline in the app
  //    DOM, so a generated <style> tag (e.g. with broad selectors like
  //    body{…} or div{…}) leaks globally and visually breaks the whole app —
  //    the classic "a note bugged the UI" failure. All legitimate note
  //    styling comes from app CSS classes + scoped inline styles, never a
  //    stylesheet, so removing these is safe.
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 4. Strip document-scaffolding / head tags the model sometimes emits when
  //    it returns a full HTML document instead of a fragment. <link>/<base>/
  //    <meta>/<title> have no place inside a note and can affect the page.
  clean = clean
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '')
    .replace(/<(?:link|base|meta)\b[^>]*>/gi, '')
    .replace(/<title\b[^<]*(?:(?!<\/title>)<[^<]*)*<\/title>/gi, '');

  // 5. Use DOMParser to walk the tree and strip dangerous attributes
  try {
    const doc = new DOMParser().parseFromString(`<div id="__s">${clean}</div>`, 'text/html');
    const root = doc.getElementById('__s');
    if (!root) return clean;

    // Drop any style/link/base/meta/script/iframe elements that slipped
    // through the regex pass (e.g. oddly nested) before reading attributes.
    root.querySelectorAll('style, link, base, meta, script, iframe').forEach(el => el.remove());

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
