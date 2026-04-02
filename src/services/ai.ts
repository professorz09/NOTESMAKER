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

    **TABLE FORMAT — AI selects the most appropriate type for this topic:**
    Choose the table format that best organizes the information — do NOT default to comparison every time:
    • **Comparison Matrix** — comparing 2–4 entities on shared parameters (e.g., Act A vs Act B vs Act C)
    • **Timeline Table** — chronological data: (Year | Event | Significance / Impact)
    • **Pros & Cons** — advantages vs disadvantages, with optional weight/severity column
    • **Factor Analysis** — causes / effects / challenges: (Factor | Details | Examples / Data)
    • **Feature Matrix** — multiple attributes of one subject: (Attribute | Description | Current Status)
    • **Data / Statistics** — numerical facts, rankings, percentages across entities or time
    • **Process Steps** — sequential phases: (Phase/Step | Action | Outcome / Indicator)
    • **Concept Map Table** — concept → sub-concepts → real-world applications (3 columns)
    Include a table ONLY where it adds clear value over prose. Use <thead><tr><th> and <tbody>. Use <ul><li> inside <td> for multiple points per cell.

    **SVG DIAGRAM — AI selects the best visual type for this topic:**
    Analyze the topic deeply and pick ONE visual that maximizes understanding:
    • **Flowchart** → sequential steps, decision trees, policy or administrative processes
    • **Mindmap** → concept clusters, radial layout — central node + labeled branches + sub-branches
    • **Timeline** → chronological events, historical progression, constitutional/legislative history
    • **Cycle / Loop** → recurring processes, feedback loops, ecological or policy cycles
    • **Hierarchy / Tree** → classification trees, org structures, taxonomies
    • **Venn Diagram** → overlapping concepts, shared vs unique properties of 2–3 entities
    • **Network / Web** → interconnected actors, systems, or relationships
    • **SVG Comparison Table** → side-by-side data with colored header row and alternating row fills
    SVG rules: Always set viewBox (e.g. "0 0 900 600"). No fixed width/height on <svg>. font-family="sans-serif", min font-size 13px. Background #f8fafc or white. Primary #3b82f6. No overlapping text. Wrap in <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">. Only create a diagram if it genuinely aids comprehension beyond text.
    
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
       **TABLE** — Include ONE table if it genuinely aids understanding. Choose the format that fits:
       • Comparison Matrix (two or more entities), Timeline (Year | Event | Impact), Pros & Cons,
         Factor Analysis (Cause/Challenge | Details | Examples), Process Steps, Data/Statistics.
       **SVG DIAGRAM** — Include ONE SVG if it visually clarifies something text cannot. Pick the right type:
       • Flowchart (processes/steps), Mindmap (concept clusters), Timeline SVG (chronology),
         Cycle (recurring processes), Hierarchy/Tree (classifications), Venn (overlapping entities),
         Network (interconnected actors), SVG Table (structured comparison with colored header).
       SVG rules: viewBox always set, no fixed width/height, font-family="sans-serif", min 13px font, no overlapping text.
       Wrap diagram in: <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">
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
    Task: Create a highly detailed, comprehensive table for the topic. First analyze the topic, then choose the table format that best suits it — do NOT always default to a comparison matrix.
    
    Topic: "${topic}"
    Language: ${language}

    **TABLE FORMAT SELECTION — pick the type that genuinely fits this topic:**
    • **Comparison Matrix** — use when 2–4 distinct entities share common parameters (e.g., two policies, two rivers, pre vs post reform)
    • **Timeline Table** — use for topics with historical evolution: (Year | Event | Significance)
    • **Pros & Cons** — use for evaluative topics: (Aspect | Advantages | Disadvantages) or add a Weight column
    • **Factor Analysis** — use for cause-effect or challenge topics: (Factor/Cause | Details | Examples/Data)
    • **Feature Matrix** — use for single-subject cataloguing: (Attribute | Description | Current Status/Value)
    • **Data / Statistics** — use when numerical data, rankings, or percentages are central
    • **Process Steps** — use for procedural or sequential topics: (Phase | Action | Outcome/Indicator)
    • **Concept Map Table** — use for conceptual topics: (Concept | Sub-Concepts | Real-World Applications)

    **CONTENT RULES:**
    1. Use <table> with <thead><tr><th> and <tbody><tr><td>. Add <caption> with a descriptive title.
    2. Inside <td> cells, use <ul><li>...</li></ul> when there are multiple points.
    3. Use <strong> for key terms, figures, and proper nouns inside cells.
    4. Be exhaustive — cover all important aspects of the topic, not just surface-level facts.
    5. Ensure every row adds distinct value; no repetitive or filler rows.

    Output: Return ONLY the valid HTML <table> code (with <caption>). No markdown, no explanation.
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
    Task: Create a highly detailed, comprehensive table for the topic. First think about what the topic is — then choose the table format that best reveals its structure.
    
    Topic: "${topic}"
    Language: ${language}

    **TABLE FORMAT SELECTION — analyze the topic and pick the most appropriate type:**
    • **Comparison Matrix** — two or more entities compared on shared parameters
    • **Timeline Table** — historical or sequential data: (Year/Period | Event | Impact)
    • **Pros & Cons** — evaluative: (Aspect | Advantages | Disadvantages) ± Severity column
    • **Factor Analysis** — causal/challenge topics: (Factor | Explanation | Real-World Examples)
    • **Feature Matrix** — single-entity deep-dive: (Attribute | Description | Value/Status)
    • **Data / Statistics** — quantitative: figures, rankings, percentages, growth rates
    • **Process Steps** — procedural: (Step/Phase | What Happens | Output/Indicator)
    • **Concept Map Table** — conceptual: (Core Concept | Sub-Concepts | Applications/Examples)

    **CONTENT RULES:**
    1. Use <table> with <thead><tr><th> headers and <tbody><tr><td> rows. Add a <caption> title.
    2. Use <ul><li> inside <td> for multiple points per cell.
    3. Use <strong> for key terms, dates, figures, and names.
    4. Cover the topic from multiple dimensions — be exhaustive and insightful, not surface-level.
    5. Every row must add distinct, non-repetitive value.

    Output: Return ONLY valid HTML <table> code (including <caption>). No markdown, no explanation.
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
    Task: Analyze the topic + user instruction together, then create the most insightful and well-structured HTML table. Think carefully about what table format best reveals the topic's structure — do NOT default to comparison every time.
    
    Topic: "${topic}"
    User Instruction: "${instruction || 'Create the most appropriate and comprehensive table for this topic'}"
    Language: ${language}
    
    **TABLE FORMAT SELECTION — match format to the topic and instruction:**
    • **Comparison Matrix** — user asks "compare" / "vs" / "difference" OR topic has 2+ distinct entities with shared parameters → columns are entities, rows are parameters
    • **Timeline Table** — user asks "history" / "evolution" / "chronology" OR topic is time-based → (Year/Period | Event | Significance / Impact)
    • **Pros & Cons** — user asks "advantages/disadvantages" / "merits/demerits" / "evaluate" → (Aspect | Pros | Cons) ± Weight/Severity column
    • **Factor Analysis** — topic is cause-effect, challenges, or impact-based → (Factor / Cause | Explanation | Examples / Data)
    • **Feature Matrix** — topic is a single subject / scheme / institution → (Attribute | Description | Current Status / Value)
    • **Data / Statistics** — user asks "data" / "numbers" / "figures" OR topic is quantitative → columns are entities/years, rows are metrics
    • **Process Steps** — topic is a procedure, policy flow, or scheme implementation → (Phase/Step | Action | Output / Indicator)
    • **Concept Map Table** — topic is abstract or multi-dimensional conceptual → (Core Concept | Sub-Concepts | Real-World Applications)
    • **Ranking / Priority Table** — topic involves ordering by importance → (Rank | Item | Score/Criteria | Reason)
    
    **CONTENT RULES:**
    1. Use <table> with <caption> (descriptive title), <thead><tr><th>, <tbody><tr><td>.
    2. Use <ul><li> inside <td> when a cell has multiple points.
    3. Use <strong> for key terms, figures, dates, and names.
    4. Be exhaustive — cover all important dimensions of the topic.
    5. Every row must carry distinct, non-repetitive value.
    6. Return ONLY valid HTML <table> code (with <caption>). No markdown, no explanation.
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
       **TABLE** — Include ONE table if relevant. Choose the format that fits the content:
       • Comparison Matrix, Timeline (Year | Event | Impact), Pros & Cons,
         Factor Analysis (Cause | Details | Examples), Process Steps, Data/Statistics.
       **SVG DIAGRAM** — Include ONE SVG diagram if it adds visual clarity. Choose the right type:
       • Flowchart (steps/process), Mindmap (concept clusters), Timeline SVG (chronology),
         Cycle (recurring processes), Hierarchy/Tree, Venn (overlapping concepts), Network.
       Wrap SVG in: <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">
       SVG rules: viewBox set, no fixed width/height, font-family="sans-serif", min 13px, no overlapping text.
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
    2. **Body Sections:** Break down into logical academic sections with bullet points and <strong> for key terms.
    3. **Data & Evidence (Table):** Include at least one detailed HTML <table> with <caption>. Choose the format:
       • Timeline, Comparison Matrix, Factor Analysis, Data/Statistics, Feature Matrix — whichever best fits.
    4. **Visual Explanation (Diagram):** Include ONE SVG diagram inside <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">.
       Choose the type: Flowchart, Mindmap, Timeline, Cycle, Hierarchy, Venn, or Network — whichever best represents the content.
       SVG rules: viewBox set, no fixed width/height, font-family="sans-serif", min 13px text, no overlapping.
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
    4. **Table (Optional):** If the content has comparative or structured data, include an appropriate table (Timeline, Factor Analysis, Comparison, or Process Steps — whichever fits).
    5. **Visual (Optional):** If complex logic/process exists, add an SVG inside <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">. Pick the type that fits: Flowchart, Mindmap, Cycle, Hierarchy, or Timeline SVG. viewBox set, no overlapping text.

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
       **TABLE** — Include ONE table if it genuinely aids understanding. Choose the format that fits the file content:
       • Comparison Matrix, Timeline (Year | Event | Impact), Pros & Cons,
         Factor Analysis (Cause | Details | Examples), Process Steps, Data/Statistics.
       **SVG DIAGRAM** — Include ONE SVG if it adds visual clarity. Choose the right type from the file content:
       • Flowchart (steps/process), Mindmap (concept clusters), Timeline SVG (chronology),
         Cycle (recurring processes), Hierarchy/Tree, Venn (overlapping concepts), Network.
       Wrap SVG in: <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">
       SVG rules: viewBox set, no fixed width/height, font-family="sans-serif", min 13px, no overlapping text.
    5. **Conclusion (Nishkarsh):** Forward-looking, optimistic, and balanced conclusion.

    **WORD COUNT CONSTRAINT:**
    The total answer length MUST be strictly around ${wordLimit} words. Adjust the depth of each section to meet this limit while maintaining high quality.

    **Output:** Return ONLY raw HTML. Do not wrap in markdown blocks.
  ` : outputStyle === 'research' ? `
    Role: Expert Academic Researcher & Author.
    Task: Analyze the provided files and generate a highly detailed, deeply researched, and visually structured Research Paper.
    
    Language: ${language}

    **STRICT STRUCTURE & FORMATTING RULES:**
    1. **Abstract & Introduction:** Start with a comprehensive abstract, context, and the core thesis.
    2. **Body Sections:** Logical academic sections with bullet points and <strong> for key terms, dates, authors.
    3. **Data & Evidence (Table):** Include at least one detailed HTML <table> with <caption>. Pick the format that best fits the file content:
       • Timeline, Comparison Matrix, Factor Analysis, Data/Statistics, Feature Matrix.
    4. **Visual Explanation (Diagram):** Include ONE SVG diagram inside <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">.
       Pick the type that best represents the content: Flowchart, Mindmap, Timeline, Cycle, Hierarchy, Venn, or Network.
       SVG rules: viewBox set, no fixed width/height, font-family="sans-serif", min 13px, no overlapping text.
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
    4. **Table (Optional):** If file content has structured data, include an appropriate table (Timeline, Comparison, Factor Analysis, or Process Steps — whichever fits).
    5. **Visual (Optional):** If complex logic/process found in files, add an SVG inside <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">. Pick the type: Flowchart, Mindmap, Cycle, Hierarchy, or Timeline SVG. viewBox set, no overlapping text.

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
const buildContents = (prompt: string, images?: { base64: string; mimeType: string }[]) => {
  if (!images || images.length === 0) return prompt;
  return {
    parts: [
      ...images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
      { text: prompt },
    ]
  };
};

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

