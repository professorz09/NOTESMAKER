import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const createAIClient = () => {
  let apiKey = "";
  
  // 1. Try to get the runtime injected key (safely)
  if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env) {
    apiKey = (window as any).process.env.API_KEY;
  }
  
  // 2. Fallback to the build-time injected key (replaced by Vite)
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }

  if (!apiKey) {
    throw new Error("API Key not found. Please select an API key or check your configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to clean AI output
const cleanHtmlOutput = (text: string): string => {
  if (!text) return "";
  // Remove markdown code blocks (```html ... ```)
  return text
    .replace(/^\s*```html\s*/i, '') // Remove start block
    .replace(/^\s*```\s*/i, '')     // Remove start block generic
    .replace(/\s*```\s*$/i, '')      // Remove end block
    .trim();                      // Trim whitespace
};

// Generate Detailed Content directly from a Topic
export const generateTopicContent = async (
  topic: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Academic Expert & Educator.
    Task: Write HIGH-DENSITY, EXHAUSTIVE, and HIGHLY STRUCTURED Detailed Notes.
    Model Config: Maximize information density. Minimal fluff.
    
    Topic: "${topic}"
    Language: ${language}

    **STRICT NUMBERING & STRUCTURE RULES:**
    Use strict hierarchical numbering for ALL headings. The structure must be logical and deeply detailed according to the specific topic.
    - <h1>1. [Main Title]</h1>
    - <h2>1.1 [Major Section]</h2>
    - <h3>1.1.1 [Sub-Section]</h3>
    - <h4>1.1.1.1 [Detailed Point]</h4>
    
    **CONTENT REQUIREMENTS:**
    1. **Density:** "More facts, fewer filler words." Fit as much information as possible concisely.
    2. **Depth:** Every sub-section (1.1.1) must contain substantial academic value.
    3. **Key Concepts:** Wrap vital definitions in: <div class="key-point"><strong>Key Concept:</strong> ...text...</div>
    4. **Notes (Optional):** Use <div class="note-box">...text...</div> for extra facts or interesting trivia only if relevant.
    5. **Tables (Optional):** Use strict HTML tables with <thead> for complex data comparisons or data-heavy sections.

    **VISUALIZATION LOGIC (Optional):**
    Analyze the topic and generate ONE detailed SVG diagram inside <div class="flowchart-container"> ONLY IF it significantly aids understanding (e.g., for processes, cycles, or hierarchies). If not needed, do not include it.
    *Rules for SVG (if included):*
    - Must be highly detailed, educational, and visually appealing.
    - Use a clean, professional color palette (e.g., #f8fafc background, #0f172a text, #3b82f6 accents).
    - **NO BORDERS** on the SVG itself or its main container.
    - Ensure all text inside the SVG is readable (use font-family: sans-serif, font-size: 14px or larger).
    - Use proper viewBox attributes for responsiveness.
    - Include meaningful connections, labels, and icons if possible.
    
    **Output:** Return ONLY raw HTML.
  `;

  // Deep Dive creation still needs Pro for initial structure
  const response = await ai.models.generateContent({
    model: modelName, 
    contents: prompt
  });

  return cleanHtmlOutput(response.text || "");
};

// Generate UPSC Mains Answer
export const generateUPSCAnswer = async (
  question: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview",
  wordLimit: number = 250
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: UPSC Topper & Expert Evaluator.
    Task: Write a high-scoring, perfectly structured UPSC Mains answer for the given question.
    
    Question: "${question}"
    Language: ${language}
    Word Limit: Approximately ${wordLimit} words.

    **STRICT STRUCTURE & FORMATTING RULES (Like a Topper's Copy):**
    1. **Introduction (Bhumika):** Crisp, fact-based, or definition-based start. Connect with current affairs if relevant.
    2. **Body (Mukhya Bhag):**
       - Break down into clear sub-headings based on the question's demands. Adapt the structure to the specific requirements of the topic.
       - Use bullet points for readability.
       - Include **Pros/Cons (Sahi/Galat)**, **Challenges (Chunati)**, and **Solutions/Way Forward (Samadhan)** ONLY where applicable.
       - Highlight key terms using <strong>.
    3. **Data/Facts/Committees (Optional):** Sprinkle relevant data, articles of the constitution, or committee recommendations if they exist for this topic. Use <div class="note-box">...</div> for highlighting facts.
    4. **Visual Elements (Optional):**
       - Include a **Table** for comparison or data presentation if it adds value.
       - Include an **SVG Diagram/Mindmap/Flowchart** inside a <div class="flowchart-container"> ONLY if it visually represents a process, hierarchy, or relationship that is complex. Ensure the SVG is clean, readable, and responsive (use viewBox). **DO NOT** include a border on the SVG itself.
    5. **Conclusion (Nishkarsh):** Forward-looking, optimistic, and balanced conclusion (e.g., mentioning SDGs or constitutional ethos).

    **WORD COUNT CONSTRAINT:**
    The total answer length MUST be strictly around ${wordLimit} words. Adjust the depth of each section to meet this limit while maintaining high quality.

    **Output:** Return ONLY raw HTML. Do not wrap in markdown blocks. Use standard HTML tags (<h1>, <h2>, <ul>, <li>, <table>, <svg>, etc.).
  `;

  const response = await ai.models.generateContent({
    model: modelName, 
    contents: prompt
  });

  return cleanHtmlOutput(response.text || "");
};

// Generate Comparison Table directly from a Topic
export const generateTopicComparisonTable = async (
  topic: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Data Analyst & Academic Expert.
    Task: Create a highly detailed, comprehensive Comparison Matrix (Table) for the topic.
    
    Topic: "${topic}"
    Language: ${language}

    **TABLE REQUIREMENTS:**
    1. **Structure:** Create a multi-column HTML table (<table>).
    2. **Headers:** Use <thead> with <th> for clear category titles (e.g., "Parameters", "Entity 1", "Entity 2").
    3. **Content:** 
       - Inside <td> cells, use bullet points (<ul><li>...</li></ul>) if there are multiple points per cell.
       - Be exhaustive and highly detailed. Do not just write 1-2 words if more context is needed.
    4. **Formatting:**
       - Use <strong> for key terms inside cells.
       - Ensure the table covers all aspects of the topic exhaustively.

    Output: Return ONLY the valid HTML <table> code. Do not wrap it in markdown blocks.
  `;

  const response = await ai.models.generateContent({
    model: modelName, 
    contents: prompt
  });

  return cleanHtmlOutput(response.text || "");
};

// Generate Detailed Data Table directly from a Topic
export const generateTopicDetailedTable = async (
  topic: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Senior Data Analyst & Subject Matter Expert.
    Task: Create a highly detailed, comprehensive DATA TABLE for the topic.
    
    Topic: "${topic}"
    Language: ${language}

    **TABLE REQUIREMENTS:**
    1. **Structure:** Create a multi-column HTML table (<table>) that breaks down the topic into its constituent parts, facts, data, or categories.
    2. **Headers:** Use <thead> with <th> for clear, descriptive titles.
    3. **Content:** 
       - Inside <td> cells, use bullet points (<ul><li>...</li></ul>) if there are multiple points per cell.
       - Be exhaustive and highly detailed. Provide deep insights, not just surface-level facts.
    4. **Formatting:**
       - Use <strong> for key terms inside cells.
       - Ensure the table is logically organized and covers the topic from multiple dimensions.

    Output: Return ONLY the valid HTML <table> code. Do not wrap it in markdown blocks.
  `;

  const response = await ai.models.generateContent({
    model: modelName, 
    contents: prompt
  });

  return cleanHtmlOutput(response.text || "");
};

// Generate Smart Table — AI decides the format based on instruction
export const generateSmartTable = async (
  topic: string,
  instruction: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Senior Data Analyst & Subject Matter Expert.
    Task: Create a highly detailed HTML table for the given topic, guided by the user's instruction.
    
    Topic: "${topic}"
    User Instruction: "${instruction || 'Create the most appropriate and comprehensive table for this topic'}"
    Language: ${language}
    
    DECISION RULES:
    - Read the instruction carefully and choose the most suitable table format:
      • Comparison/contrast requested → comparison matrix with entities as columns
      • List/data/facts requested → detailed data table with categories as rows  
      • No specific instruction → infer the best table format for the topic (prefer detailed data table for single topics, comparison for multiple entities)
    
    CONTENT RULES:
    1. Use valid HTML: <table> with <thead>, <tbody>, <th>, <tr>, <td>
    2. Use <ul><li>...</li></ul> inside <td> for multiple points per cell
    3. Use <strong> for key terms
    4. Be exhaustive — cover all important aspects of the topic
    5. Return ONLY valid HTML <table> code. No markdown, no explanation.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt
  });

  return cleanHtmlOutput(response.text || "");
};

// Generate Structured Notes from Raw Text
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
    4. **Visual Explanation (Diagram):** Include ONE highly detailed SVG diagram inside a <div class="flowchart-container"> to visually explain a complex process, relationship, or framework from the text.
    5. **Conclusion:** Summarize the findings, impact, and future scope.

    **Output:** Return ONLY raw HTML. Do not wrap in markdown blocks.
  ` : `
    Role: Professional Editor.
    Task: Format notes into a dense, numbered textbook format.
    
    Input Text: ${rawText}
    Language: ${language}

    **RULES:**
    1. **Structure:** Strict tree (1. -> 1.1 -> 1.1.1).
    2. **Density:** Remove conversational filler. Make it concise but complete.
    3. **Formatting:** Use <div class="key-point"> and <div class="note-box">.
    4. **Visuals:** Create an SVG diagram inside <div class="flowchart-container"> if complex logic exists.

    **Output:** Return ONLY raw HTML.
  `;

  const config: any = {};
  if (outputStyle === 'research') {
    config.tools = [{ googleSearch: {} }];
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    ...(Object.keys(config).length > 0 ? { config } : {})
  });

  return cleanHtmlOutput(response.text || "");
};

// Generate Structured Notes from Uploaded Files
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
    4. **Visual Explanation (Diagram):** Include ONE highly detailed SVG diagram inside a <div class="flowchart-container"> to visually explain a complex process, relationship, or framework from the files.
    5. **Conclusion:** Summarize the findings, impact, and future scope.

    **Output:** Return ONLY raw HTML. Do not wrap in markdown blocks.
  ` : `
    Role: Professional Academic Editor.
    Task: Analyze the provided files and generate comprehensive, structured notes in a numbered textbook format.
    
    Language: ${language}

    **RULES:**
    1. **Structure:** Strict tree (1. -> 1.1 -> 1.1.1).
    2. **Density:** Extract all key information. Make it concise but complete.
    3. **Formatting:** Use <div class="key-point"> and <div class="note-box">.
    4. **Visuals:** Create an SVG diagram inside <div class="flowchart-container"> if complex logic exists.

    **Output:** Return ONLY raw HTML.
  `;

  const parts: any[] = files.map(f => ({
    inlineData: {
      data: f.data,
      mimeType: f.mimeType
    }
  }));
  parts.push({ text: prompt });

  const config: any = {};
  if (outputStyle === 'research') {
    config.tools = [{ googleSearch: {} }];
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    ...(Object.keys(config).length > 0 ? { config } : {})
  });

  return cleanHtmlOutput(response.text || "");
};

// Rewrite specific text selection
// CHANGED: Uses Flash for speed, focused on structure preservation
export const rewriteContent = async (
    textToRewrite: string,
    instruction: string,
    modelName: string = "gemini-3-flash-preview"
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
      contents: prompt,
    });
  
    return cleanHtmlOutput(response.text || textToRewrite);
};

// Mode 1: REWRITE (Section Edits)
// CHANGED: Uses Flash for speed. Explicit context handling for deep nesting.
export const rewriteSection = async (
  sectionContent: string,
  instruction: string,
  modelName: string = "gemini-3-flash-preview"
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
    contents: prompt
  });
  return cleanHtmlOutput(response.text || "");
};

// Mode 2: EXPAND (Deep Dive)
// CHANGED: Uses Pro for thinking. Focused on "High Density".
export const expandSection = async (
  sectionContent: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();
  const prompt = `
    Role: Academic Researcher.
    Task: DEEP DIVE & EXPAND the selected section.
    
    Input HTML:
    ${sectionContent}

    Instruction: "${instruction}"
    
    **Requirements:**
    1. **High Density:** Maximize information per page. Avoid fluff.
    2. **Structure:** Explode bullet points into full sub-sections (convert 1.1 into 1.1.1, 1.1.2, 1.1.3).
    3. **Data:** Use tables for comparisons to save space and increase clarity.
    4. **Volume:** Significantly increase depth of knowledge, not just word count.

    Output: Valid HTML only.
  `;
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt
  });
  return cleanHtmlOutput(response.text || "");
};

// Mode 3: CONTINUE (Add next content)
// CHANGED: Uses Pro for logical continuity with specific detail instructions.
export const generateNextContent = async (
  previousContext: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview"
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
    5. **Formatting:** Use <strong>, <div class="key-point">, or tables where appropriate.
    
    Output: Return ONLY the HTML for the NEW content.
  `;
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt
  });
  return cleanHtmlOutput(response.text || "");
};

