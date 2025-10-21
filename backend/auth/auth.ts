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

// 🔧 FIXED: Erweiterte authorized parties für alle Leap.new Umgebungen
const RAW_AUTHORIZED_PARTIES = [
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

  // Railway Production
  "https://frontend-production-0b44.up.railway.app",
  "https://www.talea.website",
  "https://talea.website",

  // Clerk hosted pages
  "https://sincere-jay-4.clerk.accounts.dev",
  "https://amused-aardvark-78.clerk.accounts.dev",

  // Production (wenn du später deployed)
  // "https://your-domain.com",
  // "https://api.your-domain.com",
];

function expandOrigin(origin: string): string[] {
  const variants = new Set<string>();
  const trimmed = origin.replace(/\/$/, "");
  variants.add(trimmed);
  variants.add(`${trimmed}/`);

  try {
    const url = new URL(trimmed);
    if (!url.port) {
      const defaultPort =
        url.protocol === "https:" ? "443" :
        url.protocol === "http:" ? "80" :
        "";
      if (defaultPort) {
        const withPort = `${url.protocol}//${url.hostname}:${defaultPort}`;
        variants.add(withPort);
        variants.add(`${withPort}/`);
      }
    }
  } catch {
    // If origin is not a valid URL we fall back to the original value.
    variants.add(origin);
  }

  return Array.from(variants);
}

const AUTHORIZED_PARTIES = Array.from(
  new Set(RAW_AUTHORIZED_PARTIES.flatMap(expandOrigin)),
);

const auth = authHandler<AuthParams, AuthData>(
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
        // 🔧 FIXED: Erhöhte Clock Skew Tolerance
        clockSkewInMs: 120000, // 2 Minuten (in Millisekunden)
      });

      console.log("✅ Token verified successfully!");
      console.log("📋 Token info:", {
        sub: verifiedToken.sub,
        azp: verifiedToken.azp,
        iss: verifiedToken.iss,
        exp: new Date(verifiedToken.exp * 1000).toISOString()
      });

      const clerkUser = await clerkClient.users.getUser(verifiedToken.sub);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;

      // Check if user exists in our DB, create if not (upsert-like logic).
      let user = await userDB.queryRow<{ id: string; role: "admin" | "user" }>`
        SELECT id, role FROM users WHERE id = ${clerkUser.id}
      `;

      if (!user) {
        console.log("👤 Creating new user in database:", clerkUser.id);
        const now = new Date();
        const name = clerkUser.firstName || clerkUser.username || email?.split("@")[0] || "New User";
        const role: "admin" | "user" = "user"; // New users are always 'user' role.
        
        await userDB.exec`
          INSERT INTO users (id, email, name, subscription, role, created_at, updated_at)
          VALUES (${clerkUser.id}, ${email}, ${name}, 'starter', ${role}, ${now}, ${now})
          ON CONFLICT (id) DO NOTHING
        `;
        user = { id: clerkUser.id, role };
      }

      console.log("🎉 Authentication successful for user:", user.id);

      return {
        userID: clerkUser.id,
        email,
        imageUrl: clerkUser.imageUrl,
        role: user.role,
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
