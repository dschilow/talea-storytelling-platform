export interface DokuInteractive {
  quiz?: {
    enabled: boolean;
    questions: {
      question: string;
      options: string[];
      answerIndex: number;
      explanation?: string;
    }[];
  };
  activities?: {
    enabled: boolean;
    items: {
      title: string;
      description: string;
      materials?: string[];
      durationMinutes?: number;
    }[];
  };
}

export interface DokuSection {
  title: string;
  content: string; // markdown/text
  keyFacts: string[];
  imageIdea?: string; // textual idea for possible image
  sectionImagePrompt?: string; // English Runware-optimized prompt (AI-generated)
  imageUrl?: string; // generated section image URL
  interactive?: DokuInteractive;
}

export interface DokuConfig {
  topic: string;
  depth: "basic" | "standard" | "deep";
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";
  perspective?: "science" | "history" | "technology" | "nature" | "culture";
  includeInteractive?: boolean;
  quizQuestions?: number; // 0..10
  handsOnActivities?: number; // 0..5
  tone?: "fun" | "neutral" | "curious";
  length?: "short" | "medium" | "long";
}

export interface Doku {
  id: string;
  userId: string;
  title: string;
  topic: string;
  summary: string;
  content?: {
    sections: DokuSection[];
  };
  coverImageUrl?: string;
  isPublic: boolean;
  status: 'generating' | 'complete' | 'error';
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    configSnapshot?: {
      topic?: string;
      ageGroup?: "3-5" | "6-8" | "9-12" | "13+";
      depth?: "basic" | "standard" | "deep";
      perspective?: "science" | "history" | "technology" | "nature" | "culture";
      tone?: "fun" | "neutral" | "curious";
      length?: "short" | "medium" | "long";
      includeInteractive?: boolean;
      quizQuestions?: number;
      handsOnActivities?: number;
      language?: string;
    };
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}