// Mode 5: NEXT TOPIC DETAILED (New Major Section)
export const generateDetailedNextTopic = async (
  previousContext: string,
  topicName: string,
  modelName: string = "gemini-3.1-pro-preview"
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
    5. **Visual Aids:** Use <div class="key-point">, <div class="note-box">, and <table> where relevant.
    6. **Tone:** Professional academic tone.

    Output: HTML for the new MAJOR section only.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt
  });
  return cleanHtmlOutput(response.text || "");
};

// Mode 6: GENERATE COMPLEX TABLE (Matrix)
export const generateComplexTable = async (
  contextText: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();
  
  const prompt = `
    Role: Data Analyst & Academic Editor.
    Task: Convert the provided text/concept into a **Complex Comparison Matrix (Table)**, OR if the input is ALREADY a table, EXTEND/MODIFY it based on the instruction.
    
    Input Text/Context: "${contextText}"
    Specific Instruction: "${instruction}"
    
    **TABLE REQUIREMENTS:**
    1. **Structure:** Create or update a multi-column HTML table (<table>).
    2. **Headers:** Use <thead> with <th> for clear category titles.
    3. **Content:** 
       - Inside <td> cells, use bullet points (<ul><li>...</li></ul>) if there are multiple points per cell. 
       - If extending an existing table, keep the existing data and add the new rows/columns as requested.
    4. **Formatting:**
       - Use <strong> for key terms inside cells.
       - Ensure the table covers all aspects of the topic exhaustively.

    Output: Return ONLY the valid HTML <table> code.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt
  });
  return cleanHtmlOutput(response.text || "");
};

// Mode 6b: EXTEND TABLE — appends new rows to an existing table (does NOT replace it)
export const extendTableRows = async (
  headersHtml: string,
  lastRowsHtml: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    You are a data-table expert. An existing HTML table is being extended.
    
    TABLE COLUMN HEADERS (from <thead>):
    ${headersHtml}
    
    LAST 2 ROWS OF EXISTING DATA (for continuity context):
    ${lastRowsHtml}
    
    TASK: Generate as many NEW <tr> data rows as naturally fit the topic — no fixed limit. Generate all the rows needed to comprehensively continue the table content.
    
    STRICT RULES:
    1. Match the EXACT same number of <td> cells as the existing rows.
    2. Each new row must cover a distinct, real topic/entry — no repetition of existing rows.
    3. Use <strong> for key terms inside <td> cells.
    4. For multi-point cells, use <ul><li>...</li></ul>.
    5. Do NOT output <table>, <thead>, <tbody>, or any wrapper — ONLY the raw <tr>...</tr> rows.
    6. Rows must be factually accurate and academically appropriate.
    7. Generate enough rows to be genuinely useful — aim for thorough coverage of the next logical batch of entries.
    
    USER INSTRUCTION (optional, may be empty): "${instruction || 'Continue naturally'}"
    
    Output: ONLY the raw <tr>...</tr> HTML rows. Nothing else.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt
  });

  const raw = response.text || "";
  // Strip any accidental table/tbody wrappers the model might add
  return raw
    .replace(/```html\n?/gi, '').replace(/```\n?/g, '')
    .replace(/<\/?table[^>]*>/gi, '')
    .replace(/<\/?thead[^>]*>/gi, '')
    .replace(/<\/?tbody[^>]*>/gi, '')
    .replace(/<\/?tfoot[^>]*>/gi, '')
    .trim();
};

// Mode 7: GENERATE DIAGRAM (SVG Flowchart / Mindmap / Comparison Table / Timeline)
export const generateDiagram = async (
  contextText: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();
  
  const prompt = `
    Role: Expert Information Designer & Academic Visualizer.
    Task: Analyse the user's instruction and produce the BEST visual output for it using SVG.

    Context (section text):
    "${contextText}"

    User Instruction: "${instruction}"

    DIAGRAM TYPE SELECTION — pick the most appropriate:
    - "mindmap" or "concept map" → radial layout, central node + branches
    - "flowchart" or "process" or "steps" → top-to-bottom boxes with arrows
    - "timeline" or "chronology" → horizontal/vertical timeline with events
    - "hierarchy" or "org chart" or "tree" → hierarchical tree layout
    - "comparison" or "table" or "matrix" or "vs" → SVG comparison table (header row + data rows, alternating fill, clear borders)
    - "cycle" or "loop" → circular/cyclic diagram
    - anything else → choose the most logical visual type

    **SVG REQUIREMENTS:**
    1. **Format:** Return ONLY valid, raw <svg> code. No markdown fences (\`\`\`html / \`\`\`svg), no explanation.
    2. **ViewBox:** Always set a viewBox (e.g. "0 0 900 600"). Do NOT use fixed width/height on the <svg> tag itself.
    3. **Completeness:** The diagram MUST be fully complete — all nodes labeled, all rows filled, all arrows drawn.
    4. **Styling — general:**
       - Background: white (#ffffff) or very light grey (#f8fafc).
       - Primary color: #3b82f6 (blue) for headers / main nodes.
       - Secondary: #0f172a (dark) for text, #e2e8f0 for borders/lines.
       - Use font-family="sans-serif" throughout. Minimum font-size: 12px.
    5. **Styling — comparison/table SVG:**
       - Header row: filled #3b82f6, white text.
       - Odd rows: #f0f9ff, Even rows: #ffffff.
       - Cell borders: <rect stroke="#cbd5e1">.
       - Column headers bold, data cells regular weight.
       - Enough height per row for text (min 36px per row).
    6. **Styling — node diagrams:**
       - Rounded rectangles (rx="10") for nodes.
       - Arrow lines: stroke="#94a3b8" with arrowhead markers.
       - Mindmap central node: larger, darker (#1e40af).
    7. **Spacing:** No text/shape overlap. Well-padded cells/nodes. If content is large, expand the viewBox height accordingly.

    Output: ONLY the <svg>...</svg> code. Nothing else.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt
  });
  
  const svgContent = response.text || "";
  // Clean up markdown if the model accidentally included it
  const cleanedSvg = svgContent.replace(/```xml\n?/g, '').replace(/```svg\n?/g, '').replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
  
  return `<div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">${cleanedSvg}</div>`;
};
export const generateSectionImage = async (
  contextText: string,
  instruction: string
): Promise<string> => {
  const ai = createAIClient();
  
  const cleanContext = contextText
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\nHEAD: $1\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000);

  const prompt = `
    Create a high-quality, professional textbook illustration.
    
    Context: "${cleanContext}"
    Instruction: ${instruction || "Illustrate the key concept."}
    
    Style: Educational, Detailed, Textbook Diagram, High Definition.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
        parts: [
            { text: prompt }
        ]
    },
    config: {
        imageConfig: {
            imageSize: '1K',
            aspectRatio: '16:9'
        }
    }
  });

  let imageUrl = "";
  if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
              imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
          }
      }
  }

  if (!imageUrl) {
      throw new Error("No image generated");
  }

  return `
    <figure>
        <img src="${imageUrl}" alt="Generated Illustration" />
        <figcaption>Figure: AI Generated Illustration</figcaption>
    </figure>
  `;
};

// Generate Research Paper / Detailed Analysis
export const generateResearchPaper = async (
  topic: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert Subject Matter Specialist & Technical Writer.
    Task: Write a comprehensive, deeply detailed structured paper that fully explains the given topic. 

    Topic: "${topic}"
    Language: ${language}

    **CRITICAL RULE — DO NOT write:**
    - "This paper aims to..."
    - "The purpose of this research is..."
    - "This study was conducted because..."
    - Any meta-commentary about why the paper was written
    - Any "Methodology" or "Literature Review" sections (this is NOT an academic research paper)
    
    **INSTEAD — Write directly about the topic itself with full depth:**

    **STRUCTURE:**
    1. **Title (h1):** Clear, descriptive title of the topic.
    2. **Overview (h2):** A factual, concise executive summary — what this topic IS, its significance, and scope. 2-3 paragraphs.
    3. **Historical Background / Context (h2):** Origins, evolution, timeline. Use <strong> for key dates and names.
    4. **Core Subject Sections (h2/h3):** 3-5 detailed thematic or structural sections breaking down every important dimension of the topic. Use bullet points (<ul><li>) within each section. Be exhaustive.
    5. **Key Data / Statistics / Facts (Table):** MUST include one detailed HTML <table> with real data, comparisons, timelines, or structured facts about the topic.
    6. **Visual Diagram (SVG):** MUST include ONE clear SVG diagram inside <div class="flowchart-container"> — a flowchart, mindmap, timeline, or process diagram directly related to the topic. Use viewBox, clean layout, readable text.
    7. **Key Takeaways (h2):** 5-8 bullet points summarizing the most important aspects of the topic.

    **Output:** Return ONLY raw HTML. No markdown. Use <h1>, <h2>, <h3>, <ul>, <li>, <table>, <strong>, <p>, <svg> etc.
  `;

  const response = await ai.models.generateContent({
    model: modelName, 
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });

  return cleanHtmlOutput(response.text || "");
};
// ─── IMAGE GENERATION (Imagen 4) ────────────────────────────────────────────

