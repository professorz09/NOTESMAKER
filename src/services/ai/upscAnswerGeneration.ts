import { createAIClient, cleanHtmlOutput } from './client';

export type UPSCAnswerStyle = 'auto' | 'topper' | 'bullets' | 'analytical';
export type UPSCSubject = 'gs' | 'hindi_literature';

// Correct user's question to proper formal Hindi
export const correctQuestionHindi = async (
  question: string,
  modelName: string = "gemini-3-flash-preview"
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
आप UPSC हिंदी साहित्य वैकल्पिक विषय के सर्वश्रेष्ठ विशेषज्ञ हैं — 25 वर्षों का अनुभव, सैकड़ों टॉपर तैयार किए हैं।

प्रश्न: "${question}"
भाषा: हिंदी (देवनागरी लिपि) — सब कुछ हिंदी में
शब्द सीमा: लगभग ${wordLimit} शब्द

━━━ STEP 1 — प्रश्न को पहचानें ━━━
उत्तर लिखने से पहले मन में तय करें:
• यह प्रश्न किस विधा का है? → कविता / उपन्यास / नाटक / कहानी / भाषा-इतिहास / आलोचना
• किस काल का है? → आदिकाल / भक्तिकाल / रीतिकाल / आधुनिक काल
• निर्देशात्मक शब्द क्या है? → विवेचना / समीक्षा / विश्लेषण / तुलना / मूल्यांकन / टिप्पणी

━━━ STEP 2 — भूमिका (Introduction) ━━━
प्रश्न से संबंधित रचना/रचनाकार की एक मशहूर, सटीक पंक्ति से शुरू करें:
• कविता है → असली काव्य-पंक्ति या दोहा (जैसे कबीर का "माटी कहे कुम्हार से..." या तुलसी का "सियाराम मय सब जग जानी")
• उपन्यास है → रचना के किसी पात्र का संवाद या लेखक की प्रसिद्ध उक्ति
• नाटक है → नाटक का प्रसिद्ध संवाद या गीत-पंक्ति
• कहानी है → कहानी की पहली पंक्ति या मुख्य पंक्ति
पंक्ति के बाद 2-3 वाक्य में संदर्भ दें। भूमिका 50 शब्द से कम।

━━━ STEP 3 — मुख्य भाग (Body) ━━━
${style === 'bullets' ? 'बिंदुवार (Bullet Heavy) शैली — हर बिंदु 10-20 शब्द, <strong> से मुख्य पद।' : style === 'analytical' ? 'विश्लेषणात्मक शैली — पक्ष → विपक्ष → निष्कर्ष।' : 'टॉपर की विवेचनात्मक शैली — गहन विश्लेषण, प्रमाण सहित।'}

प्रश्न के अनुसार इनमें से जो उचित हो वह कवर करें:

▶ **कविता / काव्य के लिए:**
- कवि का जीवन-परिचय (संक्षेप में) और युग-पृष्ठभूमि
- रचना की मुख्य थीम/भावभूमि
- कम से कम 2-3 असली काव्य-पंक्तियाँ / दोहे / पद उद्धृत करें — इटैलिक में <em>
- रस, अलंकार, छंद का नामोल्लेख (जैसे: "यहाँ वात्सल्य रस की परिपक्व अभिव्यक्ति है")
- काव्य-विशेषताएँ (भाषा: ब्रज/अवधी/खड़ीबोली; भाव: भक्ति/श्रृंगार/वीर/करुण)
- तुलना: अन्य कवि या धारा से संक्षेप में

▶ **उपन्यास के लिए:**
- उपन्यास का कथानक-सार (2-3 पंक्ति)
- मुख्य पात्र और उनकी भूमिका: उदा. "होरी का संघर्ष भारतीय किसान की नियति का प्रतीक है"
- कम से कम 1-2 मुख्य पंक्ति/संवाद रचना से उद्धृत करें — <em> में
- उपन्यास की तकनीक: यथार्थवाद, मनोविश्लेषण, धारा-प्रवाह चेतना, प्रतीकात्मकता
- सामाजिक/राजनैतिक संदर्भ: किसान-समस्या, स्त्री-विमर्श, दलित-विमर्श जैसा जो प्रासंगिक हो
- प्रमुख उपन्यास (UPSC पाठ्यक्रम): गोदान (प्रेमचंद), गबन, शेखर:एक जीवनी (अज्ञेय), मैला आँचल (फणीश्वरनाथ रेणु), तमस (भीष्म साहनी), वे दिन (निर्मल वर्मा), राग दरबारी (श्रीलाल शुक्ल)

▶ **नाटक के लिए:**
- नाटक का कथा-सार और नाट्य-संघर्ष
- मुख्य पात्रों की चरित्र-विवेचना
- कम से कम 1-2 प्रसिद्ध संवाद उद्धृत करें — <em> में
- नाट्य-तत्व: कथोपकथन, अभिनेयता, रंगमंचीयता, नाटकीय विडंबना
- प्रमुख नाटक (UPSC): भारत-दुर्दशा / अंधेर नगरी (भारतेंदु), चंद्रगुप्त / ध्रुवस्वामिनी / स्कंदगुप्त (प्रसाद), आधे-अधूरे / लहरों के राजहंस (मोहन राकेश), अंधायुग (धर्मवीर भारती)

▶ **कहानी के लिए:**
- कहानी का कथानक और केंद्रीय संघर्ष
- मुख्य पात्र और उनकी मनोदशा
- कहानी की प्रसिद्ध पंक्ति उद्धृत करें — <em> में
- शिल्प-विशेषताएँ: कथन-बिंदु (Point of View), वातावरण, प्रतीक, अंत की विशेषता
- प्रमुख कहानियाँ (UPSC): कफ़न / पूस की रात / नमक का दारोगा (प्रेमचंद), आकाशदीप / ममता (प्रसाद), रोज़ (अज्ञेय), मलबे का मालिक (मोहन राकेश), मारे गए गुलफ़ाम / पंचलाइट (रेणु), परिंदे (निर्मल वर्मा), वापसी (उषा प्रियंवदा)

▶ **भाषा / साहित्येतिहास के लिए:**
- अपभ्रंश→ अवहट्ट→ आरंभिक हिंदी→ ब्रज/अवधी→ खड़ीबोली का क्रम
- महत्त्वपूर्ण तिथियाँ और रचनाएँ (जैसे: "1000 ई. के आसपास अपभ्रंश का रूप बदला")
- हिंदी की बोलियाँ और उनके प्रमुख साहित्यकार

━━━ STEP 4 — साक्ष्य बॉक्स (Evidence Box) ━━━
<div class="note-box"> में डालें — प्रश्न के अनुसार चुनें:
• काव्य के लिए → 3-4 असली काव्य-पंक्तियाँ / दोहे (रचना + पंक्ति + संदर्भ)
• उपन्यास/कहानी के लिए → 2-3 संवाद/पंक्तियाँ + पात्र का नाम
• नाटक के लिए → 2 प्रसिद्ध संवाद + संदर्भ
• आलोचना के लिए → आलोचकों के मत: रामचंद्र शुक्ल, हजारीप्रसाद द्विवेदी, नामवर सिंह, रामविलास शर्मा, डॉ. नगेन्द्र

━━━ STEP 5 — निष्कर्ष ━━━
• रचना की स्थायी साहित्यिक/सांस्कृतिक उपलब्धि बताएं
• समकालीन प्रासंगिकता से जोड़ें
• "इस प्रकार" / "अतः" से शुरू न करें
• 40-50 शब्द, यादगार समापन

━━━ अनिवार्य नियम ━━━
✅ कम से कम 2-3 असली साहित्यिक उद्धरण/पंक्तियाँ <em> टैग में MUST हों
✅ <strong> से हर मुख्य पद, रचना-नाम, कवि-नाम, शब्द-शक्ति
✅ <h3> से उपशीर्षक, <ul><li> से बिंदु
✅ UPSC पाठ्यक्रम की रचनाओं का ही संदर्भ लें
✅ शुद्ध हिंदी — Hinglish या अंग्रेज़ी शब्द नहीं
✅ ~${wordLimit} शब्द
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
  answerStyle: UPSCAnswerStyle = 'topper',
  subject: UPSCSubject = 'gs'
): Promise<string> => {
  const ai = createAIClient();
  const prompt = buildUPSCPrompt(question, language, wordLimit, answerStyle, subject);
  const response = await ai.models.generateContent({ model: modelName, contents: prompt });
  return cleanHtmlOutput(response.text || "");
};

export const generateNextUPSCQuestion = async (
  currentQuestion: string,
  language: string,
  modelName: string = "gemini-3-flash-preview",
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
