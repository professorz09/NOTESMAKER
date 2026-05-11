import { createAIClient, cleanHtmlOutput } from './client';

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

export const generateUPSCAnswer = async (
  question: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview",
  wordLimit: number = 250,
  answerStyle: UPSCAnswerStyle = 'topper'
): Promise<string> => {
  const ai = createAIClient();
  const prompt = buildUPSCPrompt(question, language, wordLimit, answerStyle);
  const response = await ai.models.generateContent({ model: modelName, contents: prompt });
  return cleanHtmlOutput(response.text || "");
};

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

  const response = await ai.models.generateContent({ model: modelName, contents: prompt });
  return (response.text || "").trim().replace(/^["']|["']$/g, '');
};
