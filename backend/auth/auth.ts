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
      });

      // Fetch user details from Clerk
      const user = await clerkClient.users.getUser(verifiedToken.sub);
      const email = user.emailAddresses?.[0]?.emailAddress ?? null;
      const imageUrl = user.imageUrl ?? null;

      // Resolve role from database, default to 'user' if not found.
      const existing = await userDB.queryRow<{ role: "admin" | "user" }>`
        SELECT role FROM users WHERE id = ${user.id}
      `;
      const role = existing?.role ?? "user";

      return {
        userID: user.id,
        email,
        imageUrl,
        role,
      };
    } catch (err) {
      throw APIError.unauthenticated("invalid token", err);
    }
  }
);

// Configure the API gateway to use the auth handler globally.
// Endpoints can opt-in with { auth: true } to require authentication.
export const gw = new Gateway({ authHandler: auth });
