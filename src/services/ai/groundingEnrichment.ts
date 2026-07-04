import { createAIClient, DETAILED_NOTES_CONFIG } from './client';
import { parseOutlineJsonObject } from './outlineParsing';

// ---------------------------------------------------------------------------
// Optional final pipeline step: "Grounding" (live Google Search enrichment).
//
// Runs ONCE after every section of a leveled pipeline has already been
// generated. It scans every section's heading (+ sub-points) and decides,
// section by section, whether that specific topic is time-sensitive enough
// that CURRENT real-world information — recent data, an ongoing scheme, a
// recent judgment, current statistics — would genuinely add value beyond
// standard textbook knowledge. Most conceptual/historical/definitional
// sections are skipped outright; only flagged ones get a compact,
// search-grounded addition appended to their existing content.
//
// One combined call (not one per section) keeps this fast and cheap even for
// a 15+ section Deep-level document — the model reasons over the whole list
// at once and only "spends" a real search+write on the sections worth it.
// ---------------------------------------------------------------------------

export interface GroundingSectionMeta {
  heading: string;
  subheadings: string[];
}

export interface GroundingAddition {
  sectionIndex: number;
  additionHtml: string;
}

export const scanSectionsForGroundingAdditions = async (
  contextTitle: string,
  sections: GroundingSectionMeta[],
  language: string,
  modelName: string,
): Promise<GroundingAddition[]> => {
  if (!sections.length) return [];
  const ai = createAIClient();

  const list = sections
    .map((s, i) => `${i}. ${s.heading}${s.subheadings.length ? ' — ' + s.subheadings.slice(0, 8).join('; ') : ''}`)
    .join('\n');

  const prompt = `
    Role: Current-affairs fact-checker with live web access.
    Task: Below is the list of sections in a set of study notes on "${contextTitle}". For EACH section, decide: is this specifically a topic where CURRENT / latest real-world information (recent data, an ongoing scheme or policy, a recent event or judgment, current statistics, a recent technological development) would genuinely add value beyond standard textbook knowledge?

    Be SELECTIVE — most conceptual, definitional, historical, or purely theoretical sections do NOT need this and should be left alone entirely. Only flag a section if it is inherently time-sensitive: e.g. a government scheme's current status, a recent statistic/ranking, an ongoing event, a recent court judgment, the latest state of a technology, a current economic/social indicator, or similar. When in doubt, do NOT flag it — a wrong or forced addition is worse than no addition.

    Sections:
    ${list}

    For each section you DO flag, use Google Search to find real, current, correctly-dated information and write ONE short addition (2-4 sentences, in ${language}) to append to that section, wrapped exactly as:
    <div class="note-box">🌐 <strong>[a short "current update" label translated into ${language}]:</strong> the current information, with real dates/figures/names</div>
    Every fact in the addition must be real and verified via search — never invented, approximated, or generic ("continues to evolve" etc. is not acceptable — give an actual current fact).

    Output STRICT JSON ONLY (no markdown, no code fences, no commentary):
    { "additions": [ { "sectionIndex": <0-based index from the list above>, "additionHtml": "<div class=\\"note-box\\">...</div>" } ] }

    Only include entries for sections you actually flagged — most of the list should NOT appear in the output at all. If genuinely nothing in this list needs a current-affairs addition, output { "additions": [] }.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { ...DETAILED_NOTES_CONFIG, tools: [{ googleSearch: {} }] },
  });

  const obj = parseOutlineJsonObject(response.text || '');
  if (!obj || !Array.isArray(obj.additions)) return [];
  return obj.additions
    .map((a: any) => ({
      sectionIndex: Number(a?.sectionIndex),
      additionHtml: String(a?.additionHtml || '').trim(),
    }))
    .filter((a: GroundingAddition) => Number.isInteger(a.sectionIndex) && a.sectionIndex >= 0 && !!a.additionHtml);
};
