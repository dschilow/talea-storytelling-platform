import { createClerkClient, verifyToken } from "@clerk/backend";
import { APIError, Cookie, Gateway, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Reuse the existing databases to resolve roles and migrate data if needed.
const userDB = SQLDatabase.named("user");
const avatarDB = SQLDatabase.named("avatar");
const storyDB = SQLDatabase.named("story");
const dokuDB = SQLDatabase.named("doku");

// Secret configured in the Encore infrastructure settings.
const clerkSecretKey = secret("ClerkSecretKey");

// Clerk client to fetch user data when needed.
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
  clerkToken: string;
}

// Allowlist of frontends that may mint Clerk tokens for this backend.
const RAW_AUTHORIZED_PARTIES = [
  // Development
  "http://localhost:3000",
  "http://localhost:5171",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:4000",

  // Leap.dev patterns
  "https://*.lp.dev",
  "https://talea-storytelling-platform-*.lp.dev",
  "https://talea-storytelling-platform-4ot2.lp.dev",
  "https://talea-storytelling-platform-d2okv1482vjjq7d7fpi0.lp.dev",

  // Railway production frontend + custom domains
  "https://frontend-production-0b44.up.railway.app",
  "https://www.talea.website",
  "https://talea.website",

  // Clerk hosted pages (for sign-in flows)
  "https://sincere-jay-4.clerk.accounts.dev",
  "https://amused-aardvark-78.clerk.accounts.dev",
];

function expandOrigin(origin: string): string[] {
  const variants = new Set<string>();
  const trimmed = origin.replace(/\/+$/, "");
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
    // Ignore invalid URLs (e.g. wildcard patterns) and keep the original value.
    variants.add(origin);
  }

  return Array.from(variants);
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function patternToRegex(pattern: string): RegExp | undefined {
  if (!pattern.includes("*")) {
    return undefined;
  }

  const escaped = normalizeOrigin(pattern)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i");
}

interface AuthorizedOriginEntry {
  raw: string;
  normalized: string;
  regex?: RegExp;
}

const AUTHORIZED_ORIGINS: AuthorizedOriginEntry[] = Array.from(
  new Set(RAW_AUTHORIZED_PARTIES.flatMap(expandOrigin)),
).map((origin) => ({
  raw: origin,
  normalized: normalizeOrigin(origin),
  regex: patternToRegex(origin),
}));

function matchesAuthorizedOrigin(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = normalizeOrigin(value);
  return AUTHORIZED_ORIGINS.some((entry) =>
    entry.regex ? entry.regex.test(normalized) : entry.normalized === normalized,
  );
}

function matchesAnyAuthorizedOrigin(values: Array<string | undefined>): boolean {
  return values.some((value) => matchesAuthorizedOrigin(value));
}

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

