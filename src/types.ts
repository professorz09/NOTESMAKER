export interface BookMetadata {
  title: string;
  author?: string;
  chapters: ChapterOutline[];
}

export interface ChapterOutline {
  id: string;
  title: string;
  description: string;
}

export interface ChapterContent {
  id: string; // Matches ChapterOutline.id
  htmlContent: string;
  isGenerated: boolean;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_OUTLINE = 'GENERATING_OUTLINE',
  GENERATING_CHAPTER = 'GENERATING_CHAPTER',
  GENERATING_TABLE = 'GENERATING_TABLE',
  ERROR = 'ERROR',
}