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
// Two generation styles, both on the fast Flash model (speed matters for a
// daily habit — this isn't a once-a-week deep topic):
//   - "quick"  → ONE call. For "video" it just reads the transcript and
//                extracts what's exam-relevant — no search. For "topics"/
//                "general" there's no transcript to extract from, so this
//                one call carries live Google Search grounding instead —
//                still a single call, just grounded rather than transcript-
//                read.
//   - "deep"   → Perplexity/deep-research style, always grounded. Call 1
//                gets the candidate topic list — extracted from the
//                transcript for "video" (no search), taken directly from
//                what the user typed for "topics" (no search), or DISCOVERED
//                via a live grounded search of PIB and other trusted
//                exam-oriented current-affairs sources for "general". Call 2
//                is a SINGLE grounded call: for every topic it searches PIB
//                (pib.gov.in) and other trusted UPSC sources to verify/date/
//                expand it, then writes the final notes with a short
//                "verified" source line per topic.
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
