import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG } from './client';

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

export type DetailLevel = 'normal' | 'medium' | 'detailed';

export interface TopicOutlineSection {
  heading: string;
  subheadings: string[];
}

export interface TopicOutline {
  title: string;
  overview: string;
  sections: TopicOutlineSection[];
}

/** Tolerantly extract the first JSON object from a model response. */
function parseOutlineJson(raw: string): TopicOutline | null {
  if (!raw) return null;
  let text = raw.trim()
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  text = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(text);
    const sections: TopicOutlineSection[] = Array.isArray(obj.sections)
      ? obj.sections
          .map((s: any) => ({
            heading: String(s?.heading || s?.title || '').trim(),
            subheadings: Array.isArray(s?.subheadings)
              ? s.subheadings.map((x: any) => String(x || '').trim()).filter(Boolean)
              : [],
          }))
          .filter((s: TopicOutlineSection) => s.heading)
      : [];
    if (!sections.length) return null;
    return {
      title: String(obj.title || '').trim(),
      overview: String(obj.overview || '').trim(),
      sections,
    };
  } catch {
    return null;
  }
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
    - <div class="key-point"><strong>Key Concept:</strong> …</div> for a vital definition, and <div class="note-box">…</div> for an important extra fact/exception/example.
    - Add a <table> if this section compares things or lists data. Add ONE clean SVG diagram inside <div class="flowchart-container"> (no border, use viewBox) ONLY if a process/hierarchy/timeline here genuinely benefits from it.
    - Never output an empty or one-line heading. No filler, maximum facts per line.

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

    Output: Return ONLY raw HTML (or empty). No markdown, no code fences, no apology text.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
};