type ImageStyle = 'diagram' | 'handwritten' | 'mindmap' | 'flowchart';

const IMAGE_STYLE_PROMPTS: Record<ImageStyle, string> = {
  diagram: 'Create a clean educational diagram on a pure white background. Use labeled boxes, arrows, and clearly organized sections. Academic textbook illustration style, minimal and professional. Black text, thin colored lines, clear labels on every element. No photographic elements. Vector/illustration style only.',
  handwritten: "Educational notes handwritten on white paper, like a student's school copy or notebook. Black ballpoint pen or blue ink. Slightly casual but neat handwriting. Headings underlined, key words circled or boxed, arrows connecting concepts. Small hand-drawn diagrams, stars or bullets for important points. White paper background with faint ruled lines.",
  mindmap: 'A colorful mind map diagram on a white background. Central concept in a circle, branches radiating outward with subtopics. Each branch has a different color. Labels are clear and concise. Educational style, clean fonts, no clutter. Arrows show relationships.',
  flowchart: 'A clean educational flowchart on a white background. Rectangular process boxes, diamond decision shapes, oval start/end. Black borders, light color fills, clear arrow directions and labels. Step-by-step logical flow. Professional textbook quality.',
};

function getImageApiKey(): string {
  let apiKey = '';
  if (typeof window !== 'undefined' && (window as any).process?.env) {
    apiKey = (window as any).process.env.API_KEY || (window as any).process.env.GEMINI_API_KEY || '';
  }
  if (!apiKey) apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('API Key not found');
  return apiKey;
}

