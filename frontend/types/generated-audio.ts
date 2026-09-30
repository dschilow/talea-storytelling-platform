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
  /**
   * Only set on entries read back from the offline cache: the signature-free
   * key of the saved audio file, stable across app restarts (unlike the blob
   * URL in `audioUrl`).
   */
  offlineAudioKey?: string;
  coverImageUrl?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

