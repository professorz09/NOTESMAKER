import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG } from './client';
import { parseOutlineJsonObject } from './outlineParsing';

// ---------------------------------------------------------------------------
// Daily Current Affairs pipeline. Three ways to feed it, one per CASource
// kind below:
//   - "video"   → paste one or more daily-CA video link(s). Facts come
//                 straight from the transcript, so no live search needed.
//   - "topics"  → type topic(s)/keyword(s) instead of a video — no transcript
//                 to draw facts from, so these are researched via live
//                 Google Search grounding instead.
//   - "general" → leave the box empty and just pick a date — grounding
//                 discovers whatever is actually exam-relevant that day
//                 (PIB releases, major policy/economy/int'l news, etc).
//
// Four generation styles, all on the fast Flash model (speed matters for a
// daily habit — this isn't a once-a-week deep topic):
//   - "quick"   → ONE call. For "video" it just reads the transcript and
//                 extracts what's exam-relevant — no search. For "topics"/
//                 "general" there's no transcript to extract from, so this
//                 one call carries live Google Search grounding instead —
//                 still a single call, just grounded rather than transcript-
//                 read.
//   - "deep"    → Perplexity/deep-research style, always grounded. Call 1
//                 gets the candidate topic list — extracted from the
//                 transcript for "video" (no search), taken directly from
//                 what the user typed for "topics" (no search), or DISCOVERED
//                 via a live grounded search of PIB and other trusted
//                 exam-oriented current-affairs sources for "general". Call 2
//                 is a SINGLE grounded call: for every topic it searches PIB
//                 (pib.gov.in) and other trusted UPSC sources to verify/date/
//                 expand it, then writes the final notes with a short
//                 "verified" source line per topic.
//   - "scan"    → Headline-only agentic style. For "general", discovery runs
//                 as TWO grounded calls IN PARALLEL against two different,
//                 non-overlapping source groups (PIB alone vs. every other
//                 trusted CA portal), merged and de-duplicated — so the list
//                 isn't shaped by one source's editorial picks. No writing
//                 call at all: the discovered headlines + one-line claims
//                 are formatted directly into notes.
//   - "agentic" → Same dual-grounding discovery as "scan", followed by ONE
//                 grounded writing call that gives each item a fuller
//                 paragraph plus a "static fact" box of background the
//                 item builds on (a constitution article, an institution's
//                 mandate, a definition) — not just the day's news but what
//                 a student should already know alongside it.
// ---------------------------------------------------------------------------

export const CURRENT_AFFAIRS_FLASH_MODEL = 'gemini-3.1-flash-lite';

// The grounded (search) step specifically needs a model that reliably ACTS
// on the googleSearch tool during a real writing call, not just accepts it —
// Flash Lite has been observed to skip invoking search on long generation
// calls even with the tool attached. gemini-3.7-flash ships with "Pro-level
// agentic capabilities" (launched Aug 2026) — fast and cheap like Flash, but
// trustworthy for tool-use like Pro — used for every call in this file that
// needs live search: quick mode's topics/general path, and both deep-mode
// calls whenever they're grounded.
const CURRENT_AFFAIRS_GROUNDED_MODEL = 'gemini-3.7-flash';

// Named once so every grounded prompt in this file points the model at the
// same trusted set — PIB first (it's the primary source UPSC current
// affairs is drawn from), then the standard trusted CA portals.
const TRUSTED_SOURCES = 'PIB (pib.gov.in — always check this first), PRS Legislative Research, The Hindu, Indian Express Explained, Down To Earth, Drishti IAS and Vision IAS';

// The two independent source groups used by "scan" and "agentic" mode's
// dual-grounding discovery step — kept as separate constants so the two
// parallel calls are genuinely searching different territory rather than
// two copies of the same prompt.
const PIB_SOURCE_GROUP = 'PIB (pib.gov.in) press releases only';
const OTHER_SOURCE_GROUP = 'PRS Legislative Research, The Hindu, Indian Express Explained, Down To Earth, Drishti IAS and Vision IAS (not PIB)';

