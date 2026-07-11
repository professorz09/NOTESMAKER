import { createAIClient, cleanHtmlOutput, DETAILED_NOTES_CONFIG } from './client';
import type { OutlineSection } from './outlineParsing';
import { buildRefinementDirective, type RefinementOptions } from './refinement';
import { mapWithConcurrency } from '../../utils/concurrency';

// ---------------------------------------------------------------------------
// Per-SECTION expansion for the chunked leveled pipelines (transcript and
// pasted text).
//
// Phase 2 used to expand a whole chunk — every heading it contains — in ONE
// call. On a dense chunk that meant 5-8 headings and dozens of sub-points all
// competing for a single output budget, so the model quietly compressed each
// sub-point into a one-line summary. Expanding ONE section per call gives
// every heading the full budget; and when a single heading itself carries a
// big pile of sub-points, the sub-points are further split into batches so
// each batch is written in its own call and every point gets a genuinely
// full explanation.
// ---------------------------------------------------------------------------

export type ChunkSourceKind = 'transcript' | 'text';

// A section whose sub-point count exceeds MAX_SUBS_PER_CALL is written in
// several calls of at most SUB_BATCH sub-points each.
const MAX_SUBS_PER_CALL = 8;
const SUB_BATCH = 5;

const KIND_WORDING: Record<ChunkSourceKind, { source: string; segment: string; grounding: string }> = {
  transcript: {
    source: 'a SPOKEN class/lecture transcript',
    segment: 'Transcript segment (your ONLY source of facts)',
    grounding: 'Capture every fact, date, number, name, definition, example and aside the teacher stated. Where the teacher explained something only briefly, EXPAND it into a clear, complete, advanced explanation that stays fully consistent with what was taught — never contradict or replace the teacher\'s facts.',
  },
  text: {
    source: 'source material (pasted notes/content)',
    segment: 'Source segment (your ONLY source of facts)',
    grounding: 'Capture every fact, date, number, name, definition and example present in the source. Where the source is brief, expand and enrich the explanation while staying fully consistent with it.',
  },
};

const depthDirective = (level: 'medium' | 'detailed' | 'deep') =>
  level === 'deep'
    ? 'Go MAXIMALLY deep and advanced on every sub-point: what it is, why it matters, how it works / the mechanism, background and significance, plus every concrete fact from the source. Expand a sub-point into its own <h4> parts where it is layered. Miss nothing.'
    : level === 'detailed'
      ? 'Explain every sub-point thoroughly and concretely, with the facts and examples from the source.'
      : 'Give every sub-point a solid, clear, self-sufficient explanation using the key facts from the source.';

async function expandOnce(
  kind: ChunkSourceKind,
  chunkText: string,
  heading: string,
  subheadings: string[],
  sectionNumber: number,
  subStartIndex: number, // 0-based index of subheadings[0] within the FULL section
  includeH2: boolean,
  siblingHeadings: string[],
  part: number,
  total: number,
  language: string,
  modelName: string,
  level: 'medium' | 'detailed' | 'deep',
  refine?: RefinementOptions,
): Promise<string> {
  const ai = createAIClient();
  const w = KIND_WORDING[kind];

  const subList = subheadings
    .map((s, i) => `<h3>${sectionNumber}.${subStartIndex + i + 1} ${s}</h3>`)
    .join('\n');

  const subGuidance = subheadings.length
    ? `Write EVERY one of these sub-points as its OWN full sub-section, using exactly these <h3> headings/numbers:
${subList}
    **ANTI-SUMMARY RULE (most important):** each of these sub-points gets its own complete, multi-paragraph explanation — NEVER a single line, NEVER two sub-points folded into one, NEVER a bullet that just restates the heading. If the source mentions a sub-point only briefly, still develop it into a full explanation.`
    : `Break this section into logical <h3>${sectionNumber}.k …</h3> sub-sections of your own that fully cover it, each properly explained.`;

  const prompt = `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Below is segment ${part} of ${total} of ${w.source}. Write the FULL, deeply detailed study-notes content for ONE section of it — ONLY this section. Other sections of this segment are being written separately; do not drift into them.

    Language: ${language}

    ${w.segment}:
    """${chunkText}"""

    This section (number ${sectionNumber}): "${heading}"
    ${includeH2
      ? `Begin with <h2>${sectionNumber}. ${heading}</h2>.`
      : `Do NOT output the <h2> heading (it is already written) — continue directly with the <h3> sub-sections below.`}
    ${subGuidance}

    Sections handled elsewhere (scope only — do NOT write them): ${siblingHeadings.filter(h => h !== heading).map(h => `"${h}"`).join(', ') || '(none)'}

    ${depthDirective(level)}
    ${w.grounding}

    COMPLETENESS SAFETY NET: before finishing, re-scan the segment for anything that belongs to THIS section but isn't in your draft — a fact, date, example, aside — and add it under the most relevant sub-section (or its own <h4>) rather than dropping it.

    FORMAT:
    - Full-sentence <ul><li> bullets, <strong> for key terms / dates / figures / names.
    - Present each part in whatever form explains it best — flowing prose, bulleted breakdowns, a comparison <table>, or ONE clean SVG in <div class="flowchart-container"> (no border, use viewBox). Use these only where they genuinely aid understanding, never to fill a quota.
    - No document <h1>, no overview, no summary/conclusion block, no filler, no empty or one-line headings.
    ${buildRefinementDirective(refine)}
    Output: Return ONLY raw HTML for this section. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
}

/**
 * Expand ONE outlined section of a chunk into full detailed notes. When the
 * section carries more sub-points than one call can genuinely do justice to,
 * the sub-points are written in batches (each batch its own call, numbering
 * continued) and concatenated — so a heading with 15 sub-points comes back
 * as 15 fully-developed sub-sections instead of a compressed summary.
 *
 * A refinement pass (existing draft and/or user instruction) always runs as
 * a single call over the whole section, since it revises content that
 * already exists rather than writing it fresh.
 */
export const expandChunkSection = async (
  kind: ChunkSourceKind,
  chunkText: string,
  section: OutlineSection,
  sectionNumber: number,
  siblingHeadings: string[],
  part: number,
  total: number,
  language: string,
  modelName: string,
  level: 'medium' | 'detailed' | 'deep',
  refine?: RefinementOptions,
): Promise<string> => {
  const subs = section.subheadings;
  const isRevision = !!(refine && (refine.existingHtml || refine.customInstruction));

  if (isRevision || subs.length <= MAX_SUBS_PER_CALL) {
    return expandOnce(
      kind, chunkText, section.heading, subs, sectionNumber, 0, true,
      siblingHeadings, part, total, language, modelName, level, refine,
    );
  }

  // Batches run in PARALLEL (bounded) — each batch's <h3> numbering is
  // precomputed from its start index, so completion order doesn't matter;
  // results land in their slots and are joined in outline order.
  const starts: number[] = [];
  for (let start = 0; start < subs.length; start += SUB_BATCH) starts.push(start);
  const pieces: string[] = new Array(starts.length).fill('');
  await mapWithConcurrency(starts.length, 3, async (b) => {
    const start = starts[b];
    pieces[b] = await expandOnce(
      kind, chunkText, section.heading, subs.slice(start, start + SUB_BATCH), sectionNumber, start, start === 0,
      siblingHeadings, part, total, language, modelName, level, refine,
    );
  });
  return pieces.join('\n');
};
