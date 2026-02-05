// Temporary types for Tavi service until client is regenerated

export interface TaviChatRequest {
  message: string;
  context?: {
    language?: string;
    intentHint?: 'story' | 'doku';
    pendingRequest?: string;
  };
}

export interface TaviChatAction {
  type: 'story' | 'doku';
  id: string;
  title: string;
  route: string;
}

export interface TaviChatResponse {
  response: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  action?: TaviChatAction;
  intentHint?: 'story' | 'doku';
  awaitingConfirmation?: boolean;
}

export interface TaviService {
  taviChat(request: TaviChatRequest): Promise<TaviChatResponse>;
}