export type CASource =
  | { kind: 'video'; transcriptText: string }
  | { kind: 'topics'; topics: string[] }
  | { kind: 'general' };

const sourceLabel = (dateLabel: string) => `daily current affairs video(s) dated ${dateLabel}`;

/**
 * Quick mode — one call. "video" reads the transcript with no search;
 * "topics"/"general" have no transcript to draw from, so the same single
 * call carries live Google Search grounding instead.
 */
export const generateCurrentAffairsQuick = async (
  source: CASource,
  dateLabel: string,
  language: string,
): Promise<string> => {
  const ai = createAIClient();

  if (source.kind === 'video') {
    const prompt = `
      Role: UPSC current-affairs editor.
      Task: Below is the transcript of ${sourceLabel(dateLabel)}. Extract ONLY the exam-relevant material and turn it into clean, structured current-affairs notes. Skip channel intros, sponsor reads, "like and subscribe", banter and anything with no factual/exam content.

      Language: ${language}
      Transcript:
      """${source.transcriptText}"""

      **WHAT COUNTS AS "USEFUL":** government schemes/policies, appointments, reports/indices/rankings, international relations/summits, science & tech developments, economy/budget items, environment/ecology news, defence/security, important days/persons in the news, court judgments, static-GK-linked current facts. Ignore pure entertainment/opinion filler.

      **STRUCTURE:**
      - Start with a single <h1> title: "Daily Current Affairs — ${dateLabel}".
      - One <h2> per distinct news item/topic, using a short specific headline (not "Topic 1").
      - Under each <h2>, give the essential facts as a tight bullet list (<ul><li>) — what happened, key names/numbers/dates, and (only if genuinely relevant) why it matters for the exam. Use <strong> for the facts most likely to be asked (names, figures, dates, scheme names).
      - Do NOT pad or add generic commentary. Every line must carry a real fact from the transcript.

      **Output:** Return ONLY raw HTML. No markdown, no code fences.
    `;

    const response = await ai.models.generateContent({
      model: CURRENT_AFFAIRS_FLASH_MODEL,
      contents: prompt,
      config: NOTES_GEN_CONFIG,
    });

    return cleanHtmlOutput(response.text || '');
  }

  const focus = source.kind === 'topics'
    ? `Focus specifically on these topic(s)/keyword(s), researching each against live search for what's current as of ${dateLabel}:\n${source.topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : `No specific topics were given — use live search to find what actually happened/was notable on ${dateLabel} across India (and world affairs relevant to India). Prioritize these trusted sources: ${TRUSTED_SOURCES}.`;

  const prompt = `
    Role: UPSC current-affairs editor with live web access.
    Task: Using Google Search, find the real, current, correctly-dated exam-relevant news for ${dateLabel} and turn it into clean, structured current-affairs notes.

    ${focus}

    Language: ${language}

    **WHAT COUNTS AS "USEFUL":** government schemes/policies, appointments, reports/indices/rankings, international relations/summits, science & tech developments, economy/budget items, environment/ecology news, defence/security, important days/persons in the news, court judgments, static-GK-linked current facts.

    **STRUCTURE:**
    - Start with a single <h1> title: "Daily Current Affairs — ${dateLabel}".
    - One <h2> per distinct news item/topic, using a short specific headline (not "Topic 1").
    - Under each <h2>, give the essential facts as a tight bullet list (<ul><li>) — what happened, key names/numbers/dates. Use <strong> for the facts most likely to be asked (names, figures, dates, scheme names).
    - Every fact must be real and search-backed for ${dateLabel} — never invented or approximated. Do not pad with generic commentary.

    **Output:** Return ONLY raw HTML. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: CURRENT_AFFAIRS_GROUNDED_MODEL,
    contents: prompt,
    config: { ...NOTES_GEN_CONFIG, tools: [{ googleSearch: {} }] },
  });

  return cleanHtmlOutput(response.text || '');
};

