import { api, Query } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ensureAdmin } from "./authz";

const userDB = SQLDatabase.named("user");

interface ListUsersParams {
  limit?: Query<number>;
  cursor?: Query<string>;
  q?: Query<string>; // search by email or name
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  subscription: "starter" | "familie" | "premium";
  role: "admin" | "user";
  createdAt: Date;
  updatedAt: Date;
}

interface ListUsersResponse {
  users: AdminUser[];
  nextCursor?: string | null;
}

// Lists users with optional search and pagination for the admin panel.
export const listUsers = api<ListUsersParams, ListUsersResponse>(
  { expose: true, method: "GET", path: "/admin/users", auth: true },
  async (req) => {
    ensureAdmin();

    const limit = Math.min(Math.max((req.limit as unknown as number) || 25, 1), 100);
    const cursor = (req.cursor as unknown as string) || null;
    const q = (req.q as unknown as string) || "";

    const rows = await userDB.queryAll<AdminUser & { created_at: Date; updated_at: Date }>`
      SELECT id, email, name, subscription, COALESCE(role, 'user') as role, created_at, updated_at
      FROM users
      WHERE (${q} = '' OR email ILIKE '%' || ${q} || '%' OR name ILIKE '%' || ${q} || '%')
      AND (${cursor} IS NULL OR id > ${cursor})
      ORDER BY id
      LIMIT ${limit + 1}
    `;

    const users: AdminUser[] = rows.slice(0, limit).map(r => ({
      id: r.id,
      email: r.email,
      name: r.name,
      subscription: r.subscription,
      role: (r as any).role as "admin" | "user",
      createdAt: (r as any).created_at,
      updatedAt: (r as any).updated_at,
    }));

    const nextCursor = rows.length > limit ? rows[limit].id : null;

    return { users, nextCursor };
  }
);
