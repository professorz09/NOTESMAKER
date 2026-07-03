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

export function parseOutlineSectionsJson(raw: string): OutlineSection[] {
  if (!raw) return [];
  let text = raw.trim()
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];
  text = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(text);
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
  let text = raw.trim()
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
