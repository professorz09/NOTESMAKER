import { createAIClient, cleanHtmlOutput, UPSC_ANSWER_CONFIG } from './client';

// Shared instruction injected into every answer style: use live Google
// Search grounding to pull real, current, and verifiable facts rather than
// approximating or inventing them. This is what makes article numbers, case
// names/years, scheme names, and statistics trustworthy instead of
// plausible-sounding guesses.
const GROUNDING_RULE = `
━━━ GROUNDING — USE GOOGLE SEARCH FOR REAL FACTS ━━━
You have live Google Search grounding. USE IT to verify and pull in real, current, and accurate facts before writing — do NOT rely on memory alone for anything checkable:
• Exact Constitutional Article/Schedule numbers and their actual wording
• Real Supreme Court / High Court case names with correct year and holding
• Actual scheme names, launch years, and their real objectives/outcomes
• Latest available data — GDP figures, indices, rankings, census/NFHS/SRS numbers, budget allocations
• Correct committee/commission names and their real recommendations
• Accurate quotes/lines when citing a thinker, poet, or author
Never invent a citation, date, or number that sounds plausible — if unsure after searching, phrase it generally rather than stating a fake specific. Wrong specifics lose more marks than a well-reasoned general point.
`;

export type UPSCAnswerStyle = 'auto' | 'topper' | 'bullets' | 'analytical';
export type UPSCSubject = 'gs' | 'hindi_literature';