interface CATopic {
  headline: string;
  claim: string;
}

/** Deep mode, step 1 for "video" — cheap, no search: pull the candidate topics out of the transcript. */
const extractCurrentAffairsTopics = async (
  transcriptText: string,
  language: string,
): Promise<CATopic[]> => {
  const ai = createAIClient();

  const prompt = `
    Role: UPSC current-affairs editor.
    Task: Below is a daily current-affairs video transcript. List every distinct exam-relevant news item it covers — government schemes/policies, appointments, reports/indices, international relations, science & tech, economy, environment, defence, court judgments, important persons/days. Ignore intros, sponsor reads and filler.

    Language for headline: ${language}
    Transcript:
    """${transcriptText}"""

    For each item give:
    - "headline": a short specific headline for it
    - "claim": the key fact(s) exactly as stated in the transcript (1-2 sentences) — this will be fact-checked against live search next, so capture precisely what was claimed (names, numbers, dates).

    Output STRICT JSON ONLY (no markdown/code fences):
    { "topics": [ { "headline": "...", "claim": "..." } ] }
  `;

  const response = await ai.models.generateContent({
    model: CURRENT_AFFAIRS_FLASH_MODEL,
    contents: prompt,
    config: NOTES_GEN_CONFIG,
  });

  const obj = parseOutlineJsonObject(response.text || '');
  if (!obj || !Array.isArray(obj.topics)) return [];
  return obj.topics
    .map((t: any) => ({ headline: String(t?.headline || '').trim(), claim: String(t?.claim || '').trim() }))
    .filter((t: CATopic) => t.headline);
};

/**
 * Deep mode, step 1 for "general" — no transcript and no user-given topics,
 * so DISCOVER today's notable items via a grounded search of PIB + trusted
 * sources first, instead of extracting from anything.
 */
const discoverCurrentAffairsTopics = async (
  dateLabel: string,
  language: string,
): Promise<CATopic[]> => {
  const ai = createAIClient();

  const prompt = `
    Role: UPSC current-affairs editor with live web access.
    Task: Using Google Search, find the most exam-relevant news items for ${dateLabel} (India-focused, plus world affairs relevant to India). Prioritize these trusted sources: ${TRUSTED_SOURCES} — check PIB's press releases for ${dateLabel} first.

    Language for headline: ${language}

    List 6-10 distinct items covering: government schemes/policies, appointments, reports/indices/rankings, international relations/summits, science & tech, economy/budget, environment/ecology, defence/security, important days/persons, court judgments.

    For each item give:
    - "headline": a short specific headline for it
    - "claim": the key fact(s) found via search (1-2 sentences, with real names/numbers/dates) — this will be verified and expanded in the next step.

    Output STRICT JSON ONLY (no markdown/code fences):
    { "topics": [ { "headline": "...", "claim": "..." } ] }
  `;

  const response = await ai.models.generateContent({
    model: CURRENT_AFFAIRS_GROUNDED_MODEL,
    contents: prompt,
    config: { ...NOTES_GEN_CONFIG, tools: [{ googleSearch: {} }] },
  });

  const obj = parseOutlineJsonObject(response.text || '');
  if (!obj || !Array.isArray(obj.topics)) return [];
  return obj.topics
    .map((t: any) => ({ headline: String(t?.headline || '').trim(), claim: String(t?.claim || '').trim() }))
    .filter((t: CATopic) => t.headline);
};

