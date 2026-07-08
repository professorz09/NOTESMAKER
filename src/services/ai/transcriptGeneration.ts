import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG } from './client';
import { parseOutlineSectionsJson, type OutlineSection } from './outlineParsing';
import { buildRefinementDirective, type RefinementOptions } from './refinement';

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

// Last-resort split: pure word-count slicing, no punctuation required. Used
// as a safety net so a chunk can never balloon past maxWords even when the
// text has too little punctuation for the paragraph/sentence passes below to
// find a break point (e.g. raw YouTube auto-captions, which often come back
// as one continuous blob with no periods at all).
function splitByWordCount(text: string, maxWords: number): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return [text];
  const out: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) out.push(words.slice(i, i + maxWords).join(' '));
  return out;
}

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
        // A single "sentence" that's ALREADY over budget (common when the
        // text has too few/no [.!?।] marks to split on) must still be
        // flushed on its own — otherwise it silently absorbs everything
        // after it too, collapsing what should be many chunks into one.
        if (scw + sw > maxWords && sc.length) {
          chunks.push(sc.join(' '));
          sc = [];
          scw = 0;
        }
        sc.push(s);
        scw += sw;
        if (sw > maxWords) {
          chunks.push(sc.join(' '));
          sc = [];
          scw = 0;
        }
      }
      if (sc.length) chunks.push(sc.join(' '));
      continue;
    }

    if (currentWords + w > maxWords && current.length) flush();
    current.push(para);
    currentWords += w;
  }
  flush();

  const result = chunks.length ? chunks : [clean];
  // Hard safety net: whatever the source punctuation looked like, no chunk
  // handed to the AI may exceed maxWords — a chunk that's too big is exactly
  // what causes the output-token cap to truncate mid-way and produce patchy,
  // badly-structured notes on long/dense transcripts.
  return result.flatMap(c => splitByWordCount(c, maxWords));
}

/**
 * Optional pre-step — clean up ONE chunk of the raw draft transcript before
 * it ever reaches the notes pipeline. A pasted/fetched transcript is chunked
 * purely to survive the output-token cap, so chunk boundaries land wherever
 * the word count runs out — mid-sentence, mid-thought — and captions/pasted
 * text are often already broken, run-together or unpunctuated. Feeding that
 * straight into the notes pipeline is exactly why the resulting notes come
 * out patchy: this pass fixes the prose (grammar, punctuation, paragraphing)
 * WITHOUT summarising, shortening or dropping a single point — the pipeline
 * step after this still has to find every fact, so nothing may be lost here.
 */
export const restructureTranscriptChunk = async (
  chunkText: string,
  part: number,
  total: number,
  language: string,
  modelName: string = 'gemini-3.1-pro-preview',
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Meticulous transcript editor.
    Task: Below is segment ${part} of ${total} of a raw spoken video/class transcript. It was mechanically split into segments purely to fit processing limits, and the raw text itself may be disjointed — broken sentences, missing punctuation, run-together words, stray line breaks — because it comes straight from captions or a rough paste, not because the speaker was disorganised.

    Rewrite this segment as clean, smoothly-flowing, properly punctuated prose in the same language and essentially the same wording the speaker used. This is a CLEANUP pass, not a summary and not a notes pass.

    Language: ${language}
    Transcript segment:
    """${chunkText}"""

    **ABSOLUTE RULE — DO NOT LOSE ANY POINT:**
    - Do NOT summarize, shorten, compress, paraphrase away detail, or drop ANY concept, fact, date, number, name, definition, example or aside. Every idea present must still be present, in full.
    - It is far better to leave something slightly rough than to delete it. When in doubt, keep it.
    - You may only remove pure spoken noise that carries zero information: stutters, filler ("umm", "so", "okay so"), exact word repetitions, greetings. Never remove something because it was said quickly, in passing, or as an aside — those are exactly the points that go missing later.

    **WHAT TO FIX:**
    - Join fragments into complete sentences, each ending in proper punctuation (. ! ? or ।) — this matters mechanically, not just stylistically: the next step re-splits this text using that punctuation, so a long run without any full stop will not get split correctly.
    - Group the text into logical paragraphs by topic, in the order it was spoken, and separate each paragraph from the next with a BLANK LINE (an empty line between paragraphs) — do not reorder distant topics or merge separate points into one run-on paragraph.
    - Fix obvious mis-splits/typos from captioning, but never change the meaning or substitute your own facts.

    **DO NOT:**
    - Do not add headings, numbering, HTML, markdown, bullet points, or any commentary/introduction/conclusion of your own.
    - Do not add an opening or closing line — this is segment ${part} of ${total} of one continuous recording; just continue the cleaned text naturally.

    Output: Return ONLY the cleaned plain-text prose for this segment. No markdown, no code fences, no HTML tags.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: NOTES_GEN_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
};

