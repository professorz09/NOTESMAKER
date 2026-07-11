import { createAIClient, NOTES_GEN_CONFIG } from './client';
import { parseOutlineJsonObject, type OutlineSection } from './outlineParsing';

// ---------------------------------------------------------------------------
// "Restructure the plan" pass, offered at the mind-map review step of every
// leveled pipeline. The outline shown for approval was extracted chunk by
// chunk (or in one shot for topic/files), so its headings are often uneven —
// vague labels, near-duplicates, points parked under the wrong heading. This
// pass rewrites the WHOLE outline into a cleaner structure with better,
// specific headings while preserving every single point: nothing may be
// dropped, only renamed, regrouped or merged when two entries are literally
// the same point.
// ---------------------------------------------------------------------------

const RULES = (language: string) => `
    **ABSOLUTE RULES — NOTHING MAY GO MISSING:**
    - Every heading and sub-point in the current outline must still be represented in your restructured outline. An entry may be renamed, promoted, demoted to a sub-point, or merged with an entry that is literally the SAME point — but its idea must never disappear.
    - Do NOT summarise several distinct points into one. Distinct points stay distinct entries.
    - Rewrite vague or generic headings into clear, specific, exam-ready ones that say exactly what the section covers.
    - Order sub-points logically under their heading. Split an overloaded heading into two where that genuinely reads better.
    - Language for all headings/sub-points: ${language}.
    - FINAL SELF-CHECK before answering: go through the ORIGINAL outline entry by entry and verify each one is still present (possibly renamed/moved) in your restructured outline. If anything is missing, add it back before you answer.
`;

function sanitizeSections(raw: any): OutlineSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => ({
      heading: String(s?.heading || s?.title || '').trim(),
      subheadings: Array.isArray(s?.subheadings)
        ? s.subheadings.map((x: any) => String(x || '').trim()).filter(Boolean)
        : [],
    }))
    .filter((s: OutlineSection) => s.heading);
}

const countPoints = (sections: OutlineSection[]) =>
  sections.reduce((a, s) => a + 1 + s.subheadings.length, 0);

/**
 * Restructure the outline of a CHUNKED pipeline (transcript / pasted text).
 * The outline arrives as one sections-array per source segment, and segment
 * boundaries must be preserved — each segment's improved outline is later
 * expanded against that segment's own source text, so a point may move
 * around WITHIN its segment but never into another one.
 *
 * Returns one improved sections-array per segment (same length as the
 * input). Throws if the model's answer is unusable, so the caller can keep
 * the original outline untouched.
 */
export const restructureOutlineChunks = async (
  chunkOutlines: OutlineSection[][],
  contextTitle: string,
  language: string,
  modelName: string,
): Promise<OutlineSection[][]> => {
  const ai = createAIClient();
  const n = chunkOutlines.length;

  const prompt = `
    Role: Master note-architect.
    Task: Below is the planned outline of study notes titled "${contextTitle}", built from source material that was processed in ${n} sequential segment(s). Restructure this outline so the final notes read like a well-organised book chapter: better headings, cleaner grouping, logical order.
    ${RULES(language)}
    - Segment boundaries are MECHANICAL and must be preserved: output exactly ${n} segment(s), in the same order, and never move a point from one segment to another (each segment is written from its own source text later). All improvements happen WITHIN a segment.

    Current outline (JSON):
    ${JSON.stringify({ segments: chunkOutlines.map(sections => ({ sections })) })}

    Output STRICT JSON ONLY (no markdown, no code fences), exactly ${n} segment(s):
    { "segments": [ { "sections": [ { "heading": "…", "subheadings": ["…"] } ] } ] }
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: NOTES_GEN_CONFIG,
  });

  const obj = parseOutlineJsonObject(response.text || '');
  const segments = obj?.segments ?? obj?.chunks;
  if (!Array.isArray(segments) || segments.length !== n) {
    throw new Error('Restructured outline came back in an unexpected shape.');
  }

  const result: OutlineSection[][] = segments.map((seg: any, i: number) => {
    const secs = sanitizeSections(seg?.sections);
    // Per-segment point-loss guard: a segment that came back empty, garbled,
    // or noticeably thinner than the original keeps its ORIGINAL outline —
    // restructuring may merge literal duplicates, but it must never shrink a
    // segment's real coverage. A rough original beats a lossy rewrite.
    if (!secs.length) return chunkOutlines[i];
    if (countPoints(secs) < Math.ceil(countPoints(chunkOutlines[i]) * 0.7)) return chunkOutlines[i];
    return secs;
  });

  return result;
};

/**
 * Restructure a FLAT outline (topic / uploaded-files pipelines) — same
 * guarantees, but sections may be freely reordered and regrouped since they
 * are all expanded against the same source. Throws if unusable.
 */
export const restructureOutlineSections = async (
  sections: OutlineSection[],
  contextTitle: string,
  language: string,
  modelName: string,
): Promise<OutlineSection[]> => {
  const ai = createAIClient();

  const prompt = `
    Role: Master note-architect.
    Task: Below is the planned outline of study notes titled "${contextTitle}". Restructure it so the final notes read like a well-organised book chapter: better headings, cleaner grouping, logical order (sections may be reordered where that genuinely reads better).
    ${RULES(language)}

    Current outline (JSON):
    ${JSON.stringify({ sections })}

    Output STRICT JSON ONLY (no markdown, no code fences):
    { "sections": [ { "heading": "…", "subheadings": ["…"] } ] }
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: NOTES_GEN_CONFIG,
  });

  const obj = parseOutlineJsonObject(response.text || '');
  const result = sanitizeSections(obj?.sections);
  if (!result.length) throw new Error('Restructured outline came back empty.');

  // Point-loss guard: if the result covers noticeably fewer points than the
  // original, the model has summarised — reject the answer rather than
  // silently losing content (the caller keeps the original outline).
  const before = countPoints(sections);
  const after = countPoints(result);
  if (after < Math.ceil(before * 0.7)) {
    throw new Error('Restructured outline dropped too many points — keeping the original.');
  }

  return result;
};
