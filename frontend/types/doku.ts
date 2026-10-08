export interface DokuKeyFact {
  title: string;
  fact: string;
  comparison?: string;
  whyItMatters?: string;
}

export interface DokuQuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  skillType?: "REMEMBER" | "UNDERSTAND" | "COMPARE" | "TRANSFER" | "EXPLAIN";
  difficulty?: number;
}

export interface DokuActivityItem {
  title: string;
  description: string;
  materials?: string[];
  steps?: string[];
  observe?: string;
  safetyNote?: string;
  durationMinutes?: number;
}

export interface DokuInteractive {
  quiz?: {
    enabled: boolean;
    questions: DokuQuizQuestion[];
  };
  activities?: {
    enabled: boolean;
    items: DokuActivityItem[];
  };
}

export interface DokuExpert {
  role: string;
  name?: string;
}

export interface DokuSection {
  title: string;
  content: string;
  keyFacts: DokuKeyFact[];
  kind?: "station" | "wissen";
  place?: string;
  expert?: DokuExpert;
  miniQuestion?: string;
  imageIdea?: string;
  sectionImagePrompt?: string;
  imageUrl?: string;
  interactive?: DokuInteractive;
}

export interface DokuGuess {
  question: string;
  options: string[];
  answerIndex: number;
  reveal?: string;
}

/** Stored doku content. Older dokus only have sections plus hook/mainQuestion/finale/wowFacts. */
export interface DokuContent {
  sections: DokuSection[];
  hook?: string;
  mainQuestion?: string;
  guess?: DokuGuess;
  recap?: string[];
  closingLine?: string;
  finale?: string;
  wowFacts?: string[];
}

export interface DokuConfig {
  topic: string;
  depth: "basic" | "standard" | "deep";
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";
  domainId?: string;
  perspective?: "science" | "history" | "technology" | "nature" | "culture";
  includeInteractive?: boolean;
  quizQuestions?: number;
  handsOnActivities?: number;
  tone?: "fun" | "neutral" | "curious";
  length?: "short" | "medium" | "long";
}

export interface Doku {
  id: string;
  userId: string;
  title: string;
  topic: string;
  summary: string;
  content?: DokuContent;
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
    factCheck?: {
      model: string;
      issues: number;
      applied: number;
    };
    processingTime?: number;
    imagesGenerated?: number;
    configSnapshot?: {
      topic?: string;
      domainId?: string | null;
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
