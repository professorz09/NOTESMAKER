import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG } from './client';
import { parseOutlineSectionsJson, parseOutlineJsonObject } from './outlineParsing';
import { buildRefinementDirective, type RefinementOptions } from './refinement';
import { mapWithConcurrency } from '../../utils/concurrency';

// Shared guidance used by every expand-a-section prompt below. The guiding
// principle is: EXPLAIN the material well, and let the model choose whatever
// presentation fits — never force a table / diagram / box just to tick it off.

// Explanation depth — the single most important rule. Stops the model from
// disposing of a sub-point in one passing line.
const EXPLAIN_RULE =
  'Explain every point properly and in depth — the reader is preparing for a serious competitive exam (UPSC) and must actually understand and remember it, not just skim keywords. Develop EACH sub-point into a real explanation: several full sentences, or multiple substantive bullets that each carry a complete idea (what it is, why it matters, how it works, its effect/significance). NEVER dispose of a sub-point in a single passing line or a bare label.';

// Presentation is the model\'s choice — flexible, not a checklist.
const FORMAT_CHOICE =
  'Present each part in whatever form explains it best — flowing prose, bulleted breakdowns, a comparison <table>, or a simple clean SVG diagram in <div class="flowchart-container"> (no border, use viewBox). Use any of these ONLY because it genuinely aids understanding here, never to fill a quota: do not force a table or a diagram where clear writing reads better, and do not omit one where it truly clarifies. You decide, based on the content.';

// A section whose sub-heading count exceeds MAX_SUBS_PER_CALL is expanded in
// several calls of at most SUB_BATCH sub-headings each — all of them
// competing for one output budget is exactly what used to compress each
// sub-point into a one-line summary.
const MAX_SUBS_PER_CALL = 8;
const SUB_BATCH = 5;

// Run one section's expansion, batching its sub-headings across multiple
// calls when there are too many for a single output budget. `callOnce`
// writes one slice: `subStart` is the 0-based index of the slice's first
// sub-heading within the full section (for numbering continuation) and
// `includeH2` says whether this call opens the section with its <h2>.
// A refinement pass (existing draft / user instruction) always runs as one
// call over the whole section, since it revises rather than writes fresh.
async function expandWithSubBatches(
  subheadings: string[],
  refine: RefinementOptions | undefined,
  callOnce: (subs: string[], subStart: number, includeH2: boolean, refine?: RefinementOptions) => Promise<string>,
): Promise<string> {
  const isRevision = !!(refine && (refine.existingHtml || refine.customInstruction));
  if (isRevision || subheadings.length <= MAX_SUBS_PER_CALL) {
    return callOnce(subheadings, 0, true, refine);
  }
  // Batches run in PARALLEL (bounded) — numbering is precomputed per batch,
  // so completion order doesn't matter; results land in their slots.
  const starts: number[] = [];
  for (let start = 0; start < subheadings.length; start += SUB_BATCH) starts.push(start);
  const pieces: string[] = new Array(starts.length).fill('');
  await mapWithConcurrency(starts.length, 3, async (b) => {
    const start = starts[b];
    pieces[b] = await callOnce(subheadings.slice(start, start + SUB_BATCH), start, start === 0);
  });
  return pieces.join('\n');
}


// ---------------------------------------------------------------------------
// Leveled topic-notes pipeline (Normal / Medium / Detailed).
//
// A single model call can only emit so much before the output cap truncates
// it, so "make the whole topic, in depth, nothing missing" cannot be done in
// one shot for a broad topic. Instead, higher detail levels plan the topic as
// a structured outline, then expand each section in its own call and append
// the results live:
//
//   Normal   → one direct call (handled by generateTopicContent elsewhere).
//   Medium   → outline (main sections) → expand each section.
//   Detailed → outline (sections + sub-sections) → expand each section deeply
//              (covering its sub-headings) → a final "what's still missing?"
//              completeness pass so the whole topic is genuinely covered.
//
// The prompts are intentionally NON-rigid: the model decides the sections that
// actually fit THIS topic instead of forcing a fixed template onto everything.
// ---------------------------------------------------------------------------

export type DetailLevel = 'normal' | 'medium' | 'detailed' | 'deep';

export interface TopicOutlineSection {
  heading: string;
  subheadings: string[];
}

export interface TopicOutline {
  title: string;
  sections: TopicOutlineSection[];
}

export interface DeepOutline extends TopicOutline {
  // Areas the analysis flags as deserving deeper focus, so expansion can
  // weight them more heavily.
  focusAreas: string[];
}

