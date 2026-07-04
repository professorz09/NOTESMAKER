import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG } from './client';
import { parseOutlineSectionsJson, parseOutlineJsonObject } from './outlineParsing';
import { buildRefinementDirective, type RefinementOptions } from './refinement';

// Shared formatting rule text used by every expand-a-section prompt below.
// The label inside <div class="key-point"> is deliberately left for the
// model to choose (Key Concept / Definition / Formula / Rule / Warning /
// …) instead of being hard-coded to one literal phrase — a formula and a
// historical date box shouldn't both be forced to say "Key Concept:".
const FORMATTING_RULE =
  '<div class="key-point"><strong>[a short label that actually fits this box\'s content, e.g. Key Concept / Definition / Formula / Rule — pick freshly each time, don\'t default to the same word]:</strong> …</div> for a vital definition or rule, and <div class="note-box">…</div> for an important extra fact/exception/example.';

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
  overview: string;
  sections: TopicOutlineSection[];
}

export interface DeepOutline extends TopicOutline {
  // Areas the analysis flags as deserving deeper focus, so expansion can
  // weight them more heavily.
  focusAreas: string[];
}

/** Tolerantly extract title/overview/sections from a model response. */
function parseOutlineJson(raw: string): TopicOutline | null {
  const sections = parseOutlineSectionsJson(raw);
  if (!sections.length) return null;
  const obj = parseOutlineJsonObject(raw) || {};
  return {
    title: String(obj.title || '').trim(),
    overview: String(obj.overview || '').trim(),
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
    ? 'Produce 8-15 main sections, and for EACH give 3-6 specific sub-headings that break the section into its real sub-dimensions. Be exhaustive — every angle of the topic should map to a section or sub-heading.'
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
      "overview": "a 2-4 line at-a-glance summary of what the notes cover",
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

  const subGuidance = section.subheadings.length
    ? `Cover these sub-points, each as its own <h3>${sectionNumber}.k …</h3> sub-section (go into <h4> where a sub-point itself has parts):\n${section.subheadings.map((s, i) => `${sectionNumber}.${i + 1} ${s}`).join('\n')}`
    : (level === 'detailed'
      ? 'Break this section into 3-5 logical <h3> sub-sections of your own that fully cover it.'
      : 'Break this section into 2-4 logical <h3> sub-sections where it helps.');

  const depth = level === 'detailed'
    ? 'Go MAXIMALLY deep: every sub-section must have real explanation, mechanism, and at least one concrete real-world example. Aim for a thorough, textbook-grade treatment of this section — do not stop early.'
    : 'Give a solid, detailed treatment of this section with clear explanation and concrete examples.';

  const prompt = `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Write the FULL, detailed content for ONE section of a larger set of study notes on "${topic}". Write ONLY this section — do NOT repeat the document title, the overview, or any other section's content.

    Language: ${language}

    This section (number ${sectionNumber}): "${section.heading}"
    ${subGuidance}

    Full outline of the notes (for scope only — so you don't drift into other sections): ${allHeadings.map((h, i) => `${i + 1}. ${h}`).join(' | ')}

    ${depth}

    FORMATTING RULES:
    - Begin with <h2>${sectionNumber}. ${section.heading}</h2>, then the sub-sections as <h3>${sectionNumber}.1 …</h3>, <h3>${sectionNumber}.2 …</h3>, etc. Use <h4> for a further level where needed.
    - State each concept simply first, then explain in depth with concrete facts — real dates, numbers, names, article/section numbers — and at least one real example ("e.g., …") per sub-section.
    - Use <ul><li> for points; each bullet is a full, informative sentence (never 2-3 words).
    - <strong> for every key term, name, date and figure.
    - ${FORMATTING_RULE}
    - Add a <table> if this section compares things or lists data. Add ONE clean SVG diagram inside <div class="flowchart-container"> (no border, use viewBox) ONLY if a process/hierarchy/timeline here genuinely benefits from it.
    - Never output an empty or one-line heading. No filler, maximum facts per line.
    ${buildRefinementDirective(refine)}
    Output: Return ONLY raw HTML for this section. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
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
    - Sub-sub-topics = 3-6 specific sub-headings under each section that break it into its real parts.
    Also decide the focus areas that need the most depth.

    Output STRICT JSON ONLY (no markdown, no code fences, no commentary):
    {
      "title": "clean descriptive title of the whole topic (no numbering)",
      "overview": "3-5 line at-a-glance summary",
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

  const subGuidance = section.subheadings.length
    ? `Cover EACH of these sub-sub-topics as its own <h3>${sectionNumber}.k …</h3>, and expand its main points into full explanation:\n${section.subheadings.map((s, i) => `${sectionNumber}.${i + 1} ${s}`).join('\n')}`
    : 'Break this section into 3-5 logical <h3> sub-sections that fully cover it.';

  const prompt = `
    Role: Subject expert & textbook author.
    Task: Write the FULL, detailed content for ONE sub-topic of the larger notes on "${topic}". Write ONLY this section — never repeat the document title, overview, or other sections.
    ${isFocus ? 'This is a HIGH-FOCUS area of the topic — go especially deep here with extra examples, mechanisms and nuance.' : ''}

    Language: ${language}

    Section number ${sectionNumber}: "${section.heading}"
    ${subGuidance}

    Full outline (scope only, don't drift into other sections): ${allHeadings.map((h, i) => `${i + 1}. ${h}`).join(' | ')}

    RULES:
    - Begin with <h2>${sectionNumber}. ${section.heading}</h2>, then <h3>${sectionNumber}.1 …</h3>, <h3>${sectionNumber}.2 …</h3>, using <h4> for a further level where needed.
    - State each point simply, then explain it in depth with concrete real facts (dates, numbers, names, articles) and at least one real example per sub-section.
    - <ul><li> full-sentence bullets, <strong> for key terms/dates/figures, ${FORMATTING_RULE}
    - Add a <table> if this section compares or lists data; add ONE clean SVG in <div class="flowchart-container"> (no border, use viewBox) only if a process/hierarchy/timeline genuinely benefits.
    - No empty or one-line headings. No filler.
    ${buildRefinementDirective(refine)}
    Output: Return ONLY raw HTML for this section. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
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
    - Same formatting as the rest of the notes: <ul><li> full-sentence bullets, <strong> key terms, <div class="key-point"> / <div class="note-box">, a <table> or one SVG in <div class="flowchart-container"> where it genuinely helps.
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
