import { Gateway } from "encore.dev/api";

// Global API Gateway with CORS configuration
export const gateway = new Gateway({
  cors: {
    allowedOrigins: [
      // Development
      "http://localhost:3000",
      "http://localhost:5171",
      "http://localhost:5173",
      "http://localhost:5174",

      // Railway Production
      "https://sunny-optimism-production.up.railway.app",
      "https://talea-storytelling-platform-production.up.railway.app",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    allowedMethods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowCredentials: true,
    maxAge: 86400, // 24 hours
  }
});
