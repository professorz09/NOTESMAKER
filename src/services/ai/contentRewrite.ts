import { createAIClient, cleanHtmlOutput, buildContents, NOTES_GEN_CONFIG, withGoogleSearch } from './client';

// Shared "use live search" line — appended when the editor's own Grounding
// toggle is on for this edit (independent of the sidebar pipeline's toggle).
const GROUNDING_LINE =
  'You have live Google Search access for this call — where the content genuinely benefits from a current fact (a scheme\'s latest status, recent statistics, a recent event), search and weave in the real, current, correctly-dated fact.';

// Shared "the instruction is law" directive for the general-purpose Rewrite
// tab (rewriteContent / rewriteSection) — this is the option users reach for
// most, typing free-form asks like "bigger", "make this a table", "shorter",
// "explain in more detail". A vague "obey the instruction" rule left the
// model free to fall back to its own default rewrite style whenever the ask
// didn't look like a textbook "short vs detailed" request; spelling out the
// concrete transformations removes that wiggle room.
const INSTRUCTION_IS_LAW = (subject: string) => `
    **THE INSTRUCTION IS THE ONLY SPEC — obey it literally, even if that means
    changing the structure, format, length or tone completely. Do not fall
    back to any default style; do exactly, specifically, what is asked.**

    Common requests and what they mean (apply whichever matches what was
    asked — this list is illustrative, not exhaustive; if the instruction
    asks for something not listed, still do exactly that):
    - "bigger / expand / more detail / elaborate / lamba karo / bada karo" → substantially lengthen ${subject}: add real depth — sub-points, mechanisms, concrete examples, facts — genuinely more substance, not just more words.
    - "shorter / short / summarize / summary / chota karo" → substantially shorten ${subject}: keep only the essential points, cut everything else.
    - "make it a table / table bana do / convert to table" → restructure ${subject} ENTIRELY into one HTML <table> with <thead><tr><th> and <tbody><tr><td>, choosing sensible columns from the content. Do not keep the old paragraph/list alongside it — the table IS the new content.
    - "make it a list / bullet points / points me likho" → restructure ${subject} into <ul><li> bullets, one clear point per <li>.
    - "simpler language / easy words / simple bhasha me" → simplify vocabulary and sentence length while keeping every fact intact.
    - "add an example / example do" → keep the existing content and add one or more concrete real-world examples.
    - "rewrite / rephrase" (no other qualifier) → keep the same length, structure and meaning, just reword it.
`;