// Mode 1: REWRITE (Section Edits)
// CHANGED: Uses Flash for speed. Explicit context handling for deep nesting.
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

// Mode 2: EXPAND (Deep Dive)
// CHANGED: Uses Pro for thinking. Focused on "High Density".
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
    
    **Requirements:**
    1. **High Density:** Maximize information per page. Avoid fluff.
    2. **Structure:** Explode bullet points into full sub-sections (convert 1.1 into 1.1.1, 1.1.2, 1.1.3).
    3. **Tables:** Add a table where it saves space and increases clarity. Choose the most appropriate format:
       • Comparison Matrix, Timeline (Year | Event | Impact), Pros & Cons, Factor Analysis,
         Feature Matrix, Data/Statistics, Process Steps — whichever best fits the content being expanded.
       Use <caption>, <thead><th>, <tbody><td>, <ul><li> inside cells, <strong> for key terms.
    4. **Diagram (Optional):** If the expanded content has a clear process, cycle, or relationship, add ONE SVG diagram inside <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">. Pick the right type: Flowchart, Mindmap, Timeline, Cycle, Hierarchy, or Venn. viewBox set, no overlapping text, min 13px font.
    5. **Volume:** Significantly increase depth of knowledge, not just word count.

    Output: Valid HTML only.
  `;
  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images)
  });
  return cleanHtmlOutput(response.text || "");
};

// Mode 3: CONTINUE (Add next content)
// CHANGED: Uses Pro for logical continuity with specific detail instructions.
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
    6. **Table (Optional):** If a section being added has structured/comparative data, include ONE appropriately-formatted table (Timeline, Comparison, Factor Analysis, Pros/Cons, Process Steps, Feature Matrix — whichever fits). Add <caption>, use <thead><th>, <tbody><td>, <ul><li> for multi-point cells.
    7. **Diagram (Optional):** If the new content has a clear visual structure, add ONE SVG inside <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">. Pick the type: Flowchart, Mindmap, Timeline, Cycle, Hierarchy, or Venn. viewBox set, min 13px font, no overlapping text.
    
    Output: Return ONLY the HTML for the NEW content.
  `;
  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images)
  });
  return cleanHtmlOutput(response.text || "");
};

