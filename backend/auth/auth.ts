import { createClerkClient, verifyToken } from "@clerk/backend";
import { Header, Cookie, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Reuse existing "user" database to resolve roles.
const userDB = SQLDatabase.named("user");

// Secrets configured in Infrastructure tab.
const clerkSecretKey = secret("ClerkSecretKey");

// Clerk client to fetch user data if needed.
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

interface AuthParams {
  // Bearer token (recommended).
  authorization?: Header<"Authorization">;
  // Optional session cookie.
  session?: Cookie<"session">;
}

// Extend AuthData to include useful fields for authorization in services.
export interface AuthData {
  userID: string;
  email: string | null;
  imageUrl: string | null;
  role: "admin" | "user";
}

// 🔧 FIXED: Erweiterte authorized parties für alle Leap.new & Railway Umgebungen
const AUTHORIZED_PARTIES = [
  // Development
  "http://localhost:3000",
  "http://localhost:5171", // Vite Dev Server (custom port)
  "http://localhost:5173", // Vite Dev Server
  "http://localhost:5174", // Vite Dev Server (alternative port)
  "http://localhost:5175", // Vite Dev Server (alternative port)
  "http://localhost:5176", // Vite Dev Server (alternative port)
  "http://localhost:5177", // Vite Dev Server (alternative port)
  "http://localhost:4000", // Encore Dev Server

  // Leap.new Patterns - Alle möglichen Varianten
  "https://*.lp.dev",
  "https://talea-storytelling-platform-*.lp.dev",
  "https://talea-storytelling-platform-4ot2.lp.dev", // Aus encore.app

  // 🎯 SPECIFIC FIX: Die exakte Domain aus dem Fehler
  "https://talea-storytelling-platform-d2okv1482vjjq7d7fpi0.lp.dev",

  // Railway Production Patterns
  "https://*.up.railway.app",
  "https://talea-storytelling-platform-*.up.railway.app",
  "https://sunny-optimism-production.up.railway.app", // Frontend Production Domain

  // Railway Custom Domains (wenn du später eine hinzufügst)
  // "https://talea.deine-domain.de",
  // "https://api.deine-domain.de",

  // Production (Custom Domain)
  // "https://your-domain.com",
  // "https://api.your-domain.com",
];

export const auth = authHandler<AuthParams, AuthData>(
  async (data) => {
    const token = data.authorization?.replace("Bearer ", "") ?? data.session?.value;
    if (!token) {
      throw APIError.unauthenticated("missing token");
    }

    try {
      console.log("🔐 Starting token verification...");
      console.log("🎯 Authorized parties:", AUTHORIZED_PARTIES);

      const verifiedToken = await verifyToken(token, {
        authorizedParties: AUTHORIZED_PARTIES,
        secretKey: clerkSecretKey(),
        clockSkewInMs: 120000, // 2 minutes in milliseconds
      });

      console.log("✅ Token verified successfully!");
      console.log("📋 Token info:", {
        sub: verifiedToken.sub,
        azp: verifiedToken.azp,
        iss: verifiedToken.iss,
        exp: new Date(verifiedToken.exp * 1000).toISOString()
      });

      // ✅ FIXED: No DB calls in auth handler - only token verification
      // User data will be fetched/created in the actual endpoints that need it
      console.log("🎉 Authentication successful for user:", verifiedToken.sub);

      return {
        userID: verifiedToken.sub,
        email: null, // Will be populated by endpoints if needed
        imageUrl: null, // Will be populated by endpoints if needed
        role: "user" as const, // Default role, will be checked in endpoints if needed
      };

    } catch (err: any) {
      // Enhanced error logging for debugging
      console.error("❌ Authentication failed:", err.message);
      console.error("🔍 Error reason:", err.reason || "unknown");
      
      if (err.longMessage) {
        console.error("📝 Details:", err.longMessage);
      }
      if (err.code) {
        console.error("🏷️ Error Code:", err.code);
      }
      
      // Log the token info for debugging (but not the full token for security)
      if (token) {
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.error("🎫 Token azp claim:", payload.azp);
            console.error("🎫 Token iss claim:", payload.iss);
            console.error("🎫 Token aud claim:", payload.aud);
          }
        } catch {
          console.error("🎫 Could not decode token for debugging");
        }
      }
      
      // Full error object for maximum debuggability
      console.error("📊 Full auth error object:", {
        reason: err.reason,
        message: err.message,
        code: err.code,
        longMessage: err.longMessage
      });
      
      // The error thrown to the client should remain generic for security.
      throw APIError.unauthenticated("invalid token");
    }
  }
);

// Configure the API gateway to use the auth handler globally.
// Endpoints can opt-in with { auth: true } to require authentication.
export const gw = new Gateway({ authHandler: auth });