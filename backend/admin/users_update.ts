import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ensureAdmin } from "./authz";

const userDB = SQLDatabase.named("user");

interface UpdateUserParams {
  id: string;
}

interface UpdateUserRequest extends UpdateUserParams {
  name?: string;
  email?: string;
  subscription?: "starter" | "familie" | "premium";
  role?: "admin" | "user";
}

interface UpdateUserResponse {
  success: boolean;
}

// Updates basic fields for a user (admin only).
export const updateUser = api<UpdateUserRequest, UpdateUserResponse>(
  { expose: true, method: "PUT", path: "/admin/users/:id", auth: true },
  async (req) => {
    ensureAdmin();

    const existing = await userDB.queryRow`SELECT id FROM users WHERE id = ${req.id}`;
    if (!existing) {
      throw APIError.notFound("user not found");
    }

    await userDB.exec`
      UPDATE users
      SET
        name = COALESCE(${req.name}, name),
        email = COALESCE(${req.email}, email),
        subscription = COALESCE(${req.subscription}, subscription),
        role = COALESCE(${req.role}, role),
        updated_at = ${new Date()}
      WHERE id = ${req.id}
    `;

    return { success: true };
  }
);
