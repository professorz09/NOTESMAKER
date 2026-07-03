export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_CHAPTER = 'GENERATING_CHAPTER',
  GENERATING_TABLE = 'GENERATING_TABLE',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
}

// Live "mind map" shown while a multi-step notes pipeline runs. Each section
// of the planned outline is a node whose status animates as it is generated;
// a failed node exposes Retry / Skip.
export type MindmapNodeStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

export interface MindmapLeaf {
  id: string;
  label: string;
}

export interface MindmapNode {
  id: string;
  label: string;
  status: MindmapNodeStatus;
  children: MindmapLeaf[];
}

export interface MindmapState {
  title: string;
  subtitle: string;
  nodes: MindmapNode[];
  // When set, the pipeline is paused on this node waiting for Retry/Skip.
  errorNodeId: string | null;
}
