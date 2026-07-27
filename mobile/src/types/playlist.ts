/** Ported from frontend/types/playlist.ts. */

export type PlaylistItemType = 'audio-doku' | 'doku' | 'story-chapter';
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
  /** Playable URI once conversion completes (file:// for cached, https:// for library audio) */
  audioUrl?: string;
  /** Raw text for TTS conversion (story chapters) */
  sourceText?: string;
  conversionStatus: ConversionStatus;
  /** Parent story grouping */
  parentStoryId?: string;
  parentStoryTitle?: string;
  chapterOrder?: number;
  chapterTitle?: string;
  /** Parent doku grouping */
  parentDokuId?: string;
  parentDokuTitle?: string;
  dokuChunkOrder?: number;
  dokuTotalChunks?: number;
}

export const MAX_PLAYLIST_ITEMS = 200;
