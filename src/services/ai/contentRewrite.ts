import { createAIClient, cleanHtmlOutput, buildContents } from './client';

export const rewriteContent = async (
  textToRewrite: string,
  instruction: string,
  modelName: string = "gemini-3-flash-preview",
  images?: { base64: string; mimeType: string }[]
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
      Role: Expert Academic Editor.
      Task: Modify the selected text EXACTLY according to the user's instruction.

      Input: "${textToRewrite}"
      User Instruction: ${instruction}

      **Rules:**
      1. **OBEY THE INSTRUCTION:** If the user asks to make it "short", make it very concise. If they ask for "detailed and structured", add comprehensive details, bullet points, and subheadings. If they ask to just "rewrite" or "rephrase", keep the same length and meaning but change the wording. DO EXACTLY WHAT IS ASKED.
      2. **Structure:** If the instruction implies a new structure (e.g., table, list, paragraphs), use it. Otherwise, maintain the original structure.
      3. **Tone:** Professional and academic, unless the instruction specifies a different tone.
      4. **Formatting:** Use <strong> for key terms. Use <div class="key-point"> for definitions, if applicable and appropriate for the requested length/style.

      Return ONLY the HTML.
    `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images),
  });

  return cleanHtmlOutput(response.text || textToRewrite);
};

export const rewriteSection = async (
  sectionContent: string,
  instruction: string,
  modelName: string = "gemini-3-flash-preview",
  images?: { base64: string; mimeType: string }[]
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Senior Editor.
    Task: Modify the HTML section EXACTLY according to the user's instruction.

    Input HTML Structure (Tree):
    ${sectionContent}

    Instruction: "${instruction}"

    **CRITICAL CONSTRAINTS:**
    1. **OBEY THE INSTRUCTION:** If the user asks for a "short summary", provide a very concise summary. If they ask for a "detailed structure", expand it with sub-points, lists, and deep explanations. If they ask to just "rewrite", rephrase it without changing the length drastically. DO EXACTLY WHAT IS ASKED.
    2. **Hierarchy:** Preserve the existing numbering structure (e.g., 1.1) as a baseline, but adapt it (add sub-points, or condense) based strictly on the user's instruction.
    3. **Tone:** Academic and authoritative, unless the instruction specifies otherwise.

    Output: Valid HTML only.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images)
  });
  return cleanHtmlOutput(response.text || "");
};

export const expandSection = async (
  sectionContent: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview",
  images?: { base64: string; mimeType: string }[]
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

    Output: Valid HTML only. Start directly with the heading element.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images)
  });
  return cleanHtmlOutput(response.text || "");
};

export const generateNextContent = async (
  previousContext: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview",
  images?: { base64: string; mimeType: string }[]
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
    5. **Formatting:** Use <strong>, <div class="key-point">, <div class="note-box"> where appropriate.
    6. **Table (Optional):** If a section being added has structured/comparative data, include ONE appropriately-formatted table.
    7. **Diagram (Optional):** If the new content has a clear visual structure, add ONE SVG inside <div class="flowchart-container">. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.

    Output: Return ONLY the HTML for the NEW content.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images)
  });
  return cleanHtmlOutput(response.text || "");
};

export const generateDetailedNextTopic = async (
  previousContext: string,
  topicName: string,
  modelName: string = "gemini-3.1-pro-preview",
  images?: { base64: string; mimeType: string }[]
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
    5. **Visual Aids:** Use <div class="key-point">, <div class="note-box"> where relevant.
    6. **Table (Optional):** If the topic benefits from structured data, include ONE appropriate table with <caption>.
    7. **Diagram (Optional):** If the topic has a clear visual structure, include ONE SVG inside <div class="flowchart-container">. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
    8. **Tone:** Professional academic tone.

    Output: HTML for the new MAJOR section only.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images)
  });
  return cleanHtmlOutput(response.text || "");
};
