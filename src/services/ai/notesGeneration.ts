import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG, RESEARCH_GEN_CONFIG } from './client';

export const generateFormattedNotes = async (
  rawText: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview",
  outputStyle: 'notes' | 'upsc' | 'research' = 'notes',
  wordLimit: number = 250
): Promise<string> => {
  const ai = createAIClient();

  const prompt = outputStyle === 'upsc' ? `
    Role: UPSC Topper & Expert Evaluator.
    Task: Format the provided notes into a high-scoring, perfectly structured UPSC Mains answer.

    Input Text: ${rawText}
    Language: ${language}
    Word Limit: Approximately ${wordLimit} words.

    **STRICT STRUCTURE & FORMATTING RULES (Like a Topper's Copy):**
    1. **Introduction (Bhumika):** Crisp, fact-based, or definition-based start.
    2. **Body (Mukhya Bhag):**
       - Break down into clear sub-headings based on the content.
       - Use bullet points for readability.
       - Highlight key terms using <strong>.
    3. **Data/Facts/Committees (Optional):** Sprinkle relevant data if applicable. Use <div class="note-box">...</div> for highlighting facts.
    4. **Visual Elements (Optional):**
       - Include a **Table** for comparison or data presentation if relevant.
       - Include an **SVG Diagram/Mindmap/Flowchart** inside a <div class="flowchart-container"> ONLY if it helps visualize the content. Ensure the SVG is clean, readable, and responsive (use viewBox). **DO NOT** include a border on the SVG itself.
    5. **Conclusion (Nishkarsh):** Forward-looking, optimistic, and balanced conclusion.

    **WORD COUNT CONSTRAINT:**
    The total answer length MUST be strictly around ${wordLimit} words. Adjust the depth of each section to meet this limit while maintaining high quality.

    **Output:** Return ONLY raw HTML. Do not wrap in markdown blocks.
  ` : outputStyle === 'research' ? `
    Role: Expert Academic Researcher & Author.
    Task: Format the provided notes into a highly detailed, deeply researched, and visually structured Research Paper.

    Input Text: ${rawText}
    Language: ${language}

    **STRICT STRUCTURE & FORMATTING RULES:**
    1. **Abstract & Introduction:** Start with a comprehensive abstract, context, and the core thesis.
    2. **Literature Review & Methodology (Body):**
       - Break down into logical academic sections.
       - Use extensive bullet points for readability.
       - Highlight key terms, dates, and authors using <strong>.
    3. **Data & Evidence (Tables):** Include at least one detailed HTML <table> presenting relevant data, statistics, or comparisons from the text.
    4. **Visual Explanation (Diagram):** Include ONE highly detailed SVG diagram inside a <div class="flowchart-container"> to visually explain a complex process, relationship, or framework from the text. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
    5. **Conclusion:** Summarize the findings, impact, and future scope.

    **Output:** Return ONLY raw HTML. Do not wrap in markdown blocks.
  ` : `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Convert the input into the MOST DETAILED, IN-DEPTH and PERFECTLY STRUCTURED study notes possible. Don't just reformat — enrich and explain. Cover every point present in the input, and add the depth, context and facts needed to make each point fully understandable and revision-ready on its own.

    Input Text: ${rawText}
    Language: ${language}

    **STUDY-NOTES FORMAT:**
    - Begin with <div class="key-point"><strong>Overview:</strong> 2–4 line at-a-glance summary.</div>
    - Then the deep numbered body.
    - End with <div class="note-box"><strong>Quick Revision:</strong> 6–10 crisp one-line takeaways.</div>
    - Teaching style: state each concept simply first, then go deep with details and a short concrete example ("e.g., …").

    **RULES:**
    1. **Structure:** Strict hierarchical numbered tree (1. → 1.1 → 1.1.1 → 1.1.1.1) using <h1>/<h2>/<h3>/<h4>. Go deep where the content supports it.
    2. **Depth on every point:** Every sub-heading must be followed by real, complete explanation — never an empty or one-line heading. Explain what it is, why it matters and how it works, with concrete facts (dates, numbers, names, examples).
    3. **Bullets:** Break explanations into clear <ul><li> points; each bullet is a full, informative sentence, not 2–3 words.
    4. **Completeness:** Do NOT drop any topic from the input. If the input is brief, expand each point with accurate supporting detail and context.
    5. **Density:** No conversational filler or padding — maximum facts per line.
    6. **Formatting:** Use <strong> for key terms/dates/figures, <div class="key-point"><strong>Key Concept:</strong> …</div> for vital definitions, and <div class="note-box">…</div> for important extra facts/exceptions.
    7. **Visuals:** Add ONE clean SVG diagram inside <div class="flowchart-container"> (no border, use viewBox) and/or a well-chosen <table> wherever it genuinely aids understanding.

    **Output:** Return ONLY raw HTML. No markdown, no code fences.
  `;

  const config: any = outputStyle === 'research'
    ? { ...RESEARCH_GEN_CONFIG, tools: [{ googleSearch: {} }] }
    : { ...DETAILED_NOTES_CONFIG };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config,
  });

  return cleanHtmlOutput(response.text || "");
};

