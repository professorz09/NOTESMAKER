import { createAIClient, cleanHtmlOutput, NOTES_GEN_CONFIG, DETAILED_NOTES_CONFIG } from './client';
import { parseOutlineJsonObject } from './outlineParsing';

// ---------------------------------------------------------------------------
// Daily Current Affairs pipeline — paste one or more daily-CA video links,
// get exam-focused notes back, tagged so they show up as a filterable
// "Current Affairs" stream in history (see useProjects/ProjectsPanel).
//
// Two generation styles, both on the fast Flash model (speed matters for a
// daily habit — this isn't a once-a-week deep topic):
//   - "quick"  → ONE call. Reads the transcript, extracts only what's
//                exam-relevant, writes it straight up. No search.
//   - "deep"   → Perplexity/deep-research style. Call 1 pulls out the
//                candidate topics/claims from the transcript (cheap, no
//                search). Call 2 is a SINGLE grounded call: for every topic
//                it runs live Google Search to verify/date/expand it against
//                the real current web, then writes the final notes with a
//                short "verified" source line per topic — so the notes
//                aren't just "what the video said" but cross-checked against
//                what's actually current today.
// ---------------------------------------------------------------------------

export const CURRENT_AFFAIRS_FLASH_MODEL = 'gemini-3.1-flash-lite';

const sourceLabel = (dateLabel: string) => `daily current affairs video(s) dated ${dateLabel}`;

/**
 * Quick mode — one call, no search. Straight extraction of exam-relevant
 * points from the transcript(s).
 */
export const generateCurrentAffairsQuick = async (
  transcriptText: string,
  dateLabel: string,
  language: string,
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: UPSC current-affairs editor.
    Task: Below is the transcript of ${sourceLabel(dateLabel)}. Extract ONLY the exam-relevant material and turn it into clean, structured current-affairs notes. Skip channel intros, sponsor reads, "like and subscribe", banter and anything with no factual/exam content.

    Language: ${language}
    Transcript:
    """${transcriptText}"""

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
};

interface CATopic {
  headline: string;
  claim: string;
}

/** Deep mode, step 1 — cheap, no search: pull out the candidate topics. */
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
 * Deep mode, step 2 — ONE grounded call: for every extracted topic, use live
 * Google Search to verify/date/expand it against the real current web, then
 * write the final notes. Perplexity-style: search first, synthesize after,
 * with a short source/verification line per item.
 */
const writeGroundedCurrentAffairsNotes = async (
  topics: CATopic[],
  dateLabel: string,
  language: string,
): Promise<string> => {
  const ai = createAIClient();

  const list = topics
    .map((t, i) => `${i + 1}. ${t.headline} — as stated in the video: ${t.claim}`)
    .join('\n');

  const prompt = `
    Role: Current-affairs researcher with live web access (Perplexity-style deep research).
    Task: Below is the list of news items covered in ${sourceLabel(dateLabel)}. For EACH item, use Google Search to find the real, current, correctly-dated facts — verify what the video claimed, fill in exact figures/names/dates it may have skipped, and note the current status if the item has since moved forward (e.g. a bill passed, a scheme launched, a result declared).

    Language: ${language}
    Items:
    ${list}

    **STRUCTURE of your output:**
    - Start with a single <h1> title: "Daily Current Affairs — ${dateLabel} (Deep Research)".
    - One <h2> per item, short specific headline.
    - Under each <h2>: a tight bullet list (<ul><li>) of the verified facts (<strong> the names/numbers/dates), written from what search actually confirms — not just repeating the video.
    - End each item with one line: <p class="ca-verified">🌐 Verified via live search — [1-sentence note on what was confirmed/updated/current status].</p>
    - If search finds nothing to add or the claim already checks out as-is, keep the verified line short ("figures confirmed current as of today").
    - Every fact must be real and search-backed — never invented or approximated.

    **Output:** Return ONLY raw HTML. No markdown, no code fences.
  `;

  const response = await ai.models.generateContent({
    model: CURRENT_AFFAIRS_FLASH_MODEL,
    contents: prompt,
    config: { ...DETAILED_NOTES_CONFIG, tools: [{ googleSearch: {} }] },
  });

  return cleanHtmlOutput(response.text || '');
};

/**
 * Deep mode entry point — runs both steps. Falls back to quick mode's
 * single-call extraction if step 1 finds no topics (e.g. a very short clip).
 */
export const generateCurrentAffairsDeep = async (
  transcriptText: string,
  dateLabel: string,
  language: string,
): Promise<string> => {
  const topics = await extractCurrentAffairsTopics(transcriptText, language);
  if (!topics.length) return generateCurrentAffairsQuick(transcriptText, dateLabel, language);
  return writeGroundedCurrentAffairsNotes(topics, dateLabel, language);
};
