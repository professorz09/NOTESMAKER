import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, RESEARCH_GEN_CONFIG } from './client';

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
    - "This paper aims to...", "The purpose of this research is...", "This study was conducted because..."
    - Any meta-commentary about why the paper was written
    - Any "Methodology" or "Literature Review" sections (this is NOT an academic research paper)

    **INSTEAD — Write directly about the topic itself with full depth:**

    **STRUCTURE:**
    1. **Title (h1):** Clear, descriptive title of the topic.
    2. **Overview (h2):** A factual, concise executive summary — what this topic IS, its significance, and scope. 2-3 paragraphs.
    3. **Historical Background / Context (h2):** Origins, evolution, timeline. Use <strong> for key dates and names.
    4. **Core Subject Sections (h2/h3):** 3-5 detailed thematic or structural sections breaking down every important dimension of the topic.
    5. **Key Data / Statistics / Facts (Table):** MUST include one detailed HTML <table> with <caption>. Choose the format that best fits this specific topic.
    6. **Visual Diagram (SVG):** ONLY IF the topic has a genuinely complex process, structure, or relationship a diagram would clarify, include ONE highly detailed SVG diagram inside a <div class="flowchart-container"> (clean, readable, responsive — use viewBox, no border). If nothing warrants one, skip it entirely.
    7. **Key Takeaways (h2):** 5-8 bullet points summarizing the most important aspects of the topic.

    **Output:** Return ONLY raw HTML. No markdown. Use <h1>, <h2>, <h3>, <ul>, <li>, <table>, <strong>, <p>, <svg> etc.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { ...RESEARCH_GEN_CONFIG, tools: [{ googleSearch: {} }] }
  });

  return cleanHtmlOutput(response.text || "");
};

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
    2. **Preserve Structure EXACTLY:** Maintain the exact same document structure using proper HTML tags.
    3. **Images & Diagrams:** Wherever an image/chart/diagram appears in the PDF, insert a placeholder block at THAT EXACT POSITION using:
       <div class="image-placeholder">
         <div class="image-placeholder-icon">🖼️</div>
         <div class="image-placeholder-title">[Hindi title]</div>
         <div class="image-placeholder-desc">[2-3 lines describing in Hindi what this image depicts]</div>
       </div>
    4. **Tables:** Translate ALL table headers and cell content to Hindi. Keep full table structure.
    5. **Technical terms:** For proper nouns keep Hindi transliteration. For scientific/technical terms, write Hindi translation followed by English in parentheses.
    6. **Output:** Return ONLY raw HTML — no markdown code blocks, no explanations.
  `;

  const parts: any[] = [
    { inlineData: { data: fileData, mimeType: fileMimeType } },
    { text: prompt }
  ];

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: NOTES_GEN_CONFIG,
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
1. Identify the question being answered (read from the paper itself if visible, or infer from the answer content), and its marks.
2. Evaluate the answer exactly as a strict Mains examiner would.
3. Write a model answer at the length that question actually deserves.

━━━ HOW TO MARK ━━━
• Work out the question's marks first: read them off the paper if printed, else infer from the question's wording and expected length — a "टिप्पणी"/short note is 10, a standard analytical question 15, a long one 20. Say which you used.
• Score the SIX aspects below out of 10 each, so the rubric total is always out of 60. Use all six, no more, no fewer.
• Then convert that to the mark this answer would realistically get in the actual exam, out of the question's OWN marks (e.g. 9.5/15) — Mains marking is tight, so an average answer lands near 45-50% and only a genuinely excellent one crosses 65%.
• Be honest. An inflated score teaches the student nothing.

━━━ OUTPUT ━━━
Return clean HTML in EXACTLY this structure. Add NO inline style attributes — the app styles these classes itself, and hardcoded colours break the printed copy.

<div class="answer-analysis">

<div class="section-card sc-question">
<h2>📋 पहचाना गया प्रश्न</h2>
<p>[the identified question in Hindi; add the English wording after it if the copy was in English]</p>
<p><strong>[X] अंक का प्रश्न</strong> — [one line on what this question actually demands: विश्लेषण / आलोचनात्मक परीक्षण / वर्णन …]</p>
</div>

<div class="section-card sc-score">
<h2>📊 उत्तर का मूल्यांकन</h2>
<table>
<thead><tr><th>पहलू</th><th>अंक (10 में से)</th><th>टिप्पणी</th></tr></thead>
<tbody>
[EXACTLY six rows, in this order: भूमिका (Introduction), विषय-वस्तु की गहराई (Content Depth), संरचना एवं प्रवाह (Structure), उदाहरण/तथ्य/डेटा (Examples & Facts), निष्कर्ष (Conclusion), भाषा एवं प्रस्तुति (Language & Presentation).
Each row: <tr><td>[aspect]</td><td>[score]/10</td><td>[a specific comment on THIS answer, not a generic remark]</td></tr>]
</tbody></table>
<div class="aa-total"><strong>[rubric total]/60</strong> <span>मूल्यांकन स्कोर</span> <strong>[exam mark]/[question marks]</strong> <span>वास्तविक परीक्षा में अनुमानित अंक</span></div>
</div>

<div class="section-card sc-weak">
<h2>❌ कमियाँ (Weaknesses)</h2>
<ul>
[4-6 weaknesses. Each MUST point at something actually in this copy — quote the student's own phrase, or name the point/example they missed. No generic advice.]
</ul>
</div>

<div class="section-card sc-improve">
<h2>✅ सुझाव (Suggestions to Improve)</h2>
<ol>
[4-6 suggestions the student can act on in their NEXT answer. Each tied to a weakness above — say what to write instead, with the specific fact, scheme, article, committee or example that was missing.]
</ol>
</div>

<div class="section-card sc-model">
<h2>🏆 आदर्श उत्तर (Model Answer)</h2>
[A complete model answer at the length the marks call for: about 150 words for 10 marks, 250 for 15, 350 for 20 — a full answer, not an outline. Structure: भूमिका → body under <h3> sub-headings with <ul><li> points → निष्कर्ष. <strong> the key terms, data, article numbers and scheme names. Ground it in real specifics — actual committee names, article numbers, scheme names, data points, judgments — never placeholder facts.]
</div>

</div>

RULES:
- Write everything in Hindi (Devanagari), including the model answer, unless the question itself demands English.
- NO inline style attributes anywhere. Use only the classes shown above plus <h3>, <ul>, <ol>, <li>, <strong>, <table>.
- Never invent what the student wrote. If a passage is illegible, say so in the relevant comment rather than marking it as absent.
- Return ONLY the HTML — no markdown, no code fences.
`;

  const parts: any[] = [
    ...pageImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
    { text: prompt }
  ];

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: NOTES_GEN_CONFIG,
  });

  return cleanHtmlOutput(response.text || "");
};

