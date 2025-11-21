/**
 * Encore API Client for React Native
 *
 * This is a simplified API client that wraps the backend endpoints.
 * Authentication tokens are automatically injected via Clerk.
 */

import { ENV } from '@/config/env';

export interface ApiOptions {
  token?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    // Add auth token if available
    if (this.authToken) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${this.authToken}`,
      };
    }

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Avatar API
  avatar = {
    list: () => this.request<any>('/avatar/list'),
    get: (id: string) => this.request<any>(`/avatar/get?id=${id}`),
    create: (data: any) => this.request<any>('/avatar/create', { method: 'POST', body: data }),
    update: (data: any) => this.request<any>('/avatar/update', { method: 'POST', body: data }),
    delete: (id: string) => this.request<any>('/avatar/delete', { method: 'POST', body: { id } }),
  };

  // Story API
  story = {
    list: () => this.request<any>('/story/list'),
    get: (id: string) => this.request<any>(`/story/get?id=${id}`),
    generate: (data: any) => this.request<any>('/story/generate', { method: 'POST', body: data }),
    delete: (id: string) => this.request<any>('/story/delete', { method: 'POST', body: { id } }),
  };

  // User API
  user = {
    getProfile: () => this.request<any>('/user/get-profile'),
    updateProfile: (data: any) => this.request<any>('/user/update-profile', { method: 'POST', body: data }),
  };

  // Fairy Tales API
  fairytales = {
    list: () => this.request<any>('/fairytales/list'),
    get: (id: string) => this.request<any>(`/fairytales/get?id=${id}`),
  };

  // Doku API
  doku = {
    list: () => this.request<any>('/doku/list'),
    get: (id: string) => this.request<any>(`/doku/get?id=${id}`),
    create: (data: any) => this.request<any>('/doku/create', { method: 'POST', body: data }),
  };

  // AI API
  ai = {
    generateAvatar: (data: any) => this.request<any>('/ai/generate-avatar', { method: 'POST', body: data }),
    generateImage: (data: any) => this.request<any>('/ai/generate-image', { method: 'POST', body: data }),
  };

  // Tavi Chat API
  tavi = {
    chat: (message: string) => this.request<any>('/tavi/chat', { method: 'POST', body: { message } }),
  };
}

// Export singleton instance
export const api = new ApiClient(ENV.BACKEND_URL);
