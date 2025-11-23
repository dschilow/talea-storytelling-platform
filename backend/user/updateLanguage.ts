import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const userDB = new SQLDatabase("user", {
  migrations: "./migrations",
});

interface UpdateLanguageRequest {
  preferredLanguage: "de" | "en" | "fr" | "es" | "it";
}

interface UpdateLanguageResponse {
  success: boolean;
  preferredLanguage: string;
}

export const updateLanguage = api<UpdateLanguageRequest, UpdateLanguageResponse>(
  { expose: true, method: "POST", path: "/user/language", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const now = new Date();

    await userDB.exec`
      UPDATE users
      SET preferred_language = ${req.preferredLanguage}, updated_at = ${now}
      WHERE id = ${auth.userID}
    `;

    return {
      success: true,
      preferredLanguage: req.preferredLanguage,
    };
  }
);