// Correct user's question to proper formal Hindi
export const correctQuestionHindi = async (
  question: string,
  modelName: string = "gemini-3.1-flash-lite"
): Promise<string> => {
  const ai = createAIClient();
  const prompt = `आप एक हिंदी भाषा विशेषज्ञ हैं। उपयोगकर्ता ने एक UPSC प्रश्न लिखा है जो Hinglish, टूटी-फूटी हिंदी या मिश्रित भाषा में हो सकता है।

आपका काम: इस प्रश्न को सही, औपचारिक, परीक्षा-स्तरीय शुद्ध हिंदी (देवनागरी लिपि) में लिखें।
- वर्तनी, व्याकरण और शब्द-चयन सुधारें
- UPSC Mains के प्रश्न जैसा बनाएं
- अर्थ बिल्कुल वही रखें
- कोई व्याख्या या अनुवाद न जोड़ें
- केवल सुधरा हुआ प्रश्न लौटाएं — और कुछ नहीं

प्रश्न: "${question}"`;
  const response = await ai.models.generateContent({ model: modelName, contents: prompt });
  return (response.text || question).trim().replace(/^["']|["']$/g, '');
};

const buildHindiLiteraturePrompt = (
  question: string,
  wordLimit: number,
  style: UPSCAnswerStyle
): string => `
आप UPSC हिंदी साहित्य (वैकल्पिक विषय) के विशेषज्ञ परीक्षक और टॉपर मेंटर हैं।

प्रश्न: "${question}"
भाषा: हिंदी (देवनागरी लिपि) — सब कुछ हिंदी में लिखें
शब्द सीमा: लगभग ${wordLimit} शब्द
उत्तर शैली: ${style === 'bullets' ? 'बिंदुवार (Bullet Points)' : style === 'analytical' ? 'विश्लेषणात्मक' : 'टॉपर की प्रतिलिपि'}

━━━ ग्राउंडिंग — सही तथ्यों हेतु Google Search का प्रयोग करें ━━━
आपके पास live Google Search ग्राउंडिंग उपलब्ध है। लिखने से पहले इसका प्रयोग करके सुनिश्चित करें:
• काव्य-पंक्तियाँ/दोहे बिल्कुल सही शब्दों में उद्धृत हों (गलत उद्धरण से अंक कटते हैं)
• रचनाकारों की सही जन्म/रचनाकाल तिथियाँ और रचनाओं के सही नाम
• आलोचकों (रामचंद्र शुक्ल, हजारीप्रसाद द्विवेदी, नामवर सिंह आदि) के मत सही ढंग से संदर्भित हों
अनुमान या अस्पष्ट-सा लगने वाला उद्धरण देने से बेहतर है सामान्य किंतु सही बात लिखना।

━━━ UPSC हिंदी साहित्य पाठ्यक्रम के अनुसार ━━━
यह उत्तर UPSC IAS हिंदी साहित्य वैकल्पिक पेपर के पाठ्यक्रम पर आधारित होना चाहिए:

**प्रश्नपत्र-I (भाषा एवं साहित्य का इतिहास):**
• हिंदी भाषा का उद्भव एवं विकास — अपभ्रंश, अवहट्ट, आरंभिक हिंदी
• हिंदी की बोलियाँ — ब्रज, अवधी, खड़ीबोली, राजस्थानी, मैथिली
• आदिकाल: सिद्ध साहित्य, नाथ साहित्य, चारण साहित्य (रासो ग्रंथ)
• भक्तिकाल: कबीर, तुलसीदास, सूरदास, जायसी, मीराबाई (सगुण-निर्गुण धाराएँ)
• रीतिकाल: केशवदास, बिहारी, देव, घनानंद
• आधुनिक काल: भारतेंदु युग, छायावाद (प्रसाद, निराला, महादेवी, पंत), प्रगतिवाद, प्रयोगवाद, नई कविता
• गद्य: भारतेंदु हरिश्चंद्र, प्रेमचंद, जयशंकर प्रसाद, हजारीप्रसाद द्विवेदी, रामचंद्र शुक्ल
• नाटक, उपन्यास, कहानी, निबंध की विधाओं का विकास

**प्रश्नपत्र-II (प्रमुख रचनाएँ):**
• कबीर (बीजक), तुलसीदास (रामचरितमानस, कवितावली), सूरदास (भ्रमरगीत सार)
• जायसी (पद्मावत), बिहारी (सतसई), मीराबाई (पद)
• भारतेंदु हरिश्चंद्र (भारत-दुर्दशा), प्रेमचंद (गोदान, मानसरोवर)
• प्रसाद (कामायनी, ध्रुवस्वामिनी), निराला (राम की शक्तिपूजा, तुलसीदास)
• महादेवी वर्मा (यामा), अज्ञेय (शेखर: एक जीवनी), मुक्तिबोध (अंधेरे में)

━━━ उत्तर लिखने के नियम ━━━
1. **भूमिका (Introduction)**: संबंधित रचना/कवि की सटीक-उद्धृत पंक्ति या दोहे से शुरू करें, फिर 1 पंक्ति में प्रश्न का संदर्भ जोड़ें। 50 शब्दों से कम — पर प्रभावशाली।
2. **मुख्य भाग (Body)**: प्रश्न के अनुसार बहुआयामी विश्लेषण करें, स्पष्ट उपशीर्षकों के साथ:
   - साहित्यिक उद्धरण (काव्य-पंक्तियाँ, दोहे) — सही शब्दों में — अनिवार्य रूप से दें, हर उद्धरण के साथ 1-2 पंक्ति व्याख्या
   - रस, अलंकार, छंद, काव्य-गुण का उल्लेख करें जहाँ प्रासंगिक हो, ठोस उदाहरण सहित
   - साहित्यिक आंदोलन/युग से जोड़ें — सटीक तिथियों और संदर्भों के साथ
   - आलोचकों के मत: रामचंद्र शुक्ल, हजारीप्रसाद द्विवेदी, नामवर सिंह, रामविलास शर्मा — सही ढंग से उद्धृत
3. **साक्ष्य बॉक्स**: <div class="note-box"> में प्रमुख काव्य-पंक्तियाँ या आलोचनात्मक उद्धरण
4. **निष्कर्ष (Conclusion)**: "अतः"/"इस प्रकार" से शुरू न करें। समकालीन प्रासंगिकता या रचना के स्थायी महत्व से जोड़ते हुए 40 शब्दों में एक यादगार समापन दें।

HTML में लिखें: <h3> उपशीर्षक के लिए, <ul><li> बिंदुओं के लिए, <strong> मुख्य शब्दों के लिए।
केवल HTML लौटाएं। कोई markdown नहीं।
`;

const buildUPSCPrompt = (
  question: string,
  language: string,
  wordLimit: number,
  style: UPSCAnswerStyle,
  subject: UPSCSubject = 'gs'
): string => {
  if (subject === 'hindi_literature') {
    return buildHindiLiteraturePrompt(question, wordLimit, style);
  }

  const lang = language === 'Hindi'
    ? 'Hindi (Devanagari script). Write everything — headings, body, conclusion — in Hindi.'
    : 'English';

  if (style === 'auto') return `
Write a high-scoring UPSC Mains answer.

Question/Topic: "${question}"
Language: ${lang}
Word Limit: ~${wordLimit} words
${GROUNDING_RULE}
STRUCTURE:
• Introduction (<h2>): A sharp opening — a real fact, data point, quote, or constitutional/legal reference relevant to the question (verified via search), followed by 1-2 lines of context/definition. Under 50 words.
• Body (<h3> sub-headings): Cover the question's multiple dimensions in logical order. Every claim must be backed by a REAL, verified example — an actual scheme, case, data point, article, or event, never a vague generality standing alone.
• Conclusion (<h2>): A genuine forward-looking or balanced verdict tied back to the question's core ask. Do NOT start with "Thus" / "Hence" / "In conclusion". Under 50 words.

Use proper HTML: <h2> for Introduction & Conclusion, <h3> for body sections,
<ul><li> for points, <strong> for key terms/data/names.
Use <div class="note-box"> for important facts/data if relevant.

Return ONLY raw HTML. No markdown.
`;

  if (style === 'topper') return `
You are a seasoned UPSC Mains examiner and IAS mentor. Write an answer that reads like a genuine topper's copy — not a template.

Question: "${question}"
Language: ${lang}
Word Limit: ~${wordLimit} words
${GROUNDING_RULE}
━━━ STEP 1 — READ THE QUESTION
Before writing, silently identify:
• Subject/paper (Polity, Economy, History, Geography, Environment, Ethics, Literature, Science…)
• Directive word (Discuss / Analyze / Critically evaluate / Comment / Examine / Elaborate)
• What a good examiner wants to see for THIS specific question

━━━ STEP 2 — INTRODUCTION (make it a real hook, not a generic opener)
Pick the opening that BEST FITS the topic — not the same type every time. Every fact used here MUST be real and verified via search, never approximated:
• Literature / Philosophy / Ethics → an exactly-quoted line from a relevant thinker/poet/work, correctly attributed
• Polity / Governance → the specific constitutional Article/Schedule, a named and correctly-dated SC judgment, or an actual committee's finding
• Economy / Development → a real, current data point (with source: World Bank / NITI Aayog / RBI / Economic Survey) and its actual figure
• Environment → a verified IPCC/India-specific statistic or a real, correctly-dated climate/biodiversity event
• History / Culture → a real historical turning point with the correct date
• Social Issues → a real NFHS/Census/SRS/UNDP figure, correctly cited
• Science & Tech → a real, recent, correctly-dated breakthrough or India milestone
After the hook: 1-2 lines connecting it directly to what the question is asking. Keep intro under 60 words — every word earning its place.

━━━ STEP 3 — BODY (perfect, verified examples — this is what separates a topper's copy from a generic one)
Structure based on what THIS question genuinely needs — not a fixed template:
• "Discuss" → background → multiple dimensions → challenges → way forward
• "Critically evaluate" → what works (with evidence) → what doesn't → balanced verdict
• "Compare" → shared context → key differences → implications
• Ethics → dilemma framed → frameworks applied → personal stand
• Literature → theme → how work/author addresses it → contemporary relevance

EVERY example, case, scheme, judgment, or data point cited must be REAL and CORRECT — search to verify before writing, never approximate a plausible-sounding name/year/number:
• Polity/Law → exact Article numbers, real SC judgments (correct case name + year + actual holding), Law Commission report numbers, named Parliamentary committees
• Economy → real figures with year, actual scheme names + launch year + real outcome data, RBI/World Bank/budget data
• Environment → real IPCC AR6 findings, actual species/forest-cover data, real NDC targets, correctly-dated Paris/CBD agreements
• Literature/Language → exact lines from the work, correctly attributed author's words, real literary movements, actual critical reception
• History → correct dates, real leaders, real movements, primary sources, historians' actual views
• Ethics/Philosophy → real thinkers (Rawls, Kant, Gandhi, Ambedkar) with their actual positions + real-world dilemma case studies (not invented scenarios)
• Social Issues → real NFHS/SRS figures, actual state-level success stories with real outcomes
• Science/Tech → specific, real, correctly-dated achievements, rankings, India's actual milestones

Each body section should carry at least one such fully-verified concrete example — a claim without a real example reads as an opinion, not an exam-worthy answer.
Use <strong> for every key term, name, data point, article number.
Use <h3> sub-headings only where they genuinely help, not to look structured.

━━━ STEP 4 — SUPPORTING ELEMENTS (only if they add value)
• <div class="note-box"> for a tight set of key facts/quotes that support but don't repeat the body
• <div class="key-point"> for the ONE core definition that anchors the answer (no label, or name the actual term — never "Key Concept")
• <table> only if comparative/timeline data is genuinely clearer than prose

━━━ STEP 5 — CONCLUSION (the outro — make it land)
A genuine verdict, not a template:
• Tie back explicitly to the question's core tension — name it, don't restate the question
• Governance/policy → a specific, real forward-looking recommendation (not "more efforts should be made")
• Literature/philosophy → the enduring relevance of the idea, tied to something concrete today
• Ethics → personal, reasoned stand — take a side and defend it in one line
• DO NOT start with "Thus", "Hence", "In conclusion", "To conclude"
Under 50 words. Make the last line memorable — an examiner should remember your answer after reading dozens of others.

RULES: ~${wordLimit} words total. No "It is well known that…", no hollow filler, no invented facts.
Return ONLY raw HTML. No markdown fences.
`;

  if (style === 'bullets') return `
Write a UPSC Mains answer in a clean, scannable bullet-point format — the kind toppers write when they want maximum information density and readability in minimum time.

Question: "${question}"
Language: ${lang}
Word Limit: ~${wordLimit} words
${GROUNDING_RULE}
FORMAT RULES:
• Introduction: 2-3 crisp lines. One striking, VERIFIED fact, data point, or quote to open (real source, real number — not approximated), then context. No <h2> heading needed — just a strong opening paragraph.
• Body: Use <h3> sub-headings (4-6 words max). Under each, use tight <ul><li> bullet points:
  - Each bullet = 1 clear point + 1 supporting REAL fact/example (same line, comma separated) — the example must be correct, not a plausible guess
  - Bullet length: 10-20 words max. No long sentences.
  - <strong> on every key term, number, name, article, scheme
  - 4-6 bullets per section, 3-4 sections max
• Use <div class="note-box"> for a "Quick Facts" box with 3-5 verified data points (years, stats, names)
• Conclusion (outro): 2 lines — one core message that directly answers the question's ask + one forward-looking or evaluative line. No heading. Do not restate the question.

STYLE: Think newspaper column meets textbook summary. Dense. No fluff. Every bullet earns its place.
Vary evidence by topic — literature gets exact quotes and authors, polity gets real articles and judgments, economy gets real data, not court cases everywhere.

Return ONLY raw HTML. No markdown.
`;

  return `
Write a deeply analytical UPSC Mains answer that examines the question from multiple angles — the way a thoughtful civil servant would approach a complex policy or philosophical problem.

Question: "${question}"
Language: ${lang}
Word Limit: ~${wordLimit} words
${GROUNDING_RULE}
APPROACH:
This is NOT a recall answer. It is an ANALYSIS answer. The examiner wants to see:
1. That you understand the complexity and tensions in the issue
2. That you can weigh evidence on different sides
3. That you can arrive at a nuanced, reasoned conclusion

STRUCTURE (adapt as needed):
• Opening (intro): Frame the central tension or debate in the question using one real, verified fact or reference point — not just define the topic. What is the crux of what is being asked?
• Section 1 — The case FOR / The strengths / The argument: Present the strongest evidence supporting one side. Use specific, VERIFIED facts, examples, data — not approximated ones.
• Section 2 — The case AGAINST / The limitations / The counter-argument: Present genuine challenges, failures, or critiques with real evidence. Don't strawman.
• Section 3 — Nuances / Missing dimensions / What the debate misses: What complicates the picture? Regional variation? Historical context? Stakeholder differences? Back each with a real example.
• Section 4 (optional) — Way forward / Resolution: Only if the question asks for it or if it naturally follows.
• Conclusion (outro): A clear, reasoned personal verdict tied directly to the central tension named in the opening. Don't sit on the fence — take a position and defend it briefly. Do not start with "Thus"/"Hence"/"In conclusion".

EVIDENCE: Match to subject — every example must be real and correct, verified via search, never an invented or approximated specific.
• Philosophy/Ethics → real thinkers with their actual positions, moral frameworks, real (not hypothetical) dilemma cases
• Policy/Governance → real data, actual scheme outcomes, real committee findings, genuine international comparisons
• Literature → exact textual evidence, real critical perspectives, accurate historical context of the work
• Economy → real figures, real indices, real policy impact assessments with correct years
Use <strong> for key terms, names, data. Use <div class="key-point"> for the central analytical claim (no label, or name the actual term — never "Key Concept").

TONE: Precise. Confident. Intellectual. Avoid both blind support and blind criticism.

Return ONLY raw HTML. No markdown.
`;
};

export const generateUPSCAnswer = async (
  question: string,
  language: string,
  modelName: string = "gemini-3.1-pro-preview",
  wordLimit: number = 250,
  answerStyle: UPSCAnswerStyle = 'topper',
  subject: UPSCSubject = 'gs'
): Promise<string> => {
  const ai = createAIClient();
  const prompt = buildUPSCPrompt(question, language, wordLimit, answerStyle, subject);
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { ...UPSC_ANSWER_CONFIG, tools: [{ googleSearch: {} }] },
  });
  return cleanHtmlOutput(response.text || "");
};

