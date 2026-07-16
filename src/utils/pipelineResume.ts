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
// if a snapshot is found, the user is offered a "Resume" action that picks up
// generation from exactly the sections that were never finished — already
// completed sections are kept as-is, nothing is re-generated needlessly.
//
// Snapshots are only taken AFTER approval (outline already built + reviewed)
// since that phase is cheap to redo from scratch if interrupted; it's the
// expensive per-section expansion that's worth preserving.
// ---------------------------------------------------------------------------

export interface TopicResumeSnapshot {
  kind: 'topic';
  level: 'medium' | 'detailed' | 'deep';
  topic: string;
  language: string;
  aiModel: string;
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
  savedAt: number;
}

export interface ChunkResumeSnapshot {
  kind: 'chunk';
  chunkSourceKind: 'transcript' | 'text';
  level: 'medium' | 'detailed' | 'deep';
  sourceText: string;
  language: string;
  aiModel: string;
  title: string;
  subtitle: string;
  chunkSections: { heading: string; subheadings: string[] }[][];
  nodes: MindmapNode[];
  parts: string[];
  partIndexByGroupId: Record<string, number>;
  stoppedEarly: boolean;
  savedAt: number;
}

export type PipelineResumeSnapshot = TopicResumeSnapshot | ChunkResumeSnapshot;

const RESUME_KEY = 'nm_pipeline_resume_v1';
// A pending snapshot older than this is more likely to be confusing than
// useful (the user has probably moved on) — treat it as stale and ignore it.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveResumeSnapshot(snapshot: PipelineResumeSnapshot): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage full/unavailable — resume just won't be offered; the
    // in-progress generation itself is unaffected.
  }
}

export function loadResumeSnapshot(): PipelineResumeSnapshot | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || typeof snap !== 'object') return null;
    if (Date.now() - (snap.savedAt || 0) > MAX_AGE_MS) return null;
    if (snap.kind !== 'topic' && snap.kind !== 'chunk') return null;
    return snap as PipelineResumeSnapshot;
  } catch {
    return null;
  }
}

export function clearResumeSnapshot(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // ignore
  }
}