// Read a topper's answer copy (handwritten or typed, any language, possibly
// several pages / photos) and reproduce it as ONE clean, properly-formatted
// answer — translated to the target language if the topper wrote in another.
// This transcribes and tidies the topper's OWN content (points, examples,
// data, quotes) — it does NOT invent new facts — then lays it out with proper
// exam-copy structure so it renders and exports cleanly.
export const generateAnswerFromTopperCopy = async (
  pageImages: { base64: string; mimeType: string }[],
  language: string = 'Hindi',
  modelName: string = 'gemini-3.1-pro-preview',
): Promise<string> => {
  const ai = createAIClient();

  const target = language === 'Hindi'
    ? 'Hindi (Devanagari script)'
    : language;

  const prompt = `
You are a UPSC Mains expert who cleanly digitises a TOPPER's handwritten answer copy.

The uploaded images are a topper's answer copy (handwritten or typed, possibly across several pages/photos). The topper may have written in English or Hindi. Your job:

1. READ the whole copy carefully — every point, sub-point, example, data figure, article/scheme/case name, quote and diagram label the topper actually wrote.
2. IDENTIFY the question being answered (read it from the top of the copy if visible, otherwise infer it precisely from the answer).
3. REPRODUCE the topper's answer FAITHFULLY — same points, same structure, same examples/data — but rewritten in ${target}, cleanly formatted.

━━━ HARD RULES ━━━
• FIDELITY FIRST: Use ONLY what the topper actually wrote. Do NOT add new examples, schemes, cases, data or quotes that aren't in the copy, and do NOT drop the topper's points. If a word is illegible, render the most sensible reading — never invent a fresh fact.
• LANGUAGE: Write the ENTIRE answer in ${target}, even if the topper wrote in English (translate faithfully). Keep proper nouns / Article numbers / scheme names accurate; a technical English term may follow in parentheses where helpful.
• Preserve the topper's own diagrams/flow as a <div class="note-box"> describing them in words if they can't be redrawn.

━━━ CLEAN EXAM-COPY FORMAT ━━━
Lay the answer out like a neat topper copy an examiner can scan:
• <h2>भूमिका</h2> — the topper's introduction, tight.
• Body: clearly LABELLED <h3> sub-headings (use the topper's own section labels where they wrote them), each with short <ul><li> points, one idea per bullet.
• <strong> every key term / name / figure the topper used.
• <div class="note-box"> for a small set of the topper's key facts/quotes if the copy has them.
• <h2>निष्कर्ष</h2> — the topper's conclusion.

━━━ OUTPUT (raw HTML only, no markdown) ━━━
Output EXACTLY this shape and nothing else:
<div class="tc-question">[the identified question, in ${target}]</div>
[the full formatted answer body: <h2>, <h3>, <ul><li>, <strong>, <div class="note-box"> …]
`;

  const parts: any[] = [
    ...pageImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
    { text: prompt },
  ];

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: NOTES_GEN_CONFIG,
  });

  return cleanHtmlOutput(response.text || '');
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
    • Contact info: phone numbers, email addresses, websites
    • Social media handles, advertisement banners, standalone page numbers
    Output NOTHING for these — just skip them silently.

    ═══ RULE 2 — TRANSLATE ALL EDUCATIONAL CONTENT: ═══
    Every heading, subheading, paragraph, bullet point, numbered list, table cell, caption, label, footnote — translate fully to Hindi. Do NOT leave any English text (except technical terms in parentheses).

    ═══ RULE 3 — READING ORDER & LAYOUT: ═══
    • Single-column: read top → bottom.
    • Two-column layout: read the ENTIRE LEFT column first, then the ENTIRE RIGHT column. DO NOT interleave columns.

    ═══ RULE 4 — HTML STRUCTURE: ═══
    Match the visual hierarchy exactly:
    • Full-width section title → <h2>
    • Sub-section heading → <h3>
    • Minor sub-heading → <h4>
    • Body text → <p>
    • Bullet/numbered lists → <ul><li> or <ol><li>
    • Tables → full <table><caption>Hindi title</caption><thead><tbody><tr><th><td>
    • Bold/key terms → <strong>
    • Definition/concept/formula/rule box (ONLY if the original page actually has one — don't add one that isn't in the source) → <div class="key-point"><strong>[उस box में असल में जो चीज़ है उसका नाम लिखें — कभी भी "मुख्य बिंदु" जैसा generic शब्द हर बार मत दोहराएं, या label बिल्कुल छोड़ भी सकते हैं]:</strong> ...</div>
    • Fact box → <div class="note-box">...</div>
    • All sections must be wrapped in <div class="page-section">

    ═══ RULE 5 — IMAGES & DIAGRAMS (CRITICAL — NO TEXT OVERLAP): ═══
    For EVERY image, photo, diagram, chart, graph, map, flowchart, or illustration:
    • Output <pdf-img> as a STANDALONE BLOCK — NEVER inside <p>, <li>, or <td>.
    • Always place it BETWEEN complete block elements.
    • Precise PERCENTAGE coordinates (0–100) relative to this page:
        data-x = left edge % of page width
        data-y = top edge % of page height
        data-w = width % of page width
        data-h = height % of page height
    • CORRECT placement example:
        </p>
        <pdf-img data-x="5" data-y="30" data-w="88" data-h="22" data-page="${pageNumber}" data-alt="भारत का राजनीतिक मानचित्र"/>
        <p>अगला पैराग्राफ...
    • WRONG placement: <p>कुछ text <pdf-img .../> और text</p> ← NEVER do this.
    • data-page must always be "${pageNumber}".
    • NEVER skip or omit any image/diagram.

    ═══ RULE 6 — OUTPUT FORMAT: ═══
    Return ONLY raw HTML — no markdown fences, no explanations, no comments.
    Start directly with <div class="page-section"> or the first heading tag.
  `;

  const parts: any[] = [
    { inlineData: { data: pageImageBase64, mimeType: imageMimeType } },
    { text: prompt }
  ];

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: NOTES_GEN_CONFIG,
  });

  return cleanHtmlOutput(response.text || "");
};
