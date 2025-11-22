import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

// Railway uses self-signed certificates, so we disable SSL verification
const userDB = new SQLDatabase("user", {
  migrations: "./migrations",
});

export type SupportedLanguage = "de" | "en" | "fr" | "es" | "it" | "nl";
export type Theme = "light" | "dark" | "system";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  subscription: "starter" | "familie" | "premium";
  role: "admin" | "user";
  preferredLanguage: SupportedLanguage;
  theme: Theme;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserRequest {
  email: string;
  name: string;
  subscription?: "starter" | "familie" | "premium";
  role?: "admin" | "user";
  preferredLanguage?: SupportedLanguage;
  theme?: Theme;
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
      INSERT INTO users (id, email, name, subscription, role, preferred_language, theme, created_at, updated_at)
      VALUES (${id}, ${req.email}, ${req.name}, ${req.subscription || "starter"}, ${req.role || "user"}, ${req.preferredLanguage || "de"}, ${req.theme || "system"}, ${now}, ${now})
    `;

    return {
      id,
      email: req.email,
      name: req.name,
      subscription: (req.subscription || "starter") as UserProfile["subscription"],
      role: (req.role || "user") as UserProfile["role"],
      preferredLanguage: (req.preferredLanguage || "de") as SupportedLanguage,
      theme: (req.theme || "system") as Theme,
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
      preferredLanguage: SupportedLanguage;
      theme: Theme;
      createdAt: Date;
      updatedAt: Date;
    }>`
      SELECT id, email, name, subscription, role, preferred_language as "preferredLanguage", theme, created_at as "createdAt", updated_at as "updatedAt"
      FROM users WHERE id = ${id}
    `;

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
);

// Returns the authenticated user's profile.
// The auth handler ensures the user exists in the database.
export const me = api<void, UserProfile>(
  { expose: true, method: "GET", path: "/user/me", auth: true },
  async () => {
    const auth = getAuthData()!;

    const user = await userDB.queryRow<UserProfile & { created_at: Date; updated_at: Date; preferred_language: SupportedLanguage }>`
      SELECT id, email, name, subscription, role, preferred_language, theme, created_at, updated_at
      FROM users WHERE id = ${auth.userID}
    `;

    if (!user) {
      // This should not happen anymore since the auth handler creates the user,
      // but it's a good safeguard.
      throw APIError.internal("Authenticated user not found in database.");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      subscription: user.subscription,
      role: user.role,
      preferredLanguage: user.preferred_language,
      theme: user.theme,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
);

interface UpdateLanguageRequest {
  language: SupportedLanguage;
}

// Updates the authenticated user's preferred language.
export const updateLanguage = api<UpdateLanguageRequest, UserProfile>(
  { expose: true, method: "POST", path: "/user/language", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const now = new Date();

    await userDB.exec`
      UPDATE users
      SET preferred_language = ${req.language}, updated_at = ${now}
      WHERE id = ${auth.userID}
    `;

    const user = await userDB.queryRow<UserProfile & { created_at: Date; updated_at: Date; preferred_language: SupportedLanguage }>`
      SELECT id, email, name, subscription, role, preferred_language, theme, created_at, updated_at
      FROM users WHERE id = ${auth.userID}
    `;

    if (!user) {
      throw APIError.internal("User not found after update.");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      subscription: user.subscription,
      role: user.role,
      preferredLanguage: user.preferred_language,
      theme: user.theme,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
);

interface UpdateThemeRequest {
  theme: Theme;
}

// Updates the authenticated user's theme preference.
export const updateTheme = api<UpdateThemeRequest, UserProfile>(
  { expose: true, method: "POST", path: "/user/theme", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const now = new Date();

    await userDB.exec`
      UPDATE users
      SET theme = ${req.theme}, updated_at = ${now}
      WHERE id = ${auth.userID}
    `;

    const user = await userDB.queryRow<UserProfile & { created_at: Date; updated_at: Date; preferred_language: SupportedLanguage }>`
      SELECT id, email, name, subscription, role, preferred_language, theme, created_at, updated_at
      FROM users WHERE id = ${auth.userID}
    `;

    if (!user) {
      throw APIError.internal("User not found after update.");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      subscription: user.subscription,
      role: user.role,
      preferredLanguage: user.preferred_language,
      theme: user.theme,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
);
