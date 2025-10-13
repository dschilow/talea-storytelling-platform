import { api } from "encore.dev/api";

export interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
}

// Health check endpoint for Railway
export const health = api(
  { expose: true, method: "GET", path: "/health", auth: false },
  async (): Promise<HealthResponse> => {
    return {
      status: "healthy",
      message: "Talea Encore Backend is running",
      timestamp: new Date().toISOString(),
    };
  }
);
