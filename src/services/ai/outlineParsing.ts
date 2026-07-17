// Shared "structured outline" JSON parser used by every leveled pipeline
// (topic, deep, transcript, text, file). The model is asked to return
// { sections: [{ heading, subheadings }] } (optionally with extra top-level
// fields like title/overview/focusAreas that callers extract themselves) —
// this tolerantly extracts just the sections array even if the model wraps
// it in commentary or markdown fences.

export interface OutlineSection {
  heading: string;
  subheadings: string[];
}

// Finds the FIRST top-level JSON object in `text` by tracking brace depth
// (correctly skipping braces that appear inside quoted strings, including
// escaped quotes) rather than naively slicing from the first `{` to the
// LAST `}` in the whole text. That naive approach breaks whenever the model
// adds any trailing prose after the JSON — which happens far more often
// once Google Search grounding is active, since a grounded answer tends to
// add citations/explanatory text ("...as of 2024 {approx.}") whose own
// stray braces used to get swallowed into (and corrupt) the "JSON".
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // unbalanced — truncated response, let the caller's try/catch handle it
}

export function parseOutlineSectionsJson(raw: string): OutlineSection[] {
  if (!raw) return [];
  const text = raw.trim()
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');
  const jsonText = extractFirstJsonObject(text);
  if (!jsonText) return [];
  try {
    const obj = JSON.parse(jsonText);
    if (!Array.isArray(obj.sections)) return [];
    return obj.sections
      .map((s: any) => ({
        heading: String(s?.heading || s?.title || '').trim(),
        subheadings: Array.isArray(s?.subheadings)
          ? s.subheadings.map((x: any) => String(x || '').trim()).filter(Boolean)
          : [],
      }))
      .filter((s: OutlineSection) => s.heading);
  } catch {
    return [];
  }
}

/** Parse the raw JSON text once and return the whole object (or null),
 *  for callers that also need top-level fields like title/overview. */
export function parseOutlineJsonObject(raw: string): any | null {
  if (!raw) return null;
  const text = raw.trim()
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');
  const jsonText = extractFirstJsonObject(text);
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}
