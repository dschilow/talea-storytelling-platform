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

// Configure the authorized parties.
// TODO: Configure this for your own domain when deploying to production.
const AUTHORIZED_PARTIES = [
  "https://*.lp.dev",
];

const auth = authHandler<AuthParams, AuthData>(
  async (data) => {
    const token = data.authorization?.replace("Bearer ", "") ?? data.session?.value;
    if (!token) {
      throw APIError.unauthenticated("missing token");
    }

    try {
      const verifiedToken = await verifyToken(token, {
        authorizedParties: AUTHORIZED_PARTIES,
        secretKey: clerkSecretKey(),
        // Add a 60-second clock skew tolerance to handle potential time sync issues
        // between the local environment and Clerk's servers.
        clockSkewInSeconds: 60,
      });

      const clerkUser = await clerkClient.users.getUser(verifiedToken.sub);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;

      // Check if user exists in our DB, create if not (upsert-like logic).
      let user = await userDB.queryRow<{ id: string; role: "admin" | "user" }>`
        SELECT id, role FROM users WHERE id = ${clerkUser.id}
      `;

      if (!user) {
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

      return {
        userID: clerkUser.id,
        email,
        imageUrl: clerkUser.imageUrl,
        role: user.role,
      };
    } catch (err: any) {
      // Log the actual error for debugging, but return a generic message.
      console.error("Auth error:", err.message);
      throw APIError.unauthenticated("invalid token");
    }
  }
);

// Configure the API gateway to use the auth handler globally.
// Endpoints can opt-in with { auth: true } to require authentication.
export const gw = new Gateway({ authHandler: auth });