export const generateNextUPSCQuestion = async (
  currentQuestion: string,
  language: string,
  modelName: string = "gemini-3.1-flash-lite",
  subject: UPSCSubject = 'gs'
): Promise<string> => {
  const ai = createAIClient();

  const isHindiLit = subject === 'hindi_literature';
  const prompt = isHindiLit ? `
आप UPSC हिंदी साहित्य वैकल्पिक पेपर के प्रश्न-पत्र निर्माता हैं।

निम्नलिखित उत्तरित प्रश्न के आधार पर एक नया UPSC हिंदी साहित्य का प्रश्न बनाएं जो:
1. उसी रचना/कवि के किसी अलग पहलू को परखे — या निकट संबंधित रचनाकार/युग पर हो
2. अलग निर्देशात्मक शब्द प्रयोग करे (यदि पहले "विवेचना" था तो "समीक्षा" / "विश्लेषण" / "मूल्यांकन" / "तुलना" प्रयोग करें)
3. 1-2 वाक्य में हो, सटीक और परीक्षा-योग्य
4. शुद्ध हिंदी (देवनागरी) में हो

पिछला प्रश्न: "${currentQuestion}"

केवल प्रश्न का पाठ लौटाएं — कोई क्रमांक, उद्धरण या स्पष्टीकरण नहीं।
` : `
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
