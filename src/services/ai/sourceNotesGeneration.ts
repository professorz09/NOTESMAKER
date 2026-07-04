import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG } from './client';
import { parseOutlineSectionsJson, type OutlineSection } from './outlineParsing';
import { buildRefinementDirective, type RefinementOptions } from './refinement';

// ---------------------------------------------------------------------------
// Source-grounded leveled pipelines: Pasted Text and Uploaded Files.
//
// Same shape as the transcript pipeline (outline the source → expand each
// piece following that outline) but generalized wording since the source
// here isn't spoken class audio — it's pasted notes or uploaded documents.
// Text is chunked (like transcripts) so long pastes don't hit the output cap;
// files are sent whole to every call (there's no reliable way to "chunk" a
// PDF client-side, and re-sending the file per section keeps every section
// fully grounded in the real content instead of drifting on inference).
// ---------------------------------------------------------------------------

export type SourceSection = OutlineSection;

// The label inside <div class="key-point"> is left for the model to choose
// (Key Concept / Definition / Formula / Rule / …) instead of one fixed word.
const KEY_POINT_RULE =
  '<div class="key-point"><strong>[a short label that actually fits this box\'s content — Key Concept / Definition / Formula / Rule / whatever fits, chosen fresh each time]:</strong> …</div> for vital definitions or rules, and <div class="note-box">…</div> for important extra facts/examples/exceptions.';

// --- Pasted text -----------------------------------------------------------

export const outlineTextChunk = async (
  chunkText: string,
  part: number,
  total: number,
  language: string,
  modelName: string,
): Promise<SourceSection[]> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert note-structurer.
    Task: Below is segment ${part} of ${total} of source material (pasted notes/content) that needs to become study notes. Extract the STRUCTURED OUTLINE of every topic and key sub-point covered in THIS segment — the skeleton of all points, in the order they appear. Do NOT explain anything yet; only the structure.

    This structure is what the NEXT step will be limited to explaining — anything left out here will not make it into the final notes. Err on the side of including a sub-point rather than dropping it, including things mentioned only briefly or in passing. Do not silently fold two distinct points into one heading.

    Language for headings: ${language}
    Source segment:
    """${chunkText}"""

    Output STRICT JSON ONLY (no markdown/code fences):
    { "sections": [ { "heading": "specific topic", "subheadings": ["specific sub-point", "..."] } ] }

    Capture EVERY real point — do not merge or drop any. Headings must be concrete and specific to what this segment actually contains, never generic placeholders.
  `;

  const response = await ai.models.generateContent({ model: modelName, contents: prompt, config: NOTES_GEN_CONFIG });
  return parseOutlineSectionsJson(response.text || '');
};

export const generateTextTitle = async (
  firstChunk: string,
  language: string,
  modelName: string,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert academic note-writer.
    Task: Below is the BEGINNING of a piece of source material. From it, infer the overall subject and produce ONLY:
      1. A single main title as <h1> — a clean, descriptive title of the whole material. NO number.
      2. Immediately after it, one overview box: <div class="key-point"><strong>Overview:</strong> a 2-4 line at-a-glance summary.</div>

    Language: ${language}
    Source start:
    """${firstChunk.slice(0, 6000)}"""

    Output: Return ONLY the raw HTML for the <h1> and the overview div. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({ model: modelName, contents: prompt, config: NOTES_GEN_CONFIG });
  return cleanHtmlOutput(response.text || '');
};

export const expandTextChunkStructured = async (
  chunkText: string,
  sections: SourceSection[],
  startSectionNumber: number,
  part: number,
  total: number,
  language: string,
  modelName: string,
  level: 'medium' | 'detailed' | 'deep',
  refine?: RefinementOptions,
): Promise<string> => {
  const ai = createAIClient();

  const depth = level === 'deep'
    ? 'Go MAXIMALLY deep on every point AND sub-point: full explanation, mechanism, and every fact, date, number, name, definition and example present in the source — expand each sub-point into its own <h4> where it has parts. Miss nothing.'
    : level === 'detailed'
      ? 'Explain every point and sub-point thoroughly, with the concrete facts and examples from the source.'
      : 'Give each point a solid, clear explanation using the key facts from the source.';

  const outlineList = sections
    .map((s, i) => `${startSectionNumber + i}. ${s.heading}${s.subheadings.length ? ' — ' + s.subheadings.join('; ') : ''}`)
    .join('\n');

  const prompt = `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Write DETAILED, structured study notes for segment ${part} of ${total} of the source material, following the outline below. Draw ALL content from the source segment — capture every fact, date, number, name, definition and example present. This is NOT a summary; do not shorten or drop points — expand and enrich where the source is brief.

    Language: ${language}

    Outline to follow (number the sections continuing from ${startSectionNumber}):
    ${outlineList}

    Source segment (your source):
    """${chunkText}"""

    ${depth}

    COMPLETENESS SAFETY NET: the outline above was extracted separately and may itself have missed something small. While writing, re-check the source segment against it — if you spot a real point the outline doesn't cover, still include it under the most relevant heading (or as its own <h3>/<h4>) rather than dropping it because it wasn't listed.

    FORMAT:
    - <h2>${startSectionNumber}. …</h2> for each outline section (continue the numbering), <h3>${startSectionNumber}.1 …</h3> for its sub-points, <h4> for a further level where needed.
    - Full-sentence <ul><li> bullets, <strong> for key terms/dates/figures, ${KEY_POINT_RULE}
    - Add a <table> where the segment compares or lists data; add ONE clean SVG inside <div class="flowchart-container"> (no border, use viewBox) where a process/hierarchy/timeline is described.
    - Do NOT add a document <h1> title or overview (already present). No filler, no empty headings.
    ${buildRefinementDirective(refine)}
    Output: Return ONLY raw HTML. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({ model: modelName, contents: prompt, config: DETAILED_NOTES_CONFIG });
  return cleanHtmlOutput(response.text || '');
};

