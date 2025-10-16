import { api } from "encore.dev/api";
import { initializeDatabaseMigrations } from "./init-migrations";

export interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
  migrations?: {
    run: boolean;
    message: string;
  };
}

// GitHub Actions trigger: force rebuild


// Health check endpoint for Railway
// Automatically triggers database migrations on first call
export const health = api(
  { expose: true, method: "GET", path: "/health", auth: false },
  async (): Promise<HealthResponse> => {
    // Trigger migrations on health check
    let migrationsResult;
    try {
      migrationsResult = await initializeDatabaseMigrations();
    } catch (err: any) {
      console.warn("Migrations check failed:", err.message);
      migrationsResult = { success: false, message: err.message };
    }

    return {
      status: "healthy",
      message: "Talea Encore Backend is running",
      timestamp: new Date().toISOString(),
      migrations: {
        run: migrationsResult.success,
        message: migrationsResult.message,
      },
    };
  }
);