/** One half of the dual-grounding discovery — searches ONE source group only. */
const discoverFromSourceGroup = async (
  dateLabel: string,
  language: string,
  sourceGroup: string,
): Promise<CATopic[]> => {
  const ai = createAIClient();

  const prompt = `
    Role: UPSC current-affairs editor with live web access.
    Task: Using Google Search, find the most exam-relevant news items for ${dateLabel} (India-focused, plus world affairs relevant to India). Search ONLY within this source group: ${sourceGroup}.

    Language for headline: ${language}

    List up to 6 distinct items covering: government schemes/policies, appointments, reports/indices/rankings, international relations/summits, science & tech, economy/budget, environment/ecology, defence/security, important days/persons, court judgments. Fewer, genuinely-found items are better than padding to a count.

    For each item give:
    - "headline": a short specific headline for it
    - "claim": the key fact(s) found via search (1-2 sentences, with real names/numbers/dates).

    Output STRICT JSON ONLY (no markdown/code fences):
    { "topics": [ { "headline": "...", "claim": "..." } ] }
  `;

  const response = await ai.models.generateContent({
    model: CURRENT_AFFAIRS_GROUNDED_MODEL,
    contents: prompt,
    config: { ...NOTES_GEN_CONFIG, tools: [{ googleSearch: {} }] },
  });

  const obj = parseOutlineJsonObject(response.text || '');
  if (!obj || !Array.isArray(obj.topics)) return [];
  return obj.topics
    .map((t: any) => ({ headline: String(t?.headline || '').trim(), claim: String(t?.claim || '').trim() }))
    .filter((t: CATopic) => t.headline);
};

