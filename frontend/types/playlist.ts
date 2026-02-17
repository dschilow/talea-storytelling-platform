export type PlaylistItemType = 'audio-doku' | 'story-chapter';
export type ConversionStatus = 'pending' | 'converting' | 'ready' | 'error';

export interface PlaylistItem {
  /** Unique ID within the playlist */
  id: string;
  /** Group ID — story ID or doku ID */
  trackId: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  type: PlaylistItemType;
  /** Set when audio is ready to play */
  audioUrl?: string;
  /** Raw text for TTS conversion (story chapters) */
  sourceText?: string;
  conversionStatus: ConversionStatus;
  /** Parent story grouping */
  parentStoryId?: string;
  parentStoryTitle?: string;
  chapterOrder?: number;
  chapterTitle?: string;
}

export const MAX_PLAYLIST_ITEMS = 200;