// Mode 5: NEXT TOPIC DETAILED (New Major Section)
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
    6. **Table (Optional):** If the topic benefits from structured data, include ONE appropriate table with <caption>. Choose the format that fits:
       • Timeline, Comparison Matrix, Factor Analysis, Pros & Cons, Feature Matrix, Process Steps, Data/Statistics.
       Use <thead><th>, <tbody><td>, <ul><li> inside cells, <strong> for key terms.
    7. **Diagram (Optional):** If the topic has a clear visual structure, include ONE SVG inside <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">. Pick the best type: Flowchart, Mindmap, Timeline, Cycle, Hierarchy, or Venn. viewBox set, min 13px font, no overlapping text.
    8. **Tone:** Professional academic tone.

    Output: HTML for the new MAJOR section only.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: buildContents(prompt, images)
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
    5. **Key Data / Statistics / Facts (Table):** MUST include one detailed HTML <table> with <caption>. Choose the format that best fits this specific topic — do NOT default to comparison every time:
       • **Timeline** (Year | Event | Significance) — for topics with historical evolution
       • **Comparison Matrix** — for topics with 2+ comparable entities
       • **Factor Analysis** (Factor | Details | Examples) — for cause-effect or challenge topics
       • **Data / Statistics** — for topics with quantitative data, rankings, or percentages
       • **Feature Matrix** (Attribute | Description | Status) — for single-subject cataloguing
       • **Process Steps** (Phase | Action | Outcome) — for procedural or policy topics
       Use <thead><th>, <tbody><td>, <ul><li> inside cells for multiple points, <strong> for key terms.
    6. **Visual Diagram (SVG):** MUST include ONE SVG diagram inside <div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center"> — choose the type that best suits this specific topic:
       • **Flowchart** → policy/administrative processes, decision trees
       • **Mindmap** → concept clusters, topic relationships (radial layout)
       • **Timeline SVG** → chronological events, historical progressions
       • **Cycle / Loop** → recurring or feedback processes
       • **Hierarchy / Tree** → classification trees, org structures
       • **Venn Diagram** → overlapping entities with shared/unique attributes
       • **Network** → interconnected actors or systems
       SVG rules: viewBox set (e.g. "0 0 900 600"), no fixed width/height on <svg>, font-family="sans-serif", min 13px font, no overlapping text, background #f8fafc or white, primary color #3b82f6.
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

