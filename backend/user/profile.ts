import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const userDB = new SQLDatabase("user", {
  migrations: "./migrations",
});

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  subscription: "starter" | "familie" | "premium";
  role: "admin" | "user";
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserRequest {
  email: string;
  name: string;
  subscription?: "starter" | "familie" | "premium";
  role?: "admin" | "user";
}

interface GetUserParams {
  id: string;
}

// Creates a new user profile.
export const create = api<CreateUserRequest, UserProfile>(
  { expose: true, method: "POST", path: "/user" },
  async (req) => {
    const id = crypto.randomUUID();
    const now = new Date();
    
    await userDB.exec`
      INSERT INTO users (id, email, name, subscription, role, created_at, updated_at)
      VALUES (${id}, ${req.email}, ${req.name}, ${req.subscription || "starter"}, ${req.role || "user"}, ${now}, ${now})
    `;

    return {
      id,
      email: req.email,
      name: req.name,
      subscription: (req.subscription || "starter") as UserProfile["subscription"],
      role: (req.role || "user") as UserProfile["role"],
      createdAt: now,
      updatedAt: now,
    };
  }
);

// Retrieves a user profile by ID.
export const get = api<GetUserParams, UserProfile>(
  { expose: true, method: "GET", path: "/user/:id" },
  async ({ id }) => {
    const user = await userDB.queryRow<{
      id: string;
      email: string;
      name: string;
      subscription: "starter" | "familie" | "premium";
      role: "admin" | "user";
      createdAt: Date;
      updatedAt: Date;
    }>`
      SELECT id, email, name, subscription, role, created_at as "createdAt", updated_at as "updatedAt"
      FROM users WHERE id = ${id}
    `;

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
);

// Returns the authenticated user's profile, creating it if missing (based on Clerk auth).
export const me = api<void, UserProfile>(
  { expose: true, method: "GET", path: "/user/me", auth: true },
  async () => {
    const auth = getAuthData()!;
    // Attempt to fetch user by auth.userID (we store Clerk userId as our id if present).
    let user = await userDB.queryRow<UserProfile & { createdAt: Date; updatedAt: Date }>`
      SELECT id, email, name, subscription, role, created_at as "createdAt", updated_at as "updatedAt"
      FROM users WHERE id = ${auth.userID}
    `;

    if (!user) {
      const now = new Date();
      // Derive a name from email if not provided by Clerk.
      const name = (auth.email?.split("@")[0] || "User");
      await userDB.exec`
        INSERT INTO users (id, email, name, subscription, role, created_at, updated_at)
        VALUES (${auth.userID}, ${auth.email || ""}, ${name}, 'starter', ${auth.role || "user"}, ${now}, ${now})
      `;
      user = {
        id: auth.userID,
        email: auth.email || "",
        name,
        subscription: "starter",
        role: (auth.role || "user") as "admin" | "user",
        createdAt: now,
        updatedAt: now,
      };
    }

    return user;
  }
);
