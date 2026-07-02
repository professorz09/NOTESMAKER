import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG } from './client';

// ---------------------------------------------------------------------------
// Class-transcript → detailed notes pipeline.
//
// A live class transcript (3–4 hours of speech) is far too large to turn into
// good notes in a single model call: the output token budget truncates it and
// half the content silently disappears. So we run an automatic, staged
// pipeline the user never has to think about — they paste the transcript, hit
// one button, and watch the notes build up:
//
//   Step 1  → generate the document title + an at-a-glance overview.
//   Step 2… → walk the transcript in word-bounded chunks; each chunk becomes
//             fully detailed, structured HTML notes (with tables / SVG where
//             they help). Nothing is summarised away — only spoken filler is
//             dropped. Results are appended live, chunk by chunk.
// ---------------------------------------------------------------------------

/**
 * Split a long transcript into word-bounded chunks, preferring paragraph and
 * then sentence boundaries (handles the Hindi danda "।" as a sentence end).
 * Keeping each chunk small guarantees the detailed pass can expand every point
 * without hitting the output-token cap — which is what stops content going
 * missing on long lectures.
 */
export function chunkTranscript(text: string, maxWords = 5500): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const countWords = (s: string) => (s.trim().match(/\S+/g) || []).length;
  const paragraphs = clean.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  const flush = () => {
    if (current.length) {
      chunks.push(current.join('\n\n'));
      current = [];
      currentWords = 0;
    }
  };

  for (const para of paragraphs) {
    const w = countWords(para);

    // A single paragraph bigger than the budget → break it on sentences.
    if (w > maxWords) {
      flush();
      const sentences = para.split(/(?<=[.!?।])\s+/);
      let sc: string[] = [];
      let scw = 0;
      for (const s of sentences) {
        const sw = countWords(s);
        if (scw + sw > maxWords && sc.length) {
          chunks.push(sc.join(' '));
          sc = [];
          scw = 0;
        }
        sc.push(s);
        scw += sw;
      }
      if (sc.length) chunks.push(sc.join(' '));
      continue;
    }

    if (currentWords + w > maxWords && current.length) flush();
    current.push(para);
    currentWords += w;
  }
  flush();

  return chunks.length ? chunks : [clean];
}

/**
 * Step 1 — read the opening of the lecture and produce just the document
 * title (<h1>, no number) plus a short overview box. Small, fast call.
 */
export const generateTranscriptTitle = async (
  firstChunk: string,
  language: string,
  modelName: string = 'gemini-3.1-pro-preview',
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert academic note-writer.
    Task: Below is the BEGINNING of a spoken class/lecture transcript. From it, infer the overall subject and produce ONLY:
      1. A single main title as <h1> — a clean, descriptive title of the whole class topic. NO number, NO "Part 1".
      2. Immediately after it, one overview box:
         <div class="key-point"><strong>Overview:</strong> a 2–4 line at-a-glance summary of what this class covers.</div>

    Language: ${language}
    Transcript start:
    """${firstChunk.slice(0, 6000)}"""

    Output: Return ONLY the raw HTML for the <h1> and the overview div. No markdown, no code fences, nothing else.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: NOTES_GEN_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
};

/**
 * Step 2… — turn ONE transcript chunk into fully detailed, structured study
 * notes. The prompt is deliberately aggressive about completeness: a lecture
 * transcript is dense with facts, examples and asides, and the whole point of
 * this feature is that none of them are lost.
 */
export const generateNotesFromTranscriptChunk = async (
  chunkText: string,
  part: number,
  total: number,
  language: string,
  modelName: string = 'gemini-3.1-pro-preview',
  isFirst: boolean = false,
  startSectionNumber: number = 1,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Convert the following segment of a SPOKEN class/lecture transcript into the MOST DETAILED, structured, revision-ready study notes possible.

    Context: This is segment ${part} of ${total} of one continuous class. The text is spoken language — it contains filler words, repetitions, "umm/so/okay", greetings and small tangents.

    Language: ${language}
    Transcript segment:
    """${chunkText}"""

    **ABSOLUTE COMPLETENESS RULE (most important):**
    - Capture EVERY concept, fact, date, number, name, definition, formula, example, analogy, list, cause/effect and question the teacher mentions in this segment. Do NOT skip or merge points.
    - This is NOT a summary. Do NOT shorten or compress. Where the teacher explained something briefly, EXPAND it into a clear, complete explanation so each point is understandable on its own.
    - Drop ONLY the spoken noise: filler words, repetitions, greetings, "let's take a break", off-topic chatter. Keep 100% of the actual teaching.

    **STRUCTURE:**
    - Use numbered headings that CONTINUE the document: your first <h2> for this segment must be numbered ${startSectionNumber}, then ${startSectionNumber + 1}, and so on. Break into <h3>/<h4> sub-points where the content is layered.
    - ${isFirst ? 'Do NOT add a document <h1> title — it has already been created; start directly with the first <h2> section.' : 'Do NOT repeat the document title or any overview — just continue with the next <h2> sections.'}
    - Do NOT add a "Summary", "Conclusion", "Takeaways" or "Revision" section — keep it pure detailed content.

    **DEPTH & FORMATTING:**
    1. Every heading is followed by real explanation — never an empty or one-line heading. Say what it is, why it matters, how it works, with the concrete facts from the transcript.
    2. Break explanations into <ul><li> points; each bullet is a full, informative sentence — never 2–3 words.
    3. Use <strong> for key terms / dates / figures / names.
    4. Use <div class="key-point"><strong>Key Concept:</strong> …</div> for vital definitions, and <div class="note-box">…</div> for important extra facts, exceptions or examples the teacher stressed.
    5. Add a <table> whenever the segment compares things, lists categories, or presents data.
    6. Add ONE clean SVG diagram inside <div class="flowchart-container"> (no border on the SVG, use viewBox) whenever the segment describes a process, hierarchy, timeline or relationship that a visual would clarify. Keep it readable and responsive.

    **Output:** Return ONLY raw HTML. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
};
