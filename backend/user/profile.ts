import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { userDB } from "./db";
import { getBillingOverview, type BillingOverview } from "../helpers/billing";

export type SupportedLanguage = "de" | "en" | "fr" | "es" | "it" | "nl" | "ru";
export type Theme = "light" | "dark" | "system";

async function ensurePreferenceColumns() {
  // Defensive: make sure DB has the new preference columns before we read/write
  try {
    await userDB.exec`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'de';
    `;
  } catch (err) {
    console.warn("[user.ensurePreferenceColumns] preferred_language add skipped", err);
  }

  try {
    await userDB.exec`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system';
    `;
  } catch (err) {
    console.warn("[user.ensurePreferenceColumns] theme add skipped", err);
  }

  try {
    await userDB.exec`
      UPDATE users
      SET preferred_language = 'de'
      WHERE preferred_language IS NULL;
    `;
  } catch (err) {
    console.warn("[user.ensurePreferenceColumns] preferred_language backfill skipped", err);
  }

  try {
    await userDB.exec`
      UPDATE users
      SET theme = 'system'
      WHERE theme IS NULL;
    `;
  } catch (err) {
    console.warn("[user.ensurePreferenceColumns] theme backfill skipped", err);
  }
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  subscription: "free" | "starter" | "familie" | "premium";
  role: "admin" | "user";
  preferredLanguage: SupportedLanguage;
  theme: Theme;
  billing: BillingOverview;
  createdAt: Date;
  updatedAt: Date;
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  subscription: "free" | "starter" | "familie" | "premium";
  role: "admin" | "user";
  preferred_language: SupportedLanguage;
  theme: Theme;
  created_at: Date;
  updated_at: Date;
};

async function getUserRowById(userId: string): Promise<UserRow> {
  const user = await userDB.queryRow<UserRow>`
    SELECT id, email, name, subscription, role, preferred_language, theme, created_at, updated_at
    FROM users WHERE id = ${userId}
  `;

  if (!user) {
    throw APIError.notFound("User not found");
  }

  return user;
}

function mapUserProfile(row: UserRow, billing: BillingOverview): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    subscription: billing.plan,
    role: row.role,
    preferredLanguage: row.preferred_language,
    theme: row.theme,
    billing,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function buildUserProfile(userId: string, clerkToken?: string | null): Promise<UserProfile> {
  const billing = await getBillingOverview({ userId, clerkToken });
  const row = await getUserRowById(userId);
  return mapUserProfile(row, billing);
}

interface CreateUserRequest {
  email: string;
  name: string;
  subscription?: "free" | "starter" | "familie" | "premium";
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

    await ensurePreferenceColumns();
    
    await userDB.exec`
      INSERT INTO users (id, email, name, subscription, role, preferred_language, theme, created_at, updated_at)
      VALUES (${id}, ${req.email}, ${req.name}, ${req.subscription || "free"}, ${req.role || "user"}, ${req.preferredLanguage || "de"}, ${req.theme || "system"}, ${now}, ${now})
    `;

    return buildUserProfile(id);
  }
);

// Retrieves a user profile by ID.
export const get = api<GetUserParams, UserProfile>(
  { expose: true, method: "GET", path: "/user/:id" },
  async ({ id }) => {
    await ensurePreferenceColumns();
    return buildUserProfile(id);
  }
);

// Returns the authenticated user's profile.
// The auth handler ensures the user exists in the database.
export const me = api<void, UserProfile>(
  { expose: true, method: "GET", path: "/user/me", auth: true },
  async () => {
    const auth = getAuthData()!;

    await ensurePreferenceColumns();
    return buildUserProfile(auth.userID, auth.clerkToken);
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

    await ensurePreferenceColumns();

    await userDB.exec`
      UPDATE users
      SET preferred_language = ${req.language}, updated_at = ${now}
      WHERE id = ${auth.userID}
    `;

    return buildUserProfile(auth.userID, auth.clerkToken);
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

    await ensurePreferenceColumns();

    await userDB.exec`
      UPDATE users
      SET theme = ${req.theme}, updated_at = ${now}
      WHERE id = ${auth.userID}
    `;

    return buildUserProfile(auth.userID, auth.clerkToken);
  }
);
