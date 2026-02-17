export type StudioSeriesStatus = "draft" | "active" | "archived";
export type StudioEpisodeStatus =
  | "draft"
  | "text_ready"
  | "text_approved"
  | "scenes_ready"
  | "images_ready"
  | "composed"
  | "published";
export type StudioSceneStatus = "pending" | "ready";

export interface StudioSeries {
  id: string;
  userId: string;
  title: string;
  logline?: string;
  description?: string;
  canonicalPrompt?: string;
  status: StudioSeriesStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudioCharacter {
  id: string;
  seriesId: string;
  userId: string;
  name: string;
  role?: string;
  description?: string;
  generationPrompt: string;
  imagePrompt: string;
  visualProfile?: Record<string, any>;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudioEpisode {
  id: string;
  seriesId: string;
  userId: string;
  episodeNumber: number;
  title: string;
  summary?: string;
  storyText?: string;
  approvedStoryText?: string;
  selectedCharacterIds: string[];
  status: StudioEpisodeStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioEpisodeScene {
  id: string;
  episodeId: string;
  seriesId: string;
  sceneOrder: number;
  title: string;
  sceneText: string;
  participantCharacterIds: string[];
  imagePrompt?: string;
  imageUrl?: string;
  status: StudioSceneStatus;
  createdAt: string;
  updatedAt: string;
}