// Two headlines are treated as the same story if their normalised text
// overlaps heavily — cheap enough to avoid a third AI call just to dedupe
// two short lists, and good enough since both calls are searching the same
// day's news.
const normalizeHeadline = (h: string) => h.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
const headlinesOverlap = (a: string, b: string): boolean => {
  const wa = new Set(normalizeHeadline(a).split(/\s+/).filter((w) => w.length > 3));
  const wb = new Set(normalizeHeadline(b).split(/\s+/).filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return false;
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.min(wa.size, wb.size) >= 0.6;
};

/**
 * "Scan" and "Agentic" mode's discovery step for the "general" (no video, no
 * typed topics) source — TWO grounded calls run in PARALLEL, each searching
 * a different, non-overlapping source group (PIB alone vs. every other
 * trusted CA portal), so the discovered list isn't shaped by a single
 * source's editorial choices. Results are merged and near-duplicate
 * headlines (the same story surfacing in both groups) are collapsed into one.
 */
const discoverCurrentAffairsTopicsDualSource = async (
  dateLabel: string,
  language: string,
): Promise<CATopic[]> => {
  const [fromPib, fromOthers] = await Promise.all([
    discoverFromSourceGroup(dateLabel, language, PIB_SOURCE_GROUP),
    discoverFromSourceGroup(dateLabel, language, OTHER_SOURCE_GROUP),
  ]);

  const merged: CATopic[] = [...fromPib];
  for (const topic of fromOthers) {
    if (!merged.some((existing) => headlinesOverlap(existing.headline, topic.headline))) {
      merged.push(topic);
    }
  }
  return merged;
};

/**
 * Deep mode, step 2 — ONE grounded call: for every topic, use live Google
 * Search (PIB + trusted sources first) to verify/date/expand it, then write
 * the final notes. Perplexity-style: search first, synthesize after, with a
 * short source/verification line per item.
 */
const writeGroundedCurrentAffairsNotes = async (
  topics: CATopic[],
  dateLabel: string,
  language: string,
  fromVideo: boolean,
): Promise<string> => {
  const ai = createAIClient();

  const list = topics
    .map((t, i) => fromVideo
      ? `${i + 1}. ${t.headline} — as stated in the video: ${t.claim}`
      : `${i + 1}. ${t.headline}${t.claim ? ` — ${t.claim}` : ''}`)
    .join('\n');

  const prompt = `
    Role: Current-affairs researcher with live web access (Perplexity-style deep research).
    Task: Below is a list of news items relevant to ${dateLabel}${fromVideo ? ` covered in ${sourceLabel(dateLabel)}` : ''}. For EACH item, use Google Search to find the real, current, correctly-dated facts — prioritize these trusted sources: ${TRUSTED_SOURCES}. ${fromVideo ? 'Verify what the video claimed, fill in exact figures/names/dates it may have skipped' : 'Confirm and expand each with exact figures/names/dates'}, and note the current status if the item has since moved forward (e.g. a bill passed, a scheme launched, a result declared).

    Language: ${language}
    Items:
    ${list}

    **STRUCTURE of your output:**
    - Start with a single <h1> title: "Daily Current Affairs — ${dateLabel} (Deep Research)".
    - One <h2> per item, short specific headline.
    - Under each <h2>: a tight bullet list (<ul><li>) of the verified facts (<strong> the names/numbers/dates), written from what search actually confirms${fromVideo ? ' — not just repeating the video' : ''}.
    - End each item with one line: <p class="ca-verified">🌐 Verified via live search — [1-sentence note on what was confirmed/updated/current status, naming PIB or the source where it applies].</p>
    - If search finds nothing to add or the claim already checks out as-is, keep the verified line short ("figures confirmed current as of today").
    - Every fact must be real and search-backed — never invented or approximated.

    **Output:** Return ONLY raw HTML. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: CURRENT_AFFAIRS_GROUNDED_MODEL,
    contents: prompt,
    config: { ...DETAILED_NOTES_CONFIG, tools: [{ googleSearch: {} }] },
  });

  return cleanHtmlOutput(response.text || '');
};

/**
 * Deep mode entry point — runs both steps for whichever source kind is
 * given. Falls back to quick mode's single-call path if step 1 finds no
 * topics (e.g. a very short clip, or nothing typed and search turns up
 * nothing usable).
 */
export const generateCurrentAffairsDeep = async (
  source: CASource,
  dateLabel: string,
  language: string,
): Promise<string> => {
  let topics: CATopic[];
  if (source.kind === 'video') {
    topics = await extractCurrentAffairsTopics(source.transcriptText, language);
  } else if (source.kind === 'topics') {
    topics = source.topics.map((headline) => ({ headline, claim: '' }));
  } else {
    topics = await discoverCurrentAffairsTopics(dateLabel, language);
  }

  if (!topics.length) return generateCurrentAffairsQuick(source, dateLabel, language);
  return writeGroundedCurrentAffairsNotes(topics, dateLabel, language, source.kind === 'video');
};

// ---------------------------------------------------------------------------
// "Scan" and "Agentic" styles — share the same topic-acquisition step: for
// "video"/"topics" the source is already known (no search needed, same as
// deep mode), but for "general" it's the dual-grounding discovery above
// instead of deep mode's single-source discovery.
// ---------------------------------------------------------------------------
const getTopicsForScanOrAgentic = async (
  source: CASource,
  dateLabel: string,
  language: string,
): Promise<CATopic[]> => {
  if (source.kind === 'video') return extractCurrentAffairsTopics(source.transcriptText, language);
  if (source.kind === 'topics') return source.topics.map((headline) => ({ headline, claim: '' }));
  return discoverCurrentAffairsTopicsDualSource(dateLabel, language);
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * "Scan" mode — headlines only, no writing call at all. The dual-grounding
 * discovery step already found real, dated headlines with a one-line claim
 * each; this just formats that list directly into notes HTML, so the whole
 * style costs exactly the two parallel discovery calls (or zero extra calls
 * for "video"/"topics", where the topics were already known).
 */
const renderHeadlineScanHtml = (topics: CATopic[], dateLabel: string): string => {
  const items = topics
    .map((t) => `<li><strong>${escapeHtml(t.headline)}</strong>${t.claim ? ` — ${escapeHtml(t.claim)}` : ''}</li>`)
    .join('\n');
  return `<h1>Daily Current Affairs — ${escapeHtml(dateLabel)} (Headline Scan)</h1>\n<ul>\n${items}\n</ul>`;
};

/**
 * "Agentic" mode's writing step — one grounded call, same verification
 * approach as deep mode's writeGroundedCurrentAffairsNotes, but each item
 * gets a fuller paragraph (not just a bullet list) plus one extra
 * <div class="note-box"> of STATIC background the item builds on (a
 * constitutional article, an institution's basic mandate, a definition) —
 * the kind of standing fact a student should already know alongside today's
 * news, not the news itself.
 */
const writeAgenticDetailedNotes = async (
  topics: CATopic[],
  dateLabel: string,
  language: string,
  fromVideo: boolean,
): Promise<string> => {
  const ai = createAIClient();

  const list = topics
    .map((t, i) => fromVideo
      ? `${i + 1}. ${t.headline} — as stated in the video: ${t.claim}`
      : `${i + 1}. ${t.headline}${t.claim ? ` — ${t.claim}` : ''}`)
    .join('\n');

  const prompt = `
    Role: Current-affairs researcher with live web access, writing fuller exam notes (not a quick bullet scan).
    Task: Below is a list of news items relevant to ${dateLabel}${fromVideo ? ` covered in ${sourceLabel(dateLabel)}` : ''}. For EACH item, use Google Search to find the real, current, correctly-dated facts — prioritize these trusted sources: ${TRUSTED_SOURCES}. ${fromVideo ? 'Verify what the video claimed, fill in exact figures/names/dates it may have skipped' : 'Confirm and expand each with exact figures/names/dates'}, and note the current status if the item has since moved forward.

    Language: ${language}
    Items:
    ${list}

    **STRUCTURE of your output, for EACH item:**
    - <h2> with a short specific headline.
    - A short paragraph (<p>, 2-4 sentences) explaining what happened and why it matters for the exam — not just a bare bullet list, but not padded either. Use <strong> for names/numbers/dates.
    - Then a tight bullet list (<ul><li>) of the key facts likely to be asked directly (names, figures, dates, scheme/institution names).
    - Then ONE <div class="note-box">, containing 2-3 lines of relevant STATIC background the news item builds on — e.g. the constitutional article involved, the basic mandate of the institution named, a definition of a term used. This must be a standing fact independent of today's news, not a repeat of it. Label it clearly, e.g. "Static fact: ...".
    - End with one line: <p class="ca-verified">🌐 Verified via live search — [1-sentence note on what was confirmed/updated/current status, naming PIB or the source where it applies].</p>

    Start with a single <h1> title: "Daily Current Affairs — ${dateLabel} (Agentic Research)".
    Every fact must be real and search-backed — never invented or approximated.

    **Output:** Return ONLY raw HTML. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: CURRENT_AFFAIRS_GROUNDED_MODEL,
    contents: prompt,
    config: { ...DETAILED_NOTES_CONFIG, tools: [{ googleSearch: {} }] },
  });

  return cleanHtmlOutput(response.text || '');
};

/**
 * Scan mode entry point — dual-grounding discovery, then format directly
 * (no writing call). Falls back to quick mode if discovery finds nothing.
 */
export const generateCurrentAffairsScan = async (
  source: CASource,
  dateLabel: string,
  language: string,
): Promise<string> => {
  const topics = await getTopicsForScanOrAgentic(source, dateLabel, language);
  if (!topics.length) return generateCurrentAffairsQuick(source, dateLabel, language);
  return renderHeadlineScanHtml(topics, dateLabel);
};

/**
 * Agentic mode entry point — dual-grounding discovery, then one grounded
 * writing call producing fuller per-item notes with a static-fact box each.
 * Falls back to quick mode if discovery finds nothing.
 */
export const generateCurrentAffairsAgentic = async (
  source: CASource,
  dateLabel: string,
  language: string,
): Promise<string> => {
  const topics = await getTopicsForScanOrAgentic(source, dateLabel, language);
  if (!topics.length) return generateCurrentAffairsQuick(source, dateLabel, language);
  return writeAgenticDetailedNotes(topics, dateLabel, language, source.kind === 'video');
};
