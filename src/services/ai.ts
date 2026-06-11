import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getAccessToken } from "./supabase";

// All AI calls go through a Supabase Edge Function (gemini-proxy) that
// holds the GCP Service Account key server-side and forwards to Vertex
// AI. The browser bundle never sees a Gemini/Vertex credential — only
// the user's short-lived Supabase JWT.
//
// Mechanics:
//   1. Override the SDK's base URL to the proxy.
//   2. Patch global fetch ONCE: when the URL starts with the proxy
//      prefix, swap the SDK's `x-goog-api-key` header for an
//      `Authorization: Bearer <supabase-jwt>` header that the edge
//      function's verify_jwt = true gate will accept.
//
// The SDK's generated request shape (path, body, retries) is preserved
// end-to-end so the proxy translates request → Vertex format without us
// touching call sites.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const PROXY_BASE_URL = supabaseUrl ? `${supabaseUrl}/functions/v1/gemini-proxy` : '';

function installProxyFetchInterceptor() {
  if (typeof window === 'undefined') return;
  if ((window as any).__notesmakerAiFetchPatched) return;
  if (!PROXY_BASE_URL) return;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    if (url.startsWith(PROXY_BASE_URL)) {
      const token = await getAccessToken();
      if (!token) throw new Error('Sign-in required for AI features.');
      const headers = new Headers(init?.headers || {});
      // The SDK attaches x-goog-api-key — strip it so the proxy auth
      // header (Supabase JWT) is the only credential it sees.
      headers.delete('x-goog-api-key');
      headers.set('Authorization', `Bearer ${token}`);
      // Supabase Edge Functions also expect the project apikey header
      // for some routing modes; add the anon key if available.
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (anon && !headers.has('apikey')) headers.set('apikey', anon);
      return origFetch(input, { ...init, headers });
    }
    return origFetch(input, init);
  };
  (window as any).__notesmakerAiFetchPatched = true;
}