const auth = authHandler<AuthParams, AuthData>(async (data) => {
  const token = data.authorization?.replace("Bearer ", "") ?? data.session?.value;
  if (!token) {
    throw APIError.unauthenticated("missing token");
  }

  try {
    console.log("Starting Clerk token verification...");

    // CRITICAL: Check if ClerkSecretKey is configured
    const secretKey = clerkSecretKey();
    if (!secretKey || secretKey.length === 0) {
      console.error("❌ CRITICAL: ClerkSecretKey is missing or empty!");
      throw new Error("ClerkSecretKey not configured - check Railway environment variables");
    }

    console.log("✅ ClerkSecretKey is configured (length: " + secretKey.length + ")");

    const verifiedToken = await verifyToken(token, {
      secretKey,
      // Clock-Skew-Toleranz fuer Edge-Deployments.
      clockSkewInMs: 120000,
    });

    const audValues = Array.isArray(verifiedToken.aud)
      ? verifiedToken.aud
      : verifiedToken.aud
      ? [verifiedToken.aud]
      : [];

    if (!matchesAnyAuthorizedOrigin([verifiedToken.azp, ...audValues])) {
      console.warn("Hinweis: Token azp/aud passt nicht zu den bekannten Origins", {
        azp: verifiedToken.azp,
        aud: verifiedToken.aud,
      });
    }

    console.log("Token erfolgreich verifiziert", {
        sub: verifiedToken.sub,
        azp: verifiedToken.azp,
        aud: verifiedToken.aud,
        iss: verifiedToken.iss,
        exp: new Date(verifiedToken.exp * 1000).toISOString(),
    });

    const clerkUser = await clerkClient.users.getUser(verifiedToken.sub);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;

    // Check if user exists in our DB, create if not (upsert-like logic).
    let user = await userDB.queryRow<{ id: string; role: "admin" | "user" }>`
      SELECT id, role FROM users WHERE id = ${clerkUser.id}
    `;

    if (!user) {
      const now = new Date();
      const name =
        clerkUser.firstName ||
        clerkUser.username ||
        (email ? email.split("@")[0] : null) ||
        "New User";
      const role: "admin" | "user" = "user";

      let existingByEmail: { id: string; role: "admin" | "user" } | null = null;
      if (email) {
        existingByEmail = await userDB.queryRow<{ id: string; role: "admin" | "user" }>`
          SELECT id, role FROM users WHERE email = ${email}
        `;
      }

      if (existingByEmail && existingByEmail.id !== clerkUser.id) {
        console.log("Merging Clerk identities by email", {
          from: existingByEmail.id,
          to: clerkUser.id,
          email,
        });

        const oldId = existingByEmail.id;

        await userDB.exec`
          UPDATE users
          SET id = ${clerkUser.id},
              email = ${email},
              name = ${name},
              updated_at = ${now}
          WHERE id = ${oldId}
        `;

        await Promise.all([
          avatarDB.exec`
            UPDATE avatars
            SET user_id = ${clerkUser.id}
            WHERE user_id = ${oldId}
          `,
          storyDB.exec`
            UPDATE stories
            SET user_id = ${clerkUser.id}
            WHERE user_id = ${oldId}
          `,
          dokuDB.exec`
            UPDATE dokus
            SET user_id = ${clerkUser.id}
            WHERE user_id = ${oldId}
          `,
        ]);

        user = { id: clerkUser.id, role: existingByEmail.role };
      }

      if (!user) {
        console.log("Creating new user in database:", clerkUser.id);

        await userDB.exec`
          INSERT INTO users (id, email, name, subscription, role, created_at, updated_at)
          VALUES (${clerkUser.id}, ${email}, ${name}, 'starter', ${role}, ${now}, ${now})
          ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email,
                name = EXCLUDED.name,
                updated_at = EXCLUDED.updated_at
        `;
        user = { id: clerkUser.id, role };
      }
    }

    console.log("Authentication successful for user:", user.id);

      return {
        userID: clerkUser.id,
        email,
        imageUrl: clerkUser.imageUrl,
        role: user.role,
        clerkToken: token,
      };
  } catch (err: any) {
    console.error("❌ Authentication failed:", err.message);
    console.error("Error reason:", err.reason || "unknown");

    if (err.longMessage) {
      console.error("Details:", err.longMessage);
    }
    if (err.code) {
      console.error("Error code:", err.code);
    }

    // CRITICAL: Diagnose "fetch failed" errors which indicate Clerk API connectivity issues
    const errorReason = (typeof err.reason === "string" ? err.reason : err.message) || "unknown";
    if (errorReason.includes("fetch") || errorReason.includes("network") || errorReason.includes("ECONNREFUSED")) {
      console.error("🔥 CRITICAL: Network connectivity issue with Clerk API!");
      console.error("Possible causes:");
      console.error("  1. ClerkSecretKey is invalid or missing in Railway environment");
      console.error("  2. Network/firewall blocking Clerk API (api.clerk.com)");
      console.error("  3. Clerk API is down (check status.clerk.com)");
      console.error("");
      console.error("🔧 To fix:");
      console.error("  1. Verify ClerkSecretKey is set in Railway: railway variables");
      console.error("  2. Check Railway logs for network errors");
      console.error("  3. Test Clerk API: curl https://api.clerk.com/v1/jwks");
    }

    const payload = decodeTokenPayload(token);
    if (payload) {
      console.error("Token azp claim:", payload["azp"]);
      console.error("Token iss claim:", payload["iss"]);
      console.error("Token aud claim:", payload["aud"]);
    } else {
      console.error("Could not decode token for debugging");
    }

    console.error("Full auth error object:", {
      reason: err.reason,
      message: err.message,
      code: err.code,
      longMessage: err.longMessage,
    });
    const sanitizedReason =
      typeof err.reason === "string"
        ? err.reason
        : typeof err.message === "string"
        ? err.message
        : "unknown";
    const detail = payload
      ? `azp=${payload["azp"] ?? "n/a"}, aud=${payload["aud"] ?? "n/a"}`
      : "payload=unavailable";

    throw APIError.unauthenticated(`invalid token (${sanitizedReason}; ${detail})`);
  }
});

// Configure the API gateway to use the auth handler globally.
export const gw = new Gateway({ authHandler: auth });
