export type TaviActionType =
  | "story"
  | "doku"
  | "avatar"
  | "wizard_prefill"
  | "image"
  | "list"
  | "navigate";

export interface TaviListItem {
  id: string;
  name: string;
  route: string;
  imageUrl?: string;
  type?: string;
  description?: string;
}

export interface TaviChatAction {
  type: TaviActionType;
  id?: string;
  title?: string;
  route?: string;
  // wizard_prefill
  wizardType?: "story" | "avatar" | "doku";
  wizardData?: Record<string, any>;
  // image
  imageUrl?: string;
  imagePrompt?: string;
  // list
  items?: TaviListItem[];
}

export interface TaviHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TaviChatRequest {
  message: string;
  history?: TaviHistoryMessage[];
  context?: {
    language?: string;
    profileId?: string;
  };
}

export interface TaviChatResponse {
  response: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  actions?: TaviChatAction[];
}