/**
 * Step 1 — read the opening of the lecture and produce just the document
 * title (<h1>, no number). Small, fast call.
 */
export const generateTranscriptTitle = async (
  firstChunk: string,
  language: string,
  modelName: string = 'gemini-3.1-pro-preview',
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert academic note-writer.
    Task: Below is the BEGINNING of a spoken class/lecture transcript. From it, infer the overall subject and produce ONLY a single main title as <h1> — a clean, descriptive title of the whole class topic. NO number, NO "Part 1", nothing else.

    Language: ${language}
    Transcript start:
    """${firstChunk.slice(0, 6000)}"""

    Output: Return ONLY the raw HTML for the <h1>. No markdown, no code fences, nothing else.
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
    - Watch especially for content that's easy to lose because it's mentioned only once or in passing: an example given quickly, a definition dropped mid-sentence, a number or date said once without emphasis, a side-comparison, an aside the teacher adds and moves on from, something said right before/after a topic change. These are exactly the kind of things that go missing — deliberately scan for them, don't just follow the main thread.
    - Drop ONLY the spoken noise: filler words, repetitions, greetings, "let's take a break", off-topic chatter. Keep 100% of the actual teaching.
    - Before finishing, mentally re-scan the transcript segment once more against your draft and confirm nothing substantive was left out.

    **STRUCTURE:**
    - Use numbered headings that CONTINUE the document: your first <h2> for this segment must be numbered ${startSectionNumber}, then ${startSectionNumber + 1}, and so on. Break into <h3>/<h4> sub-points where the content is layered.
    - ${isFirst ? 'Do NOT add a document <h1> title — it has already been created; start directly with the first <h2> section.' : 'Do NOT repeat the document title or any overview — just continue with the next <h2> sections.'}
    - Do NOT add a "Summary", "Conclusion", "Takeaways" or "Revision" section — keep it pure detailed content.

    **DEPTH & PRESENTATION:**
    1. Explain every point properly and in depth — the reader must actually understand and remember it. Every heading is followed by real explanation (what it is, why it matters, how it works, with the concrete facts from the transcript); never an empty or one-line heading, and never dispose of a point in a single passing line.
    2. When you use bullets, each <li> is a full, informative sentence — never 2–3 words. Use <strong> for key terms / dates / figures / names.
    3. Present each part in whatever form explains it best — flowing prose, bulleted breakdowns, a comparison <table>, or ONE clean SVG diagram in <div class="flowchart-container"> (no border, use viewBox). Use any of these only because it genuinely aids understanding here, never to fill a quota; you decide based on the content.

    **Output:** Return ONLY raw HTML. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
};

// ---------------------------------------------------------------------------
// Leveled transcript pipeline (Medium / Detailed / Deep).
//
// Instead of turning each chunk straight into prose, the leveled pipeline
// first builds the SKELETON of the whole video — every topic + sub-point the
// teacher covers — then expands that structure segment by segment. This gives
// a proper hierarchical structure (and a live mind map), while still processing
// chunk-by-chunk so nothing is dropped from a multi-hour class.
// ---------------------------------------------------------------------------

export type TranscriptSection = OutlineSection;

