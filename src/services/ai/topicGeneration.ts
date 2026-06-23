import { createAIClient, cleanHtmlOutput, DETAILED_NOTES_CONFIG } from './client';

export const generateTopicContent = async (
  topic: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Senior Subject-Matter Expert, Professor & Exam Mentor.
    Task: Write the MOST DETAILED, IN-DEPTH, EXHAUSTIVE and PERFECTLY STRUCTURED study notes possible on the topic — the kind a topper would want as a single complete reference. Cover EVERY important dimension of the topic; leave no major sub-topic unexplained.
    Model Config: Maximize depth + information density. No filler, no repetition, no padding.

    Topic: "${topic}"
    Language: ${language}

    **COVERAGE — be exhaustive (adapt to what THIS topic genuinely needs):**
    Think first about ALL the angles this topic has, then cover each one as its own section. Depending on the topic this may include: definition & meaning, background/history & evolution, core concepts & principles, classification/types, key features/characteristics, working/mechanism/process, components/structure, causes & effects, advantages & limitations, important facts/data/figures, key persons/committees/articles/dates, examples & case studies, related concepts, current relevance/applications, criticism/challenges, and way forward. Do NOT skip a dimension that matters for this topic.

    **STRICT NUMBERING & STRUCTURE RULES:**
    Use strict hierarchical numbering for ALL headings. The structure must be logical and go deep (at least 3 levels where the content supports it).
    - <h1>1. [Main Title]</h1>
    - <h2>1.1 [Major Section]</h2>
    - <h3>1.1.1 [Sub-Section]</h3>
    - <h4>1.1.1.1 [Detailed Point]</h4>

    **CONTENT REQUIREMENTS — DEPTH ON EVERY POINT (most important):**
    1. **Explain every point fully:** Each numbered point must be a real, self-contained explanation — not a one-line heading. After every sub-heading write the actual substance: what it is, why it matters, how it works, with concrete facts. NEVER output a heading with empty or trivial content under it.
    2. **Use bullets for sub-points:** Under each sub-section, use <ul><li> to break the explanation into clear, complete points. Each bullet should be a full, informative sentence (not 2–3 words).
    3. **Be concrete:** Include real data — dates, years, numbers, percentages, names, article/section numbers, examples — wherever they exist. Prefer specifics over vague statements.
    4. **Density:** "More facts, fewer filler words." Pack maximum information; avoid generic intros like "It is important to note that…".
    5. **Key Concepts:** Wrap vital definitions / must-remember points in: <div class="key-point"><strong>Key Concept:</strong> ...text...</div>
    6. **Notes / Extra facts:** Use <div class="note-box">...text...</div> for important extra facts, exceptions, or exam-relevant trivia.
    7. **Bold key terms:** Wrap every important term, name, date and figure in <strong>.

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

    **COMPLETENESS:** Cover the topic end-to-end. Do NOT stop after a few sections — keep going until every major dimension listed above is properly explained in depth. Quality and completeness matter more than brevity.

    **Output:** Return ONLY raw HTML. No markdown, no code fences, no commentary.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: DETAILED_NOTES_CONFIG,
  });
  return cleanHtmlOutput(response.text || "");
};