export const generateImage = async (
  topic: string,
  style: ImageStyle,
  aspectRatio: string,
  imageModel: string,
): Promise<string> => {
  const apiKey = getImageApiKey();
  const styleGuide = IMAGE_STYLE_PROMPTS[style];
  const fullPrompt = `Topic: ${topic}. ${styleGuide}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: fullPrompt }],
        parameters: { sampleCount: 1, aspectRatio },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `Image generation failed (${response.status})`);
  }

  const data = await response.json();
  const prediction = data?.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('No image data in response. Try a different model or topic.');
  }

  const mimeType = prediction.mimeType || 'image/png';
  return `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
};

// Translate PDF to Hindi — preserves layout, tables, headings & image positions
export const translatePdfToHindi = async (
  fileData: string,
  fileMimeType: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert Hindi Translator & Academic Editor.
    Task: Translate the ENTIRE content of the provided PDF document into Hindi (Devanagari script).

    **CRITICAL RULES:**
    1. **Translate EVERYTHING:** Every single word of text — headings, subheadings, bullet points, table cells, captions, labels, footnotes — must be translated into Hindi. Do NOT leave any English text.
    2. **Preserve Structure EXACTLY:** Maintain the exact same document structure:
       - All headings → use same <h1>, <h2>, <h3>, <h4> tags
       - All bullet/numbered lists → use same <ul><li> or <ol><li> tags
       - All tables → recreate as full HTML <table> with <thead>/<tbody>/<tr>/<th>/<td>
       - Bold text → keep <strong> tags around translated bold terms
       - Key points → use <div class="key-point"> for highlighted definitions
       - Note boxes → use <div class="note-box"> for facts/notes
    3. **Images & Diagrams — POSITION MATTERS:**
       - Wherever an image, chart, flowchart, diagram, or map appears in the PDF, insert a placeholder block at THAT EXACT POSITION in the output HTML.
       - Use this format for each image/diagram:
         <div class="image-placeholder">
           <div class="image-placeholder-icon">🖼️</div>
           <div class="image-placeholder-title">[Hindi title/name of what the image shows]</div>
           <div class="image-placeholder-desc">[2-3 lines describing in Hindi what this image/diagram depicts — its key elements, labels, arrows, etc.]</div>
         </div>
       - If the image has labels or a legend, describe those labels in Hindi inside the description.
    4. **Tables:** Translate ALL table headers and cell content to Hindi. Keep the full table structure intact.
    5. **Technical terms:** For proper nouns (names of people, places, organizations) keep them in Hindi transliteration. For scientific/technical terms, write Hindi translation followed by English in parentheses if helpful.
    6. **Page breaks:** Use <hr class="page-break"> between major sections if the original had clear page separations.
    7. **Output:** Return ONLY raw HTML — no markdown code blocks, no explanations.
  `;

  const parts: any[] = [
    { inlineData: { data: fileData, mimeType: fileMimeType } },
    { text: prompt }
  ];

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts }
  });

  return cleanHtmlOutput(response.text || "");
};

export const translatePdfPageToHindi = async (
  pageImageBase64: string,
  pageNumber: number,
  totalPages: number,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert Hindi Translator & Academic Document Processor.
    Task: This is page ${pageNumber} of ${totalPages} from an English PDF. Translate ALL text into Hindi (Devanagari script) and mark every image/diagram region with a special tag.

    **CRITICAL RULES:**

    1. **Translate EVERYTHING:** Every visible word of text — headings, subheadings, body text, bullet points, numbered lists, table cells, captions, labels, footnotes — must be translated to Hindi. Do NOT leave any English text.

    2. **Preserve HTML Structure EXACTLY:**
       - Headings → <h1>, <h2>, <h3>, <h4> (match the visual heading level)
       - Bullet/numbered lists → <ul><li> or <ol><li>
       - Tables → full HTML <table><thead><tbody><tr><th><td>
       - Bold/key terms → <strong>
       - Key definitions → <div class="key-point">
       - Highlighted notes/boxes → <div class="note-box">

    3. **Images & Diagrams — EXACT POSITION IS CRITICAL:**
       - For EVERY image, photograph, diagram, chart, graph, map, flowchart, or illustration visible on this page, output a self-closing marker tag at THAT EXACT position in the HTML flow.
       - Use PERCENTAGE coordinates (0-100) relative to the page dimensions:
         - data-x: left edge of the image as % of page width
         - data-y: top edge of the image as % of page height
         - data-w: width of the image as % of page width
         - data-h: height of the image as % of page height
       - Example: <pdf-img data-x="5" data-y="30" data-w="90" data-h="25" data-page="${pageNumber}" data-alt="मानचित्र का विवरण"/>
       - data-page must always be "${pageNumber}" (the current page number).
       - The data-alt should be a brief Hindi description of what the image shows.
       - IMPORTANT: Place the <pdf-img> tag INLINE in the HTML exactly where the image appears relative to surrounding text — not all at the start or end.
       - Do NOT use placeholder divs for images — use ONLY the <pdf-img> self-closing tag.

    4. **Tables:** Translate ALL table headers and cells to Hindi. Preserve the complete table HTML structure.

    5. **Technical terms:** Keep proper nouns (people, places, organizations) in Hindi transliteration. For scientific/technical terms, write the Hindi translation followed by the English term in parentheses.

    6. **Output:** Return ONLY raw HTML — no markdown code fences, no \`\`\`html, no explanations. Just the HTML content for this page.
  `;

  const parts: any[] = [
    { inlineData: { data: pageImageBase64, mimeType: 'image/png' } },
    { text: prompt }
  ];

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts }
  });

  return cleanHtmlOutput(response.text || "");
};
