export interface StoryConfig {
  genre: string;
  style: string;
  ageGroup: string;
  moral?: string;
  avatars?: Avatar[];
  characters?: Character[];
}

export interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Character {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  order: number;
}

export interface Story {
  id: string;
  userId: string;
  title: string;
  summary: string;
  description?: string;
  config: StoryConfig;
  chapters?: Chapter[];
  pages?: Chapter[];
  coverImageUrl?: string;
  estimatedReadingTime?: number;
  status: 'generating' | 'complete' | 'error';
  isPublic: boolean;
  avatarDevelopments?: any[];
  avatarParticipants?: Avatar[];
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}
