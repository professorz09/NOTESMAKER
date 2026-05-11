import { createAIClient, cleanHtmlOutput } from './client';

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

  const response = await ai.models.generateContent({ model: modelName, contents: prompt });
  return cleanHtmlOutput(response.text || "");
};

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

  const response = await ai.models.generateContent({ model: modelName, contents: prompt });
  const raw = response.text || "";
  return raw
    .replace(/```html\n?/gi, '').replace(/```\n?/g, '')
    .replace(/<\/?table[^>]*>/gi, '')
    .replace(/<\/?thead[^>]*>/gi, '')
    .replace(/<\/?tbody[^>]*>/gi, '')
    .replace(/<\/?tfoot[^>]*>/gi, '')
    .trim();
};
