import type { MindmapNode } from '../types';

// ---------------------------------------------------------------------------
// Resume-on-interrupt for the leveled (Medium/Detailed/Deep) notes pipelines.
//
// A leveled pipeline can run dozens of AI calls over several minutes. Losing
// all of that to a dropped network connection, an accidental page refresh, or
// the mobile browser/app being backgrounded and reclaimed used to mean
// starting completely over. To fix that, once the user has approved the plan
// (the point after which real, costly generation work happens) the pipeline
// periodically snapshots its progress to localStorage. On the next app load,
// every snapshot found is offered as a "Resume" action that picks up
// generation from exactly the sections that were never finished — already
// completed sections are kept as-is, nothing is re-generated needlessly.
//
// Snapshots are only taken AFTER approval (outline already built + reviewed)
// since that phase is cheap to redo from scratch if interrupted; it's the
// expensive per-section expansion that's worth preserving.
//
// Multiple pipelines can be pending at once — starting a fresh generation
// does NOT discard an earlier interrupted one; each snapshot is its own
// entry (keyed by `id`), so the user can leave several unfinished notes
// sitting around and come back to resume any of them individually.
// ---------------------------------------------------------------------------

interface ResumeSnapshotBase {
  id: string;
  savedAt: number;
}

export interface TopicResumeSnapshot extends ResumeSnapshotBase {
  kind: 'topic';
  level: 'medium' | 'detailed' | 'deep';
  topic: string;
  language: string;
  aiModel: string;
  // Google Grounding as it was set for THIS run — a resume must keep using
  // it (or not), never whatever the sidebar toggle happens to be at resume
  // time, or sections would mix grounded/ungrounded facts in one document.
  groundingEnabled: boolean;
  title: string;
  subtitle: string;
  sections: { heading: string; subheadings: string[] }[];
  focusAreas: string[];
  nodes: MindmapNode[];
  parts: string[];
  // Maps a node's groupId (e.g. "s3", "extra", or an "add a point" node id)
  // to its slot inside `parts` — mirrors what the live controller tracks in
  // memory, so a resumed run's click-to-regenerate lands in the same slot.
  partIndexByGroupId: Record<string, number>;
  stoppedEarly: boolean;
}

export interface ChunkResumeSnapshot extends ResumeSnapshotBase {
  kind: 'chunk';
  chunkSourceKind: 'transcript' | 'text';
  level: 'medium' | 'detailed' | 'deep';
  sourceText: string;
  language: string;
  aiModel: string;
  groundingEnabled: boolean;
  title: string;
  subtitle: string;
  chunkSections: { heading: string; subheadings: string[] }[][];
  nodes: MindmapNode[];
  parts: string[];
  partIndexByGroupId: Record<string, number>;
  stoppedEarly: boolean;
}

export type PipelineResumeSnapshot = TopicResumeSnapshot | ChunkResumeSnapshot;

const RESUME_KEY = 'nm_pipeline_resume_v2';
// A pending snapshot older than this is more likely to be confusing than
// useful (the user has probably moved on) — treat it as stale and ignore it.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Cap how many interrupted pipelines can sit pending at once — protects
// localStorage from unbounded growth if the user repeatedly starts and
// abandons generations without ever resuming or discarding them.
const MAX_PENDING = 8;

function readAll(): PipelineResumeSnapshot[] {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const now = Date.now();
    return list.filter((snap): snap is PipelineResumeSnapshot =>
      snap && typeof snap === 'object' &&
      typeof snap.id === 'string' &&
      (snap.kind === 'topic' || snap.kind === 'chunk') &&
      now - (snap.savedAt || 0) <= MAX_AGE_MS);
  } catch {
    return [];
  }
}

function writeAll(list: PipelineResumeSnapshot[]): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(list));
  } catch {
    // localStorage full/unavailable — resume just won't be offered; the
    // in-progress generation itself is unaffected.
  }
}

// Upserts by id — a pipeline calls this repeatedly as it progresses, each
// time overwriting its own entry in place rather than creating duplicates.
export function saveResumeSnapshot(snapshot: PipelineResumeSnapshot): void {
  const list = readAll().filter(s => s.id !== snapshot.id);
  list.push(snapshot);
  // Oldest-first, so trimming to the cap drops the longest-abandoned ones.
  list.sort((a, b) => a.savedAt - b.savedAt);
  while (list.length > MAX_PENDING) list.shift();
  writeAll(list);
}

export function loadResumeSnapshots(): PipelineResumeSnapshot[] {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function clearResumeSnapshot(id: string): void {
  const list = readAll().filter(s => s.id !== id);
  writeAll(list);
}
