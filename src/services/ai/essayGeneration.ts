import { createAIClient, cleanHtmlOutput, ESSAY_CONFIG, withGoogleSearch } from './client';

// ---------------------------------------------------------------------------
// UPSC Mains Essay Paper (250 marks — two essays, ~1000-1200 words each).
// Deliberately NOT the same shape as a GS answer: a real essay paper essay is
// continuous reflective prose exploring a topic/quote from multiple angles
// (philosophical, social, economic, political, ethical, historical, global),
// with a running argument — not <h3>-headed, bullet-heavy exam-copy writing.
// Grounding is optional (off by default would lose real quotes/dates, so it
// defaults on, same as UPSC answers) since real quotes/anecdotes/data are
// what separates a topper's essay from a generic one.
// ---------------------------------------------------------------------------

const GROUNDING_RULE = `
━━━ GROUNDING — USE GOOGLE SEARCH FOR REAL MATERIAL ━━━
You have live Google Search grounding. USE IT before writing to pull in real, verifiable material — do NOT rely on memory alone for anything checkable:
• Exactly-quoted lines from thinkers, poets, leaders, scriptures — correctly attributed
• Real historical incidents/turning points with correct dates
• Actual current data, schemes, reports, or events relevant to the theme
• Real committee/report findings if the theme touches policy
Never invent a quote, date, or attribution that sounds plausible — a genuine, well-known example beats a fabricated specific one.
`;

export const generateEssay = async (
  topic: string,
  language: string,
  modelName: string = 'gemini-3.1-pro-preview',
  grounded: boolean = true,
): Promise<string> => {
  const ai = createAIClient();

  const lang = language === 'Hindi'
    ? 'Hindi (Devanagari script). Write everything in Hindi.'
    : 'English';

  const prompt = `
    Role: A UPSC Civil Services topper writing for the Essay Paper (250 marks — this is judged on expression, coherence and depth of thought, NOT recall).
    Task: Write a complete, high-scoring essay on the given topic/quote.

    Topic/Quote: "${topic}"
    Language: ${lang}
    Length: A complete essay of about 1100-1300 words.
    ${grounded ? GROUNDING_RULE : ''}
    ━━━ WHAT MAKES THIS AN ESSAY, NOT A GS ANSWER ━━━
    - Continuous, reflective PROSE in flowing paragraphs — NOT <h2>/<h3> headed sections, NOT bullet points. An essay reads as one connected piece of thinking, not a structured answer.
    - Explore the theme from MULTIPLE genuine dimensions (whichever genuinely fit this topic — philosophical, social, economic, political, ethical, historical, scientific, environmental, global) — let the topic decide which ones matter, don't force all of them in.
    - Weave in REAL quotes, anecdotes, historical incidents, or contemporary examples naturally within the prose (not as a separate list) — this is what makes an essay memorable to an examiner reading dozens of them.
    - Maintain ONE running argument or thread across the whole essay — paragraphs should build on each other, not read as disconnected mini-answers stapled together.

    ━━━ STRUCTURE (as prose, not headings) ━━━
    1. Opening (1 paragraph): Hook with an exactly-quoted line, a real incident, or a sharp framing of the theme's central tension — then state the direction the essay will take.
    2. Body (5-8 paragraphs): Develop the theme across its real dimensions, each paragraph carrying its own real evidence (a quote, incident, data point, or example) and connecting logically to the next.
    3. Closing (1 paragraph): A reflective, forward-looking synthesis that ties back to the opening's framing — not a bullet summary, not "in conclusion".

    Use <strong> sparingly, only for the handful of names/dates/terms genuinely worth highlighting — an essay should not look like a revision sheet.
    Return ONLY raw HTML (<p> paragraphs; a <blockquote> is fine for one pivotal quoted line). No markdown, no headings, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: withGoogleSearch(ESSAY_CONFIG, grounded),
  });

  return cleanHtmlOutput(response.text || '');
};
