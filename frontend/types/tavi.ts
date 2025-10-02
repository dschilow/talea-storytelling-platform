// Temporary types for Tavi service until client is regenerated

export interface TaviChatRequest {
  message: string;
}

export interface TaviChatResponse {
  response: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface TaviService {
  taviChat(request: TaviChatRequest): Promise<TaviChatResponse>;
}