// --- Uploaded files ----------------------------------------------------------

export const outlineFiles = async (
  files: { data: string; mimeType: string }[],
  language: string,
  modelName: string,
): Promise<SourceSection[]> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert note-structurer.
    Task: Analyze the attached file(s) and extract the STRUCTURED OUTLINE of every topic, section and key sub-point they contain — the skeleton of everything, in a logical reading order. Do NOT explain anything yet; only the structure.

    This structure is what the NEXT step will be limited to explaining — anything left out here will not make it into the final notes, so err on the side of including a sub-point rather than dropping it, including things mentioned only in a caption, footnote, table cell or aside.

    Language for headings: ${language}

    Output STRICT JSON ONLY (no markdown/code fences):
    { "sections": [ { "heading": "specific topic", "subheadings": ["specific sub-point", "..."] } ] }

    Capture EVERY real section/topic across ALL pages/files — do not merge or drop any. Headings must be concrete and specific to what the files actually contain.
  `;

  const parts: any[] = files.map(f => ({ inlineData: { data: f.data, mimeType: f.mimeType } }));
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({ model: modelName, contents: { parts }, config: NOTES_GEN_CONFIG });
  return parseOutlineSectionsJson(response.text || '');
};

export const generateFilesTitle = async (
  files: { data: string; mimeType: string }[],
  language: string,
  modelName: string,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert academic note-writer.
    Task: Analyze the attached file(s) and produce ONLY:
      1. A single main title as <h1> — a clean, descriptive title of the whole material. NO number.
      2. Immediately after it, one overview box: <div class="key-point"><strong>Overview:</strong> a 2-4 line at-a-glance summary of what these files cover.</div>

    Language: ${language}

    Output: Return ONLY the raw HTML for the <h1> and the overview div. No markdown, no code fences.
  `;

  const parts: any[] = files.map(f => ({ inlineData: { data: f.data, mimeType: f.mimeType } }));
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({ model: modelName, contents: { parts }, config: NOTES_GEN_CONFIG });
  return cleanHtmlOutput(response.text || '');
};

export const expandFilesSection = async (
  files: { data: string; mimeType: string }[],
  section: SourceSection,
  sectionNumber: number,
  allHeadings: string[],
  language: string,
  modelName: string,
  level: 'medium' | 'detailed' | 'deep',
  refine?: RefinementOptions,
): Promise<string> => {
  const ai = createAIClient();

  const subGuidance = section.subheadings.length
    ? `Cover these sub-points, each as its own <h3>${sectionNumber}.k …</h3> sub-section (go into <h4> where a sub-point itself has parts):\n${section.subheadings.map((s, i) => `${sectionNumber}.${i + 1} ${s}`).join('\n')}`
    : (level === 'deep' || level === 'detailed'
      ? 'Break this section into 3-5 logical <h3> sub-sections of your own that fully cover it.'
      : 'Break this section into 2-4 logical <h3> sub-sections where it helps.');

  const depth = level === 'deep'
    ? 'Go MAXIMALLY deep: every sub-section must have real explanation, mechanism, and every fact/date/number/name/example present in the files. Miss nothing.'
    : level === 'detailed'
      ? 'Explain every point and sub-point thoroughly, drawing on the concrete facts and examples in the files.'
      : 'Give each point a solid, clear explanation using the key facts from the files.';

  const prompt = `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Using the attached file(s) as your ONLY source, write the FULL, detailed content for ONE section of a larger set of study notes. Write ONLY this section — do NOT repeat the document title, overview, or any other section's content.

    Language: ${language}

    This section (number ${sectionNumber}): "${section.heading}"
    ${subGuidance}

    Full outline (scope only, don't drift into other sections): ${allHeadings.map((h, i) => `${i + 1}. ${h}`).join(' | ')}

    ${depth}

    COMPLETENESS SAFETY NET: re-check the relevant part of the files against your draft before finishing — if you notice a fact, label, footnote or table value that belongs in this section but isn't in your draft yet, add it rather than leaving it out.

    FORMAT:
    - Begin with <h2>${sectionNumber}. ${section.heading}</h2>, then <h3>${sectionNumber}.1 …</h3> sub-sections, <h4> for a further level where needed.
    - Full-sentence <ul><li> bullets, <strong> for key terms/dates/figures, ${KEY_POINT_RULE}
    - Add a <table> where the section compares or lists data from the files; add ONE clean SVG inside <div class="flowchart-container"> (no border, use viewBox) where a process/hierarchy/timeline is described.
    - Never output an empty or one-line heading. No filler.
    ${buildRefinementDirective(refine)}
    Output: Return ONLY raw HTML for this section. No markdown, no code fences.
  `;

  const parts: any[] = files.map(f => ({ inlineData: { data: f.data, mimeType: f.mimeType } }));
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({ model: modelName, contents: { parts }, config: DETAILED_NOTES_CONFIG });
  return cleanHtmlOutput(response.text || '');
};