export const analyzeAnswerPdf = async (
  pageImages: { base64: string; mimeType: string }[],
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
You are Professor UPSC — an expert UPSC Mains examiner and senior IAS mentor with 25+ years of experience evaluating civil services answers.

The uploaded images show a handwritten or typed UPSC answer (possibly spread across multiple pages). Your job is to:
1. Identify the question being answered (read from the paper itself if visible, or infer from the answer content).
2. Thoroughly evaluate the answer as a strict UPSC examiner.
3. Provide a high-quality Model Answer.

Return your entire response as clean HTML using this EXACT structure:

<div class="answer-analysis">

<div class="section-card" style="border-left:4px solid #6366f1;background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.02));border-radius:12px;padding:20px 24px;margin-bottom:20px">
<h2 style="color:#818cf8;font-size:1.1rem;margin:0 0 10px;font-weight:700">📋 पहचाना गया प्रश्न</h2>
<p style="color:#e2e8f0;margin:0;line-height:1.7">[Write the identified question here in both Hindi and English if possible]</p>
</div>

<div class="section-card" style="border-left:4px solid #f59e0b;background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.02));border-radius:12px;padding:20px 24px;margin-bottom:20px">
<h2 style="color:#fbbf24;font-size:1.1rem;margin:0 0 14px;font-weight:700">📊 उत्तर का मूल्यांकन</h2>
<table style="width:100%;border-collapse:collapse;font-size:0.85rem">
<thead><tr>
<th style="text-align:left;padding:8px 12px;background:rgba(245,158,11,0.15);color:#fbbf24;border-radius:6px 0 0 6px">पहलू</th>
<th style="text-align:center;padding:8px 12px;background:rgba(245,158,11,0.15);color:#fbbf24">अंक (10 में से)</th>
<th style="text-align:left;padding:8px 12px;background:rgba(245,158,11,0.15);color:#fbbf24;border-radius:0 6px 6px 0">टिप्पणी</th>
</tr></thead>
<tbody>
[Add 5-6 rows like: Introduction, Content Depth, Structure, Examples/Facts, Conclusion, Language]
Each row: <tr style="border-bottom:1px solid rgba(255,255,255,0.06)"><td style="padding:8px 12px;color:#e2e8f0">[Aspect in Hindi]</td><td style="padding:8px 12px;text-align:center;color:#fbbf24;font-weight:700">[Score]/10</td><td style="padding:8px 12px;color:#94a3b8;font-size:0.8rem">[Brief comment]</td></tr>
</tbody></table>
<div style="margin-top:14px;padding:12px 16px;background:rgba(245,158,11,0.12);border-radius:8px;display:flex;align-items:center;gap:12px">
<span style="color:#fbbf24;font-size:1.3rem;font-weight:800">[Total]/60</span>
<span style="color:#94a3b8;font-size:0.82rem">अनुमानित UPSC Mains अंक</span>
</div>
</div>

<div class="section-card" style="border-left:4px solid #ef4444;background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.02));border-radius:12px;padding:20px 24px;margin-bottom:20px">
<h2 style="color:#f87171;font-size:1.1rem;margin:0 0 14px;font-weight:700">❌ कमियाँ (Weaknesses)</h2>
<ul style="margin:0;padding-left:20px;space-y:8px">
[4-6 specific weaknesses as <li style="color:#e2e8f0;margin-bottom:10px;line-height:1.6"> items. Be specific, not generic.]
</ul>
</div>

<div class="section-card" style="border-left:4px solid #22c55e;background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.02));border-radius:12px;padding:20px 24px;margin-bottom:20px">
<h2 style="color:#4ade80;font-size:1.1rem;margin:0 0 14px;font-weight:700">✅ सुझाव (Suggestions to Improve)</h2>
<ol style="margin:0;padding-left:20px">
[4-6 actionable, specific suggestions as <li style="color:#e2e8f0;margin-bottom:10px;line-height:1.6"> items]
</ol>
</div>

<div class="section-card" style="border-left:4px solid #06b6d4;background:linear-gradient(135deg,rgba(6,182,212,0.08),rgba(6,182,212,0.02));border-radius:12px;padding:20px 24px;margin-bottom:8px">
<h2 style="color:#22d3ee;font-size:1.1rem;margin:0 0 16px;font-weight:700">🏆 आदर्श उत्तर (Model Answer)</h2>
<div style="color:#e2e8f0;line-height:1.8">
[Write a complete, UPSC-standard model answer here. Use proper structure: Introduction → Body (with sub-headings, points, examples, data) → Conclusion. Use <h3> for sub-headings, <ul>/<ol> for lists, <strong> for key terms. The model answer should be around ${250}-300 words or as appropriate for the question type. Write in Hindi.]
</div>
</div>

</div>

RULES:
- Write ALL analysis content in Hindi (Devanagari script). The model answer should also be in Hindi unless the question specifically asks for English.
- Be very specific about weaknesses — quote or reference actual parts of the student's answer.
- The model answer must be UPSC-exam quality, not generic. Include relevant facts, schemes, data, constitutional articles, or examples.
- Return ONLY the HTML — no markdown, no code fences.
`;

  const parts: any[] = [
    ...pageImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
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
  modelName: string = "gemini-3.1-pro-preview",
  imageMimeType: string = "image/jpeg"
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
    { inlineData: { data: pageImageBase64, mimeType: imageMimeType } },
    { text: prompt }
  ];

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts }
  });

  return cleanHtmlOutput(response.text || "");
};
