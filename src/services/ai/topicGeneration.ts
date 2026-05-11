import { createAIClient, cleanHtmlOutput } from './client';

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

  const response = await ai.models.generateContent({ model: modelName, contents: prompt });
  return cleanHtmlOutput(response.text || "");
};