/**
 * Phase 1 — extract the structured skeleton (topics + sub-points) the teacher
 * covers in ONE transcript segment. No explanation yet, just the structure.
 */
export const outlineTranscriptChunk = async (
  chunkText: string,
  part: number,
  total: number,
  language: string,
  modelName: string,
): Promise<TranscriptSection[]> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert note-structurer.
    Task: Below is segment ${part} of ${total} of a SPOKEN class/lecture transcript. Extract the STRUCTURED OUTLINE of every topic and key sub-point the teacher actually covers in THIS segment — the skeleton of all points, in the order taught. Ignore filler, greetings and off-topic tangents. Do NOT explain anything yet; only the structure.

    This structure is what the NEXT step will be limited to explaining — anything you leave out here will not make it into the final notes. So err on the side of including a sub-point rather than dropping it, including things mentioned only briefly, in passing, or as an aside — a quick example, a definition dropped mid-sentence, a number said once, a side-comparison. Do not silently fold two distinct points into one heading.

    Language for headings: ${language}
    Transcript segment:
    """${chunkText}"""

    Output STRICT JSON ONLY (no markdown/code fences):
    { "sections": [ { "heading": "specific topic", "subheadings": ["specific sub-point", "..."] } ] }

    Capture EVERY real point — do not merge or drop any. Headings must be concrete and specific to what was actually said, never generic placeholders.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: NOTES_GEN_CONFIG,
  });

  return parseOutlineSectionsJson(response.text || '');
};

/**
 * Phase 2 — expand ONE segment into detailed, structured notes that follow the
 * segment's outline, drawing all content from the transcript text. Depth scales
 * with the chosen level (Deep expands sub-points into their own sub-sections).
 */
export const expandTranscriptChunkStructured = async (
  chunkText: string,
  sections: TranscriptSection[],
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
    ? 'Go MAXIMALLY deep on every point AND sub-point: full explanation, mechanism, and every fact, date, number, name, definition and example the teacher stated — expand each sub-point into its own <h4> where it has parts. Miss nothing.'
    : level === 'detailed'
      ? 'Explain every point and sub-point thoroughly, with the concrete facts and examples from the transcript.'
      : 'Give each point a solid, clear explanation using the key facts from the transcript.';

  const outlineList = sections
    .map((s, i) => `${startSectionNumber + i}. ${s.heading}${s.subheadings.length ? ' — ' + s.subheadings.join('; ') : ''}`)
    .join('\n');

  const prompt = `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Write DETAILED, structured study notes for segment ${part} of ${total} of a class transcript, following the outline below. Draw ALL content from the transcript segment — capture every fact, date, number, name, definition and example the teacher stated. This is NOT a summary; do not shorten or drop points.

    Language: ${language}

    Outline to follow (number the sections continuing from ${startSectionNumber}):
    ${outlineList}

    Transcript segment (your source):
    """${chunkText}"""

    ${depth}

    COMPLETENESS SAFETY NET: the outline above was extracted separately and may itself have missed something small. While writing, re-read the transcript segment against it — if you spot a real point (a fact, example, definition, aside) the outline doesn't cover, still include it under the most relevant heading (or as its own <h3>/<h4>) rather than silently dropping it because it wasn't listed.

    FORMAT:
    - <h2>${startSectionNumber}. …</h2> for each outline section (continue the numbering), <h3>${startSectionNumber}.1 …</h3> for its sub-points, <h4> for a further level where needed.
    - Explain every point in depth — never dispose of a sub-point in a single passing line. Full-sentence <ul><li> bullets, <strong> for key terms/dates/figures.
    - Present each part in whatever form explains it best — prose, bulleted breakdowns, a comparison <table>, or ONE clean SVG in <div class="flowchart-container"> (no border, use viewBox). Use these only where they genuinely aid understanding, never to fill a quota — you decide.
    - Do NOT add a document <h1> title or overview (already present). No filler, no empty headings.
    ${buildRefinementDirective(refine)}
    Output: Return ONLY raw HTML. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
};
