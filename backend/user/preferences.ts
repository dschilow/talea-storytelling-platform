import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const userDB = new SQLDatabase("user", {
  migrations: "./migrations",
});

export interface UserPreferences {
  userId: string;
  theme: "light" | "dark" | "auto";
  language: string;
  defaultReader: "cinematic" | "scroll" | "old";
  fontSize: "small" | "medium" | "large";
  animationsEnabled: boolean;
  storiesPublicByDefault: boolean;
  emailStoryComplete: boolean;
  emailWeeklyDigest: boolean;
  emailMarketing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdatePreferencesRequest {
  theme?: "light" | "dark" | "auto";
  language?: string;
  defaultReader?: "cinematic" | "scroll" | "old";
  fontSize?: "small" | "medium" | "large";
  animationsEnabled?: boolean;
  storiesPublicByDefault?: boolean;
  emailStoryComplete?: boolean;
  emailWeeklyDigest?: boolean;
  emailMarketing?: boolean;
}

// Get or create user preferences
export const getPreferences = api<void, UserPreferences>(
  { expose: true, method: "GET", path: "/user/preferences", auth: true },
  async () => {
    const auth = getAuthData()!;

    // Try to get existing preferences
    let prefs = await userDB.queryRow<{
      user_id: string;
      theme: "light" | "dark" | "auto";
      language: string;
      default_reader: "cinematic" | "scroll" | "old";
      font_size: "small" | "medium" | "large";
      animations_enabled: boolean;
      stories_public_by_default: boolean;
      email_story_complete: boolean;
      email_weekly_digest: boolean;
      email_marketing: boolean;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT
        user_id,
        theme,
        language,
        default_reader,
        font_size,
        animations_enabled,
        stories_public_by_default,
        email_story_complete,
        email_weekly_digest,
        email_marketing,
        created_at,
        updated_at
      FROM user_preferences
      WHERE user_id = ${auth.userID}
    `;

    // If no preferences exist, create default ones
    if (!prefs) {
      const now = new Date();
      await userDB.exec`
        INSERT INTO user_preferences (user_id, created_at, updated_at)
        VALUES (${auth.userID}, ${now}, ${now})
      `;

      // Fetch the newly created preferences
      prefs = (await userDB.queryRow<{
        user_id: string;
        theme: "light" | "dark" | "auto";
        language: string;
        default_reader: "cinematic" | "scroll" | "old";
        font_size: "small" | "medium" | "large";
        animations_enabled: boolean;
        stories_public_by_default: boolean;
        email_story_complete: boolean;
        email_weekly_digest: boolean;
        email_marketing: boolean;
        created_at: Date;
        updated_at: Date;
      }>`
        SELECT
          user_id,
          theme,
          language,
          default_reader,
          font_size,
          animations_enabled,
          stories_public_by_default,
          email_story_complete,
          email_weekly_digest,
          email_marketing,
          created_at,
          updated_at
        FROM user_preferences
        WHERE user_id = ${auth.userID}
      `)!;
    }

    return {
      userId: prefs.user_id,
      theme: prefs.theme,
      language: prefs.language,
      defaultReader: prefs.default_reader,
      fontSize: prefs.font_size,
      animationsEnabled: prefs.animations_enabled,
      storiesPublicByDefault: prefs.stories_public_by_default,
      emailStoryComplete: prefs.email_story_complete,
      emailWeeklyDigest: prefs.email_weekly_digest,
      emailMarketing: prefs.email_marketing,
      createdAt: prefs.created_at,
      updatedAt: prefs.updated_at,
    };
  }
);

// Update user preferences
export const updatePreferences = api<UpdatePreferencesRequest, UserPreferences>(
  { expose: true, method: "PUT", path: "/user/preferences", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const now = new Date();

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (req.theme !== undefined) {
      updates.push(`theme = $${values.length + 1}`);
      values.push(req.theme);
    }
    if (req.language !== undefined) {
      updates.push(`language = $${values.length + 1}`);
      values.push(req.language);
    }
    if (req.defaultReader !== undefined) {
      updates.push(`default_reader = $${values.length + 1}`);
      values.push(req.defaultReader);
    }
    if (req.fontSize !== undefined) {
      updates.push(`font_size = $${values.length + 1}`);
      values.push(req.fontSize);
    }
    if (req.animationsEnabled !== undefined) {
      updates.push(`animations_enabled = $${values.length + 1}`);
      values.push(req.animationsEnabled);
    }
    if (req.storiesPublicByDefault !== undefined) {
      updates.push(`stories_public_by_default = $${values.length + 1}`);
      values.push(req.storiesPublicByDefault);
    }
    if (req.emailStoryComplete !== undefined) {
      updates.push(`email_story_complete = $${values.length + 1}`);
      values.push(req.emailStoryComplete);
    }
    if (req.emailWeeklyDigest !== undefined) {
      updates.push(`email_weekly_digest = $${values.length + 1}`);
      values.push(req.emailWeeklyDigest);
    }
    if (req.emailMarketing !== undefined) {
      updates.push(`email_marketing = $${values.length + 1}`);
      values.push(req.emailMarketing);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("No fields to update");
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = $${values.length + 1}`);
    values.push(now);

    // Add user_id for WHERE clause
    values.push(auth.userID);

    // Execute update using raw SQL since Encore doesn't support dynamic template queries
    const query = `
      UPDATE user_preferences
      SET ${updates.join(", ")}
      WHERE user_id = $${values.length}
      RETURNING
        user_id,
        theme,
        language,
        default_reader,
        font_size,
        animations_enabled,
        stories_public_by_default,
        email_story_complete,
        email_weekly_digest,
        email_marketing,
        created_at,
        updated_at
    `;

    const result = await userDB.queryRow<{
      user_id: string;
      theme: "light" | "dark" | "auto";
      language: string;
      default_reader: "cinematic" | "scroll" | "old";
      font_size: "small" | "medium" | "large";
      animations_enabled: boolean;
      stories_public_by_default: boolean;
      email_story_complete: boolean;
      email_weekly_digest: boolean;
      email_marketing: boolean;
      created_at: Date;
      updated_at: Date;
    }>(query, ...values);

    if (!result) {
      throw APIError.notFound("User preferences not found");
    }

    return {
      userId: result.user_id,
      theme: result.theme,
      language: result.language,
      defaultReader: result.default_reader,
      fontSize: result.font_size,
      animationsEnabled: result.animations_enabled,
      storiesPublicByDefault: result.stories_public_by_default,
      emailStoryComplete: result.email_story_complete,
      emailWeeklyDigest: result.email_weekly_digest,
      emailMarketing: result.email_marketing,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }
);

// Delete user account (soft delete or full delete)
export const deleteAccount = api<void, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/user/account", auth: true },
  async () => {
    const auth = getAuthData()!;

    // Delete user preferences first (CASCADE should handle this, but being explicit)
    await userDB.exec`DELETE FROM user_preferences WHERE user_id = ${auth.userID}`;

    // Delete user
    await userDB.exec`DELETE FROM users WHERE id = ${auth.userID}`;

    // Note: This doesn't delete from Clerk. That should be handled separately
    // or the admin can do it manually.

    return { success: true };
  }
);

// Update user profile (name)
interface UpdateProfileRequest {
  name?: string;
}

export const updateProfile = api<UpdateProfileRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/user/profile", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const now = new Date();

    if (!req.name || req.name.trim().length === 0) {
      throw APIError.invalidArgument("Name cannot be empty");
    }

    await userDB.exec`
      UPDATE users
      SET name = ${req.name.trim()}, updated_at = ${now}
      WHERE id = ${auth.userID}
    `;

    return { success: true };
  }
);
