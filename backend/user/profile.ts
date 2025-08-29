import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const userDB = new SQLDatabase("user", {
  migrations: "./migrations",
});

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  subscription: "starter" | "familie" | "premium";
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserRequest {
  email: string;
  name: string;
  subscription?: "starter" | "familie" | "premium";
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
      INSERT INTO users (id, email, name, subscription, created_at, updated_at)
      VALUES (${id}, ${req.email}, ${req.name}, ${req.subscription || "starter"}, ${now}, ${now})
    `;

    return {
      id,
      email: req.email,
      name: req.name,
      subscription: req.subscription || "starter",
      createdAt: now,
      updatedAt: now,
    };
  }
);

// Retrieves a user profile by ID.
export const get = api<GetUserParams, UserProfile>(
  { expose: true, method: "GET", path: "/user/:id" },
  async ({ id }) => {
    const user = await userDB.queryRow<UserProfile>`
      SELECT id, email, name, subscription, created_at as "createdAt", updated_at as "updatedAt"
      FROM users WHERE id = ${id}
    `;

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
);