export const generateFileNotes = async (
  files: { data: string; mimeType: string }[],
  language: string,
  modelName: string = "gemini-3.1-pro-preview",
  outputStyle: 'notes' | 'upsc' | 'research' = 'notes',
  wordLimit: number = 250
): Promise<string> => {
  const ai = createAIClient();

  const prompt = outputStyle === 'upsc' ? `
    Role: UPSC Topper & Expert Evaluator.
    Task: Analyze the provided files and generate a high-scoring, perfectly structured UPSC Mains answer based on the content.

    Language: ${language}
    Word Limit: Approximately ${wordLimit} words.

    **STRICT STRUCTURE & FORMATTING RULES (Like a Topper's Copy):**
    1. **Introduction (Bhumika):** Crisp, fact-based, or definition-based start.
    2. **Body (Mukhya Bhag):**
       - Break down into clear sub-headings based on the content.
       - Use bullet points for readability.
       - Highlight key terms using <strong>.
    3. **Data/Facts/Committees (Optional):** Sprinkle relevant data if relevant. Use <div class="note-box">...</div> for highlighting facts.
    4. **Visual Elements (Optional):**
       - Include a **Table** for comparison or data presentation if it adds value.
       - Include an **SVG Diagram/Mindmap/Flowchart** inside a <div class="flowchart-container"> ONLY if it helps explain the content. Ensure the SVG is clean, readable, and responsive (use viewBox). **DO NOT** include a border on the SVG itself.
    5. **Conclusion (Nishkarsh):** Forward-looking, optimistic, and balanced conclusion.

    **WORD COUNT CONSTRAINT:**
    The total answer length MUST be strictly around ${wordLimit} words. Adjust the depth of each section to meet this limit while maintaining high quality.

    **Output:** Return ONLY raw HTML. Do not wrap in markdown blocks.
  ` : outputStyle === 'research' ? `
    Role: Expert Academic Researcher & Author.
    Task: Analyze the provided files and generate a highly detailed, deeply researched, and visually structured Research Paper.

    Language: ${language}

    **STRICT STRUCTURE & FORMATTING RULES:**
    1. **Abstract & Introduction:** Start with a comprehensive abstract, context, and the core thesis based on the files.
    2. **Literature Review & Methodology (Body):**
       - Break down into logical academic sections.
       - Use extensive bullet points for readability.
       - Highlight key terms, dates, and authors using <strong>.
    3. **Data & Evidence (Tables):** Include at least one detailed HTML <table> presenting relevant data, statistics, or comparisons from the files.
    4. **Visual Explanation (Diagram):** Include ONE highly detailed SVG diagram inside a <div class="flowchart-container"> to visually explain a complex process, relationship, or framework from the files. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
    5. **Conclusion:** Summarize the findings, impact, and future scope.

    **Output:** Return ONLY raw HTML. Do not wrap in markdown blocks.
  ` : `
    Role: Senior Subject-Matter Expert & Textbook Author.
    Task: Analyze the provided files and generate the MOST DETAILED, IN-DEPTH and PERFECTLY STRUCTURED study notes possible from their content. Extract EVERY important point from the files and explain each one in depth — don't just summarize headings.

    Language: ${language}

    **STUDY-NOTES FORMAT:**
    - Begin with <div class="key-point"><strong>Overview:</strong> 2–4 line at-a-glance summary of the material.</div>
    - Then the deep numbered body.
    - End with <div class="note-box"><strong>Quick Revision:</strong> 6–10 crisp one-line takeaways.</div>
    - Teaching style: state each concept simply first, then go deep with details and a short concrete example ("e.g., …").

    **RULES:**
    1. **Structure:** Strict hierarchical numbered tree (1. → 1.1 → 1.1.1 → 1.1.1.1) using <h1>/<h2>/<h3>/<h4>. Go deep where the content supports it.
    2. **Depth on every point:** Every sub-heading must be followed by real, complete explanation — never an empty or one-line heading. Cover what it is, why it matters and how it works, with concrete facts (dates, numbers, names, examples) taken from the files.
    3. **Bullets:** Break explanations into clear <ul><li> points; each bullet is a full, informative sentence.
    4. **Completeness:** Do NOT skip any section, table, figure or important detail present in the files. Capture all of it.
    5. **Density:** No filler or padding — maximum facts per line.
    6. **Formatting:** Use <strong> for key terms/dates/figures, <div class="key-point"><strong>Key Concept:</strong> …</div> for vital definitions, and <div class="note-box">…</div> for important extra facts/exceptions.
    7. **Visuals:** Add ONE clean SVG diagram inside <div class="flowchart-container"> (no border, use viewBox) and/or a well-chosen <table> wherever it genuinely aids understanding.

    **Output:** Return ONLY raw HTML. No markdown, no code fences.
  `;

  const parts: any[] = files.map(f => ({ inlineData: { data: f.data, mimeType: f.mimeType } }));
  parts.push({ text: prompt });

  const config: any = outputStyle === 'research'
    ? { ...RESEARCH_GEN_CONFIG, tools: [{ googleSearch: {} }] }
    : { ...DETAILED_NOTES_CONFIG };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config,
  });

  return cleanHtmlOutput(response.text || "");
};