export const rewriteContent = async (
  textToRewrite: string,
  instruction: string,
  modelName: string = "gemini-3.1-flash-lite",
  images?: { base64: string; mimeType: string }[],
  grounded: boolean = false,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
      Role: Expert Academic Editor executing a precise, literal edit request.
      Task: Transform the selected text below according to the user's instruction.

      Input: "${textToRewrite}"
      User Instruction: "${instruction}"
      ${INSTRUCTION_IS_LAW('this text')}
      **Fallbacks — ONLY apply where the instruction doesn't already say otherwise:**
      - Structure: keep the original structure (prose/list/etc.) if the instruction doesn't imply a different one.
      - Tone: professional and academic.
      - Formatting: <strong> for key terms.
      ${grounded ? '- ' + GROUNDING_LINE : ''}

      Return ONLY the resulting HTML for this text. No commentary, no markdown fences.
    `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images),
    config: withGoogleSearch(NOTES_GEN_CONFIG, grounded),
  });

  return cleanHtmlOutput(response.text || textToRewrite);
};

export const rewriteSection = async (
  sectionContent: string,
  instruction: string,
  modelName: string = "gemini-3.1-flash-lite",
  images?: { base64: string; mimeType: string }[],
  grounded: boolean = false,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Senior Editor executing a precise, literal edit request.
    Task: Transform the HTML section below according to the user's instruction.

    Input HTML Structure (Tree):
    ${sectionContent}

    Instruction: "${instruction}"
    ${INSTRUCTION_IS_LAW('this section')}
    **Fallbacks — ONLY apply where the instruction doesn't already say otherwise:**
    - Structure/numbering: keep the existing numbering (e.g., 1.1) as a baseline ONLY if the instruction doesn't call for a different structure (like a table or a plain list) — a structural instruction always wins over preserving numbering.
    - Tone: academic and authoritative.
    ${grounded ? '- ' + GROUNDING_LINE : ''}

    Output: Valid HTML only, no commentary, no markdown fences.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images),
    config: withGoogleSearch(NOTES_GEN_CONFIG, grounded),
  });
  return cleanHtmlOutput(response.text || "");
};

export const expandSection = async (
  sectionContent: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview",
  images?: { base64: string; mimeType: string }[],
  grounded: boolean = false,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Academic Researcher.
    Task: DEEP DIVE & EXPAND the selected section.

    Input HTML:
    ${sectionContent}

    Instruction: "${instruction}"

    **CRITICAL RULES — READ FIRST:**
    0. **PRESERVE THE HEADING:** The Input HTML starts with a heading element (h1/h2/h3/h4). You MUST output that EXACT heading element (same tag, same number, same text) as the VERY FIRST element of your output. NEVER remove, rename, or skip it.
    1. **ALL content goes AFTER the heading.** Do not insert any content before the heading.
    2. **High Density:** Maximize information per page. Avoid fluff.
    3. **Structure:** Explode bullet points into full sub-sections (convert 1.1 into 1.1.1, 1.1.2, 1.1.3).
    4. **Tables:** Add a table where it saves space and increases clarity. Choose the most appropriate format:
       • Comparison Matrix, Timeline (Year | Event | Impact), Pros & Cons, Factor Analysis,
         Feature Matrix, Data/Statistics, Process Steps — whichever best fits the content being expanded.
       Use <thead><th>, <tbody><td>, <ul><li> inside cells, <strong> for key terms.
    5. **Diagram (Optional):** If the expanded content has a clear process, cycle, or relationship, add ONE SVG diagram inside <div class="flowchart-container">. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
    6. **Volume:** Significantly increase depth of knowledge, not just word count.
    ${grounded ? '7. **Current facts:** ' + GROUNDING_LINE : ''}

    Output: Valid HTML only. Start directly with the heading element.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images),
    config: withGoogleSearch(NOTES_GEN_CONFIG, grounded),
  });
  return cleanHtmlOutput(response.text || "");
};

export const generateNextContent = async (
  previousContext: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview",
  images?: { base64: string; mimeType: string }[],
  grounded: boolean = false,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert Co-Author / Ghostwriter.
    Task: Seamlessly continue the document by adding further sub-points and detailed explanations.

    **Context (The incomplete chapter):**
    ${previousContext}

    **User Request (What to add next):**
    "${instruction}"

    **Execution Rules:**
    1. **Sub-point Continuity:** Focus on adding the "next" sub-points or deeper details for the current topic.
    2. **Logical Flow:** Start writing exactly where the previous context ended.
    3. **Smart Numbering:**
       - If the last point was 1.2.1, continue with 1.2.2, 1.2.3, etc.
       - If the current section is finished, move to the next logical sub-heading (e.g., from 1.2 to 1.3).
    4. **High Density:** Maintain a professional, academic, high-fact-density tone.
    5. **Formatting:** Use <strong> for key terms. <div class="note-box"> is a rare exception for one genuinely noteworthy fact, not a routine habit.
    6. **Table (Optional):** If a section being added has structured/comparative data, include ONE appropriately-formatted table.
    7. **Diagram (Optional):** If the new content has a clear visual structure, add ONE SVG inside <div class="flowchart-container">. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
    ${grounded ? '8. **Current facts:** ' + GROUNDING_LINE : ''}

    Output: Return ONLY the HTML for the NEW content.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images),
    config: withGoogleSearch(NOTES_GEN_CONFIG, grounded),
  });
  return cleanHtmlOutput(response.text || "");
};

export const generateDetailedNextTopic = async (
  previousContext: string,
  topicName: string,
  modelName: string = "gemini-3.1-pro-preview",
  images?: { base64: string; mimeType: string }[],
  grounded: boolean = false,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Senior Professor & Textbook Author.
    Task: Create a completely NEW MAJOR TOPIC after the current sub-topics are finished.

    **Previous Context (to ensure we don't repeat and for numbering):**
    ${previousContext}

    **Target New Topic:** "${topicName}"

    **EXECUTION RULES:**
    1. **New Topic Start:** This should be a fresh start. If the last context was about "Topic A", this should be about "Topic B".
    2. **Numbering:** Detect the last MAJOR heading number (e.g., 1.0 or 2.0) and start this as the next major section (e.g., 2.0 or 3.0).
    3. **Structure:** Use <h1> or <h2> for the new topic title, followed by detailed sub-sections (2.1, 2.1.1, etc.).
    4. **Depth:** Provide comprehensive coverage of this new topic.
    5. **Visual Aids:** <div class="note-box"> is a rare exception for one genuinely noteworthy fact, not routine.
    6. **Table (Optional):** If the topic benefits from structured data, include ONE appropriate table with <caption>.
    7. **Diagram (Optional):** If the topic has a clear visual structure, include ONE SVG inside <div class="flowchart-container">. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
    8. **Tone:** Professional academic tone.
    ${grounded ? '9. **Current facts:** ' + GROUNDING_LINE : ''}

    Output: HTML for the new MAJOR section only.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images),
    config: withGoogleSearch(NOTES_GEN_CONFIG, grounded),
  });
  return cleanHtmlOutput(response.text || "");
};
