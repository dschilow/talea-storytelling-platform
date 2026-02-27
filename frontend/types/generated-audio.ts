export type GeneratedAudioSourceType = 'story' | 'doku';

export interface GeneratedAudioLibraryEntry {
  id: string;
  sourceType: GeneratedAudioSourceType;
  sourceId: string;
  sourceTitle: string;
  itemId: string;
  itemTitle: string;
  itemSubtitle?: string;
  itemOrder?: number;
  cacheKey: string;
  audioUrl: string;
  mimeType: string;
  coverImageUrl?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