export const generateOnePagerNotes = async (
  topic: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert Academic Note-Writer.
    Task: Create ULTRA-COMPACT, SINGLE-PAGE notes for the given topic that are dense with information but easy to scan.
    Language: ${language}
    Topic: "${topic}"

    **STRICT ONE-PAGER DESIGN RULES:**
    Wrap everything inside: <div class="one-pager-card">

    1. **Header block** (required):
       <div class="op-header">
         <h2 class="op-title">[Topic Name]</h2>
         <div class="op-meta">[Subject/Category] • [2-3 word tagline]</div>
       </div>

    2. **Content layout** — use a 2-column grid where possible:
       <div class="op-grid">
         <div class="op-col">...</div>
         <div class="op-col">...</div>
       </div>

    3. **Section types to use** (mix them as appropriate):
       - Key facts list: <div class="op-section"><h4 class="op-section-title">📌 Key Facts</h4><ul class="op-list">...</ul></div>
       - Important dates/numbers: <div class="op-section"><h4 class="op-section-title">📅 Important Dates</h4>...</div>
       - Definitions: <div class="op-section"><h4 class="op-section-title">📖 Key Terms</h4>...</div>
       - Causes/Effects: <div class="op-section"><h4 class="op-section-title">⚡ Causes & Effects</h4>...</div>
       - ONE compact table (if adds value): <table class="op-table">...</table>
       - Quick summary box: <div class="op-summary">...</div>

    4. **Density rules:**
       - No fluff sentences — only direct, factual points
       - Use <strong> for critical terms/numbers/years
       - Bullet points max 6-8 words each — ultra-brief
       - Pack maximum information — at least 30-40 key facts/points
       - Include actual data: years, article numbers, percentages, names

    5. Close with: </div> (closing the one-pager-card)

    **Output:** Return ONLY raw HTML. No markdown, no explanations. Start directly with <div class="one-pager-card">.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: NOTES_GEN_CONFIG,
  });
  return cleanHtmlOutput(response.text || "");
};