/** Tolerantly extract title/sections from a model response. */
function parseOutlineJson(raw: string): TopicOutline | null {
  const sections = parseOutlineSectionsJson(raw);
  if (!sections.length) return null;
  const obj = parseOutlineJsonObject(raw) || {};
  return {
    title: String(obj.title || '').trim(),
    sections,
  };
}

/**
 * Plan the full structure of the notes. The model picks whatever sections the
 * topic genuinely needs (adapting to polity vs. history vs. science vs. an
 * abstract concept) rather than a fixed template.
 */
export const generateTopicOutline = async (
  topic: string,
  language: string,
  modelName: string = 'gemini-3.1-pro-preview',
  level: Exclude<DetailLevel, 'normal'> = 'medium',
): Promise<TopicOutline | null> => {
  const ai = createAIClient();

  const scale = level === 'detailed'
    ? 'Produce 8-15 main sections, and for EACH give 4-8 specific sub-headings that break the section into its real sub-dimensions. Keep sub-headings SMALL and granular — each one a single specific point, never a bundle of several ideas; split a broad sub-point into its smaller parts instead. Be exhaustive — every angle of the topic should map to a section or sub-heading.'
    : 'Produce 5-9 main sections. Add 2-4 sub-headings only where a section genuinely has distinct parts (otherwise an empty list is fine).';

  const prompt = `
    Role: Expert curriculum designer and subject-matter specialist.
    Task: Plan the COMPLETE structure for exhaustive, well-organized study notes on the topic below. First think about ALL the dimensions this SPECIFIC topic genuinely has, then lay them out as an ordered list of sections that flow logically. Adapt the structure to the topic — do NOT force a generic template; only include sections that actually fit, and ADD any topic-specific sections that matter.

    Topic: "${topic}"
    Language for the headings: ${language}

    Coverage to consider (include only those that fit, in a sensible order, plus anything topic-specific): definition & meaning, background/history & evolution, core concepts & principles, types/classification, structure/components, working/mechanism/process, key features, causes & effects, important facts/data/figures, key persons/committees/articles/dates, examples & case studies, comparisons, significance/applications, challenges/criticism, and way forward.

    Scale: ${scale}

    Output STRICT JSON ONLY (no markdown, no code fences, no commentary), exactly this shape:
    {
      "title": "a clean, descriptive title for the whole topic (no numbering)",
      "sections": [
        { "heading": "specific main-section title", "subheadings": ["specific sub-point", "..."] }
      ]
    }

    Headings must be concrete and specific to THIS topic — never generic placeholders like "Section 1" or "Other points".
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: NOTES_GEN_CONFIG,
  });

  return parseOutlineJson(response.text || '');
};

/**
 * Write the full detailed HTML for ONE section of the notes. Given the whole
 * outline as context so it stays in scope and doesn't overlap sibling
 * sections. Depth scales with the level.
 */
export const expandTopicSection = async (
  topic: string,
  section: TopicOutlineSection,
  sectionNumber: number,
  allHeadings: string[],
  language: string,
  modelName: string = 'gemini-3.1-pro-preview',
  level: Exclude<DetailLevel, 'normal'> = 'medium',
  refine?: RefinementOptions,
): Promise<string> => {
  const ai = createAIClient();

  const callOnce = async (subs: string[], subStart: number, includeH2: boolean, refineOnce?: RefinementOptions) => {
    const subGuidance = subs.length
      ? `Write EVERY one of these sub-points as its OWN full sub-section, using exactly these <h3> headings/numbers. Where a sub-point GENUINELY has distinct parts (definition, mechanism, examples, data…), break it further into its own <h4>${sectionNumber}.k.m …</h4> sub-sub-sections — but only where that truly fits; a rich flowing explanation is fine where it doesn't:
${subs.map((s, i) => `<h3>${sectionNumber}.${subStart + i + 1} ${s}</h3>`).join('\n')}
    **ANTI-SUMMARY RULE (most important):** each of these sub-points gets its own complete, multi-paragraph explanation — NEVER a single line, NEVER two sub-points folded into one, NEVER a bullet that just restates the heading.`
      : (level === 'detailed'
        ? 'Break this section into 3-5 logical <h3> sub-sections of your own that fully cover it, each properly explained (with <h4> sub-parts where a sub-section is layered).'
        : 'Break this section into 2-4 logical <h3> sub-sections where it helps, each properly explained.');

    const depth = level === 'detailed'
      ? 'Go MAXIMALLY deep: every sub-section must have real explanation, mechanism, and at least one concrete real-world example. Aim for a thorough, textbook-grade treatment of this section — do not stop early.'
      : 'Give a solid, detailed treatment of this section with clear explanation and concrete examples.';

    const prompt = `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Write the FULL, detailed content for ONE section of a larger set of study notes on "${topic}". Write ONLY this section — do NOT repeat the document title or any other section's content.

    Language: ${language}

    This section (number ${sectionNumber}): "${section.heading}"
    ${includeH2
      ? `Begin with <h2>${sectionNumber}. ${section.heading}</h2>.`
      : `Do NOT output the <h2> heading (it is already written) — continue directly with the <h3> sub-sections below.`}
    ${subGuidance}

    Full outline of the notes (for scope only — so you don't drift into other sections): ${allHeadings.map((h, i) => `${i + 1}. ${h}`).join(' | ')}

    ${depth}

    RULES:
    - ${EXPLAIN_RULE}
    - State each concept simply first, then develop it with concrete facts — real dates, numbers, names, article/section numbers — and at least one real example ("e.g., …") per sub-section. <strong> every key term, name, date and figure.
    - When you use bullets, each <li> is a full, informative sentence — never 2-3 words.
    - ${FORMAT_CHOICE}
    - Never output an empty or one-line heading. No filler — but every point must be genuinely explained, not compressed into a keyword.
    ${buildRefinementDirective(refineOnce)}
    Output: Return ONLY raw HTML for this section. No markdown, no code fences.
  `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: DETAILED_NOTES_CONFIG,
    });

    return cleanHtmlOutput(response.text || '');
  };

  return expandWithSubBatches(section.subheadings, refine, callOnce);
};

/**
 * DEEP level — Step 1 (Gemini 3 Pro). Analyze the topic to decide which areas
 * deserve the most focus, then produce a deep 3-level plan: subtopics
 * (sections) → sub-subtopics (subheadings). Pro's stronger reasoning gives a
 * better-structured, genuinely comprehensive skeleton than Flash would.
 */
export const generateDeepOutline = async (
  topic: string,
  language: string,
  proModel: string,
): Promise<DeepOutline | null> => {
  const ai = createAIClient();

  const prompt = `
    Role: Master subject expert and examiner planning the definitive notes on a topic.
    Task: First ANALYZE "${topic}" deeply — what are its real sub-topics, which sub-topics are most important / most examined / hardest and therefore deserve the most focus? Then lay out a COMPLETE, deeply hierarchical plan that covers the whole topic end-to-end. Adapt entirely to THIS topic; do not force a generic template.

    Language for headings: ${language}

    Build THREE levels of depth:
    - Sub-topics = the main sections (aim for 8-16, as many as the topic genuinely needs).
    - Sub-sub-topics = 4-8 specific sub-headings under each section that break it into its real parts. Keep them SMALL and granular — each sub-heading is ONE specific point, never a bundle of several ideas; if a sub-point is broad, split it into its smaller parts (the expansion step will develop each one into its own fully-explained sub-section, so more granular = deeper notes).
    Also decide the focus areas that need the most depth.

    Output STRICT JSON ONLY (no markdown, no code fences, no commentary):
    {
      "title": "clean descriptive title of the whole topic (no numbering)",
      "focusAreas": ["the sub-topics/aspects that deserve the deepest treatment"],
      "sections": [
        { "heading": "specific sub-topic title", "subheadings": ["specific sub-sub-topic", "..."] }
      ]
    }

    Every heading must be concrete and specific to THIS topic — never a generic placeholder. Be exhaustive: every meaningful angle should map to a section or a sub-heading.
  `;

  const response = await ai.models.generateContent({
    model: proModel,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  const base = parseOutlineJson(response.text || '');
  if (!base) return null;
  const raw = parseOutlineJsonObject(response.text || '');
  const focusAreas: string[] = Array.isArray(raw?.focusAreas)
    ? raw.focusAreas.map((x: any) => String(x || '').trim()).filter(Boolean)
    : [];
  return { ...base, focusAreas };
};

/**
 * DEEP level — Step 2. Expand ONE sub-topic section into full detailed HTML,
 * covering each of its sub-sub-topics and expanding their main points, at
 * Gemini 3 Pro quality throughout the pipeline. Focus areas get extra depth.
 */
export const expandDeepSection = async (
  topic: string,
  section: TopicOutlineSection,
  sectionNumber: number,
  allHeadings: string[],
  focusAreas: string[],
  language: string,
  modelName: string,
  refine?: RefinementOptions,
): Promise<string> => {
  const ai = createAIClient();

  const isFocus = focusAreas.some(f =>
    f && (section.heading.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(section.heading.toLowerCase())));

  const callOnce = async (subs: string[], subStart: number, includeH2: boolean, refineOnce?: RefinementOptions) => {
    const subGuidance = subs.length
      ? `Write EACH of these sub-sub-topics as its OWN full sub-section, using exactly these <h3> headings/numbers. Where a sub-sub-topic GENUINELY has distinct parts (definition, background, mechanism/working, examples, data/figures, significance…), break it further into its own <h4>${sectionNumber}.k.m …</h4> sub-parts — but only where that truly fits; a rich flowing explanation is fine where it doesn't:
${subs.map((s, i) => `<h3>${sectionNumber}.${subStart + i + 1} ${s}</h3>`).join('\n')}
    **ANTI-SUMMARY RULE (most important):** each sub-sub-topic gets its own complete, multi-paragraph, textbook-grade treatment — NEVER a heading with a single line under it, NEVER two sub-sub-topics folded into one, NEVER a bullet that just restates the heading.`
      : 'Break this section into 3-5 logical <h3> sub-sections that fully cover it, each explained in depth with <h4> sub-parts where a sub-section is layered.';

    const prompt = `
    Role: Subject expert & textbook author.
    Task: Write the FULL, detailed content for ONE sub-topic of the larger notes on "${topic}". Write ONLY this section — never repeat the document title or other sections.
    ${isFocus ? 'This is a HIGH-FOCUS area of the topic — go especially deep here with extra examples, mechanisms and nuance.' : ''}

    Language: ${language}

    Section number ${sectionNumber}: "${section.heading}"
    ${includeH2
      ? `Begin with <h2>${sectionNumber}. ${section.heading}</h2>.`
      : `Do NOT output the <h2> heading (it is already written) — continue directly with the <h3> sub-sections below.`}
    ${subGuidance}

    Full outline (scope only, don't drift into other sections): ${allHeadings.map((h, i) => `${i + 1}. ${h}`).join(' | ')}

    RULES:
    - ${EXPLAIN_RULE}
    - State each point simply, then develop it in depth with concrete real facts (dates, numbers, names, articles) and at least one real example per sub-section. <strong> every key term, date and figure; full-sentence <li> bullets only.
    - ${FORMAT_CHOICE}
    - No empty or one-line headings. No filler — but nothing compressed into a bare keyword either; explain it.
    ${buildRefinementDirective(refineOnce)}
    Output: Return ONLY raw HTML for this section. No markdown, no code fences.
  `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: DETAILED_NOTES_CONFIG,
    });

    return cleanHtmlOutput(response.text || '');
  };

  return expandWithSubBatches(section.subheadings, refine, callOnce);
};

/**
 * Detailed-only completeness pass: given everything already covered, write any
 * important dimensions of the topic that are still missing, as new numbered
 * sections. Returns empty HTML if genuinely nothing important remains.
 */
export const generateAdditionalTopicAspects = async (
  topic: string,
  coveredHeadings: string[],
  startSectionNumber: number,
  language: string,
  modelName: string = 'gemini-3.1-pro-preview',
  refine?: RefinementOptions,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Strict examiner ensuring the notes on "${topic}" are truly complete.
    Task: The following sections have ALREADY been written: ${coveredHeadings.map((h, i) => `${i + 1}. ${h}`).join(' | ')}.
    Identify any IMPORTANT dimensions of this topic that are still missing or under-covered (e.g., recent developments, comparisons, criticism, real case studies, applications, exceptions, related concepts) and write them as NEW sections. Do NOT repeat anything already covered above.

    Language: ${language}

    RULES:
    - Number new sections starting from <h2>${startSectionNumber}. …</h2> and continue (${startSectionNumber + 1}, …). Use <h3>/<h4> sub-sections with real depth and examples.
    - ${EXPLAIN_RULE}
    - Same style as the rest of the notes: full-sentence <li> bullets, <strong> key terms. ${FORMAT_CHOICE}
    - If, after honest review, nothing important is missing, output NOTHING at all (an empty response).
    ${buildRefinementDirective(refine)}
    Output: Return ONLY raw HTML (or empty). No markdown, no code fences, no apology text.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
};
