export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_CHAPTER = 'GENERATING_CHAPTER',
  GENERATING_TABLE = 'GENERATING_TABLE',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
}

export type ImageStyle = 'diagram' | 'handwritten' | 'mindmap' | 'flowchart';
export type ImageAspectRatio = '1:1' | '4:3' | '16:9' | '9:16';
export type ImageModelId =
  | 'imagen-4.0-fast-generate-001'
  | 'imagen-4.0-generate-001'
  | 'imagen-4.0-ultra-generate-001';