export const createAIClient = () => {
  if (!PROXY_BASE_URL) {
    throw new Error('AI proxy not configured — VITE_SUPABASE_URL missing.');
  }
  installProxyFetchInterceptor();
  // apiKey is a placeholder — the interceptor above swaps it for the
  // user's Supabase JWT before the request leaves the browser.
  return new GoogleGenAI({
    apiKey: 'proxied',
    httpOptions: { baseUrl: PROXY_BASE_URL },
  });
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

    **VISUALIZATION LOGIC (Optional):**
    Analyze the topic and generate ONE detailed SVG diagram inside <div class="flowchart-container"> ONLY IF it significantly aids understanding (e.g., for processes, cycles, or hierarchies). If not needed, do not include it.
    *Rules for SVG (if included):*
    - Must be highly detailed, educational, and visually appealing.
    - Use a clean, professional color palette (#f8fafc background, #0f172a text, #3b82f6 accents).
    - **NO BORDERS** on the SVG itself or its main container.
    - Ensure all text inside the SVG is readable (font-family="sans-serif", font-size 14px or larger).
    - Use proper viewBox attributes for responsiveness. Do NOT set fixed width/height on <svg>.
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

export type UPSCAnswerStyle = 'auto' | 'topper' | 'bullets' | 'analytical';

const buildUPSCPrompt = (
  question: string,
  language: string,
  wordLimit: number,
  style: UPSCAnswerStyle
): string => {
  const lang = language === 'Hindi'
    ? 'Hindi (Devanagari script). Write everything — headings, body, conclusion — in Hindi.'
    : 'English';

  // ── STYLE 1: AUTO ────────────────────────────────────────────────────────
  // Dead-simple prompt. AI decides structure, evidence, opening — everything.
  if (style === 'auto') return `
Write a high-scoring UPSC Mains answer.

Question/Topic: "${question}"
Language: ${lang}
Word Limit: ~${wordLimit} words

Make it structured, deep, and exam-worthy.
Use proper HTML: <h2> for Introduction & Conclusion, <h3> for body sections,
<ul><li> for points, <strong> for key terms.
Use <div class="note-box"> for important facts/data if relevant.

Return ONLY raw HTML. No markdown.
`;

  // ── STYLE 2: TOPPER'S COPY ───────────────────────────────────────────────
  // Intelligent adaptive prompt — structure & evidence emerge from topic type
  if (style === 'topper') return `
You are a seasoned UPSC Mains examiner and IAS mentor. Write an answer that reads like a genuine topper's copy — not a template.

Question: "${question}"
Language: ${lang}
Word Limit: ~${wordLimit} words

━━━ STEP 1 — READ THE QUESTION
Before writing, silently identify:
• Subject/paper (Polity, Economy, History, Geography, Environment, Ethics, Literature, Science…)
• Directive word (Discuss / Analyze / Critically evaluate / Comment / Examine / Elaborate)
• What a good examiner wants to see for THIS specific question

━━━ STEP 2 — INTRODUCTION
Pick the opening that BEST FITS the topic — not the same type every time:
• Literature / Philosophy / Ethics → famous quote, sher, doha, or line from a relevant thinker/poet/work
• Polity / Governance → sharp constitutional fact, recent SC judgment, or committee observation
• Economy / Development → striking data point from World Bank, NITI Aayog, RBI
• Environment → IPCC fact, India-specific data, or a recent climate/biodiversity event
• History / Culture → historical turning point or evocative context sentence
• Social Issues → ground-level human reality backed by NFHS/Census/UNDP data
• Science & Tech → recent breakthrough, global race context, India's milestone
After the hook: 1-2 lines of definition/context. Keep intro under 60 words.

━━━ STEP 3 — BODY
Structure based on what THIS question genuinely needs — not a fixed template:
• "Discuss" → background → multiple dimensions → challenges → way forward
• "Critically evaluate" → what works (with evidence) → what doesn't → balanced verdict
• "Compare" → shared context → key differences → implications
• Ethics → dilemma framed → frameworks applied → personal stand
• Literature → theme → how work/author addresses it → contemporary relevance

Evidence MUST FIT the subject:
• Polity/Law → Articles, SC judgments, Law Commission, Parliamentary committees
• Economy → figures, scheme outcomes, RBI/World Bank/budget data
• Environment → IPCC, species/forest data, NDC targets, Paris/CBD agreements
• Literature/Language → lines from the work, the author's words, literary movements, critical reception
• History → dates, leaders, movements, primary sources, historians' views
• Ethics/Philosophy → thinkers (Rawls, Kant, Gandhi, Ambedkar) + dilemma case studies
• Social Issues → NFHS, SRS, state success stories, ground-level examples
• Science/Tech → specific achievements, rankings, India's milestones

Use <strong> for every key term, name, data point, article number.
Use <h3> sub-headings only where they genuinely help, not to look structured.

━━━ STEP 4 — SUPPORTING ELEMENTS (only if they add value)
• <div class="note-box"> for a tight set of key facts/quotes that support but don't repeat the body
• <div class="key-point"> for the ONE core definition that anchors the answer
• <table> only if comparative/timeline data is genuinely clearer than prose

━━━ STEP 5 — CONCLUSION
A genuine verdict, not a template:
• Tie back to the question's core tension
• Governance/policy → forward-looking recommendation
• Literature/philosophy → enduring relevance of the idea
• Ethics → personal, reasoned stand
• DO NOT start with "Thus", "Hence", "In conclusion"
Under 50 words. Make it memorable.

RULES: ~${wordLimit} words total. No "It is well known that…", no hollow filler.
Return ONLY raw HTML. No markdown fences.
`;

  // ── STYLE 3: BULLET HEAVY ───────────────────────────────────────────────
  // Scannable, point-based format — good for time-pressured exam writing
  if (style === 'bullets') return `
Write a UPSC Mains answer in a clean, scannable bullet-point format — the kind toppers write when they want maximum information density and readability in minimum time.

Question: "${question}"
Language: ${lang}
Word Limit: ~${wordLimit} words

FORMAT RULES:
• Introduction: 2-3 crisp lines. One striking fact or quote to open, then context. No <h2> heading needed — just a strong opening paragraph.
• Body: Use <h3> sub-headings (4-6 words max). Under each, use tight <ul><li> bullet points:
  - Each bullet = 1 clear point + 1 supporting fact/example (same line, comma separated)
  - Bullet length: 10-20 words max. No long sentences.
  - <strong> on every key term, number, name, article, scheme
  - 4-6 bullets per section, 3-4 sections max
• Use <div class="note-box"> for a "Quick Facts" box with 3-5 data points (years, stats, names)
• Conclusion: 2 lines — one core message + one forward-looking line. No heading.

STYLE: Think newspaper column meets textbook summary. Dense. No fluff. Every bullet earns its place.
Vary evidence by topic — literature gets quotes and authors, polity gets articles and judgments, economy gets data, not court cases everywhere.

Return ONLY raw HTML. No markdown.
`;

  // ── STYLE 4: ANALYTICAL / CRITICAL ──────────────────────────────────────
  // Deep examination of multiple angles — suits "critically evaluate", "examine", "how far" questions
  return `
Write a deeply analytical UPSC Mains answer that examines the question from multiple angles — the way a thoughtful civil servant would approach a complex policy or philosophical problem.

Question: "${question}"
Language: ${lang}
Word Limit: ~${wordLimit} words

APPROACH:
This is NOT a recall answer. It is an ANALYSIS answer. The examiner wants to see:
1. That you understand the complexity and tensions in the issue
2. That you can weigh evidence on different sides
3. That you can arrive at a nuanced, reasoned conclusion

STRUCTURE (adapt as needed):
• Opening: Frame the central tension or debate in the question — not just define the topic. What is the crux of what is being asked?
• Section 1 — The case FOR / The strengths / The argument: Present the strongest evidence supporting one side. Use specific facts, examples, data.
• Section 2 — The case AGAINST / The limitations / The counter-argument: Present genuine challenges, failures, or critiques with evidence. Don't strawman.
• Section 3 — Nuances / Missing dimensions / What the debate misses: What complicates the picture? Regional variation? Historical context? Stakeholder differences?
• Section 4 (optional) — Way forward / Resolution: Only if the question asks for it or if it naturally follows.
• Conclusion: A clear, reasoned personal verdict. Don't sit on the fence — take a position and defend it briefly.

EVIDENCE: Match to subject.
• Philosophy/Ethics → thinkers, moral frameworks, real dilemmas
• Policy/Governance → data, scheme outcomes, committee findings, international comparisons
• Literature → textual evidence, critical perspectives, historical context of the work
• Economy → figures, indices, policy impact assessments
Use <strong> for key terms, names, data. Use <div class="key-point"> for the central analytical claim.

TONE: Precise. Confident. Intellectual. Avoid both blind support and blind criticism.

Return ONLY raw HTML. No markdown.
`;
};

// Generate UPSC Mains Answer
export const generateUPSCAnswer = async (
  question: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview",
  wordLimit: number = 250,
  answerStyle: UPSCAnswerStyle = 'topper'
): Promise<string> => {
  const ai = createAIClient();
  const prompt = buildUPSCPrompt(question, language, wordLimit, answerStyle);

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
    4. **Visual Explanation (Diagram):** Include ONE highly detailed SVG diagram inside a <div class="flowchart-container"> to visually explain a complex process, relationship, or framework from the files. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
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

    **CRITICAL RULES — READ FIRST:**
    0. **PRESERVE THE HEADING:** The Input HTML starts with a heading element (h1/h2/h3/h4). You MUST output that EXACT heading element (same tag, same number, same text) as the VERY FIRST element of your output. NEVER remove, rename, or skip it. Example: if input starts with <h2>1.3 Topic Name</h2>, your output MUST start with <h2>1.3 Topic Name</h2>.
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
    7. **Diagram (Optional):** If the new content has a clear visual structure, add ONE SVG inside <div class="flowchart-container">. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
    
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
    Role: Expert Information Designer & Data Visualizer.
    Task: Create a highly detailed, visually appealing SVG Diagram (Flowchart, Mindmap, Hierarchy, Timeline, etc.) based on the user's instruction and context.
    
    Context: "${contextText}"
    Instruction: "${instruction}"
    
    **SVG REQUIREMENTS:**
    1. **Format:** Return ONLY valid, raw <svg> code. Do NOT wrap it in markdown blocks (\`\`\`html or \`\`\`svg).
    2. **Responsiveness:** Use a proper \`viewBox\` (e.g., \`viewBox="0 0 800 600"\`). Do NOT use fixed width/height attributes on the <svg> tag.
    3. **Styling:** 
       - Background: Transparent or very light (e.g., #f8fafc).
       - Text: Must be readable, use standard fonts (font-family="sans-serif"), and appropriate sizes.
       - Colors: Use a professional palette (e.g., #3b82f6 for primary nodes, #1e293b for text, #cbd5e1 for lines).
    4. **Layout:** Ensure nodes are well-spaced. Paths/lines connecting nodes should be clear.
    5. **Content:** The diagram MUST accurately reflect the instruction (e.g., if asked for a mindmap, create a central node with branching paths).
    
    Output: ONLY the <svg>...</svg> code.
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
    6. **Visual Diagram (SVG):** MUST include ONE highly detailed SVG diagram inside a <div class="flowchart-container"> to visually explain a complex process, relationship, framework, or timeline related to the topic. Ensure the SVG is clean, readable, and responsive (use viewBox). DO NOT include a border on the SVG itself.
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
    Task: This is page ${pageNumber} of ${totalPages} from a PDF. Translate ALL academic/educational content into Hindi (Devanagari script) with proper structure.

    ═══ RULE 1 — SKIP COMPLETELY (do NOT include in output): ═══
    • Coaching institute logos, institute name banners, institute address
    • Watermarks (e.g. "VISION IAS", "DRISHTI IAS", "SHANKAR IAS" etc.)
    • Page headers that only contain institute branding or batch/course names
    • Contact info: phone numbers, email addresses, websites (www.xxx.com)
    • Social media handles (@instagram, @youtube etc.)
    • "Powered by", "Visit us at", copyright lines
    • Standalone page numbers (e.g. just "12" or "Page 12")
    • Advertisement banners or promotional content
    Output NOTHING for these — just skip them silently.

    ═══ RULE 2 — TRANSLATE ALL EDUCATIONAL CONTENT: ═══
    Every heading, subheading, paragraph, bullet point, numbered list, table cell, caption, label, footnote — translate fully to Hindi. Do NOT leave any English text (except technical terms in parentheses).

    ═══ RULE 3 — READING ORDER & LAYOUT: ═══
    • Single-column: read top → bottom.
    • Two-column layout: read the ENTIRE LEFT column (top → bottom) first, then the ENTIRE RIGHT column (top → bottom). DO NOT interleave columns.
    • If a heading spans the full width above two columns, output it first, then left column, then right column.
    • Ignore decorative dividers, ornamental borders, and visual separators between columns.

    ═══ RULE 4 — HTML STRUCTURE: ═══
    Match the visual hierarchy exactly:
    • Full-width section title (large heading) → <h2>
    • Sub-section heading → <h3>
    • Minor sub-heading → <h4>
    • Body text paragraphs → <p>
    • Bullet/numbered lists → <ul><li> or <ol><li>
    • Tables → full <table><caption>Hindi title</caption><thead><tbody><tr><th><td>
    • Bold/key terms → <strong>
    • Shaded/colored definition/concept box → <div class="key-point"><strong>मुख्य बिंदु:</strong> ...</div>
    • Shaded fact box, "Did You Know", sidebar, tip box → <div class="note-box">...</div>
    • Practice question / numbered MCQ → <ol class="question-list"><li class="question-item">...</li></ol>
    • Mathematical expressions → use Unicode symbols (₂, ³, ≥, ≤, →, ∑ etc.) inside <span class="math">
    • All sections must be wrapped in <div class="page-section">

    ═══ RULE 5 — IMAGES & DIAGRAMS (CRITICAL — NO TEXT OVERLAP): ═══
    For EVERY image, photo, diagram, chart, graph, map, flowchart, or illustration:
    • Output <pdf-img> as a STANDALONE BLOCK — NEVER inside <p>, <li>, or <td>.
    • Always place it BETWEEN complete block elements (after a closing </p>, </ul>, </div>, NOT inside them).
    • Precise PERCENTAGE coordinates (0–100) relative to this page:
        data-x = left edge % of page width
        data-y = top edge % of page height
        data-w = width % of page width
        data-h = height % of page height
    • CORRECT placement example:
        </p>
        <pdf-img data-x="5" data-y="30" data-w="88" data-h="22" data-page="${pageNumber}" data-alt="भारत का राजनीतिक मानचित्र — राज्य सीमाएँ दर्शाता है"/>
        <p>अगला पैराग्राफ...
    • WRONG placement: <p>कुछ text <pdf-img .../> और text</p>  ← NEVER do this.
    • data-page must always be "${pageNumber}".
    • data-alt = descriptive Hindi caption (what the image shows, its key labels/elements).
    • NEVER skip or omit any image/diagram — always mark every one.

    ═══ RULE 6 — TABLES: ═══
    • Translate ALL headers and cells to Hindi.
    • Keep the complete table structure — same number of rows and columns.
    • Add <caption> with a descriptive Hindi title.
    • Use <strong> inside <th> cells.

    ═══ RULE 7 — TECHNICAL TERMS & NAMES: ═══
    • Proper nouns (people, places, organizations, acts, schemes) → Hindi transliteration.
    • Scientific/technical terms → Hindi translation (English) in parentheses.
    • Numbers, dates, and statistics → keep in original numerals.
    • Article numbers (अनुच्छेद 21), schedule names → translate label, keep number.

    ═══ RULE 8 — OUTPUT FORMAT: ═══
    Return ONLY raw HTML — no markdown fences (\`\`\`html), no explanations, no comments.
    Start directly with <div class="page-section"> or the first heading tag.
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

// Generate next related UPSC question from current topic
export const generateNextUPSCQuestion = async (
  currentQuestion: string,
  language: string,
  modelName: string = "gemini-3-flash-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
You are a UPSC Mains question paper setter (GS Paper 2 / GS Paper 3 level).

Based on the following answered UPSC question, generate ONE new UPSC Mains question that:
1. Tests a DIFFERENT DIMENSION of the same topic OR a closely related adjacent topic
2. Uses a different directive word (if previous was "Discuss", use "Analyze" / "Critically evaluate" / "Examine" / "Assess" / "Comment on")
3. Is 1-2 sentences, precise, and exam-worthy
4. Is relevant to current affairs (2022-2025) if possible
5. Should be in ${language} language

Previous Question: "${currentQuestion}"

Return ONLY the question text — no numbering, no quotes, no explanation.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt
  });

  return (response.text || "").trim().replace(/^["']|["']$/g, '');
};

// Generate One Pager Notes — compact, single-page per topic
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
  });

  return cleanHtmlOutput(response.text || "");
};
