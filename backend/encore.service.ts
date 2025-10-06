import { Service } from "encore.dev/service";

// Global service configuration with CORS
export default new Service("api", {
  cors: {
    allowedOrigins: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://sunny-optimism-production.up.railway.app",
      "https://talea-storytelling-platform-production.up.railway.app",
    ],
    allowedHeaders: ["Content-Type", "Authorization"],
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowCredentials: true,
  },
});
