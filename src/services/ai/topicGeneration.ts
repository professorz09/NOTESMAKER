import { createAIClient, cleanHtmlOutput, DETAILED_NOTES_CONFIG } from './client';

export const generateTopicContent = async (
  topic: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Senior Subject-Matter Expert, Professor & Exam Mentor.
    Task: Write the MOST DETAILED, IN-DEPTH, EXHAUSTIVE and PERFECTLY STRUCTURED study notes possible on the topic — the kind a topper would want as a single complete reference, comparable to a full chapter in a definitive textbook. Cover EVERY important dimension of the topic; leave no major sub-topic unexplained, unexpanded, or merely mentioned in passing.
    Model Config: Maximize depth + length + information density. No filler, no repetition, no padding — but also no premature wrap-up. Longer and more thorough is strictly better than shorter here.

    Topic: "${topic}"
    Language: ${language}

    **LENGTH TARGET (do not undershoot):** Treat this as writing a complete reference chapter, not a summary. For a normal-sized topic this typically means 8-15+ major sections (h2), each with multiple sub-sections (h3/h4), each sub-section carrying several full paragraphs' worth of explanation and bullets. For a broad topic (an entire subject area, a whole historical period, a full constitutional part, etc.) go even longer and split it into more sections rather than compressing. If you find yourself able to stop early, you have not gone deep enough — keep expanding sub-topics, add more examples, add more sections until the topic is genuinely exhausted.

    **STRUCTURE — you decide what fits the topic:**
    You are free to organize the notes in whatever way best suits THIS topic — decide yourself whether to open with an introduction/overview, how to order the sections, and how (or whether) to close. No fixed template is imposed. Just make it well-structured, logical and easy to study from.

    **TEACHING STYLE (study-friendly):**
    For each concept, first state it simply in one clear line, THEN go deep with the details, mechanism, and facts. Use simple language for explanation but keep technical terms accurate. Add short concrete examples ("e.g., …") to make abstract points click. The notes should be good enough to study from directly — clear, complete and easy to revise. Maximize detail and structure for the topic.

    **COVERAGE — be exhaustive (adapt to what THIS topic genuinely needs):**
    Think first about ALL the angles this topic has, then cover each one as its own section. Depending on the topic this may include: definition & meaning, background/history & evolution, core concepts & principles, classification/types, key features/characteristics, working/mechanism/process, components/structure, causes & effects, advantages & limitations, important facts/data/figures, key persons/committees/articles/dates, examples & case studies, related concepts, current relevance/applications, criticism/challenges, and way forward. Do NOT skip a dimension that matters for this topic.

    **STRICT NUMBERING & STRUCTURE RULES:**
    The MAIN TITLE (h1) must have NO number — just the plain topic title. Number everything BELOW it hierarchically. The structure must be logical and go deep (at least 3 levels where the content supports it).
    - <h1>[Main Title]</h1>            ← NO number on the main title
    - <h2>1. [Major Section]</h2>
    - <h3>1.1 [Sub-Section]</h3>
    - <h4>1.1.1 [Detailed Point]</h4>

    **CONTENT REQUIREMENTS — DEPTH ON EVERY POINT (most important):**
    1. **Explain every point fully:** Each numbered point must be a real, self-contained explanation — not a one-line heading. After every sub-heading write the actual substance: what it is, why it matters, how it works, with concrete facts. NEVER output a heading with empty or trivial content under it.
    2. **Use bullets for sub-points:** Under each sub-section, use <ul><li> to break the explanation into clear, complete points. Each bullet should be a full, informative sentence (not 2–3 words).
    3. **Be concrete:** Include real data — dates, years, numbers, percentages, names, article/section numbers, examples — wherever they exist. Prefer specifics over vague statements.
    4. **Mandatory examples:** EVERY major sub-section (h3/h4) must include at least one concrete, real-world example, case, or illustration — never leave an explanation abstract when a real example would make it click.
    5. **Density:** "More facts, fewer filler words." Pack maximum information; avoid generic intros like "It is important to note that…".
    6. **Key Concepts:** Wrap vital definitions / must-remember points in: <div class="key-point"><strong>Key Concept:</strong> ...text...</div>
    7. **Notes / Extra facts:** Use <div class="note-box">...text...</div> for important extra facts, exceptions, or exam-relevant trivia.
    8. **Bold key terms:** Wrap every important term, name, date and figure in <strong>.

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
    Include a table wherever it adds clear value over prose — for a broad topic that genuinely has multiple comparable dimensions, use 2-3 tables of different types rather than forcing everything into one. Use <thead><tr><th> and <tbody>. Use <ul><li> inside <td> for multiple points per cell.

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
