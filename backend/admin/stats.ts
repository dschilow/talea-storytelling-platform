import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ensureAdmin } from "./authz";

const userDB = SQLDatabase.named("user");
const avatarDB = SQLDatabase.named("avatar");
const storyDB = SQLDatabase.named("story");

interface AdminStats {
  totals: {
    users: number;
    avatars: number;
    stories: number;
  };
  subscriptions: {
    starter: number;
    familie: number;
    premium: number;
  };
  storiesByStatus: {
    generating: number;
    complete: number;
    error: number;
  };
  recentActivity: {
    latestUser?: { id: string; name: string; createdAt: Date } | null;
    latestAvatar?: { id: string; name: string; createdAt: Date } | null;
    latestStory?: { id: string; title: string; createdAt: Date } | null;
  };
}

// Returns aggregate admin statistics for users, avatars, and stories.
export const getStats = api<void, AdminStats>(
  { expose: true, method: "GET", path: "/admin/stats", auth: true },
  async () => {
    ensureAdmin();

    const usersCountRow = await userDB.rawQueryRow<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM users"
    );
    const avatarsCountRow = await avatarDB.rawQueryRow<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM avatars"
    );
    const storiesCountRow = await storyDB.rawQueryRow<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM stories"
    );

    const subs = await userDB.rawQueryAll<{ subscription: string; cnt: string }>(
      "SELECT subscription, COUNT(*)::text as cnt FROM users GROUP BY subscription"
    );
    const subsMap = { starter: 0, familie: 0, premium: 0 } as Record<string, number>;
    for (const r of subs) {
      if (r.subscription in subsMap) subsMap[r.subscription] = parseInt(r.cnt, 10);
    }

    const statuses = await storyDB.rawQueryAll<{ status: string; cnt: string }>(
      "SELECT status, COUNT(*)::text as cnt FROM stories GROUP BY status"
    );
    const statusMap = { generating: 0, complete: 0, error: 0 } as Record<string, number>;
    for (const r of statuses) {
      if (r.status in statusMap) statusMap[r.status] = parseInt(r.cnt, 10);
    }

    const latestUser = await userDB.queryRow<{ id: string; name: string; createdAt: Date }>`
      SELECT id, name, created_at as "createdAt" FROM users ORDER BY created_at DESC LIMIT 1
    `;
    const latestAvatar = await avatarDB.queryRow<{ id: string; name: string; createdAt: Date }>`
      SELECT id, name, created_at as "createdAt" FROM avatars ORDER BY created_at DESC LIMIT 1
    `;
    const latestStory = await storyDB.queryRow<{ id: string; title: string; createdAt: Date }>`
      SELECT id, title, created_at as "createdAt" FROM stories ORDER BY created_at DESC LIMIT 1
    `;

    return {
      totals: {
        users: parseInt(usersCountRow?.count ?? "0", 10),
        avatars: parseInt(avatarsCountRow?.count ?? "0", 10),
        stories: parseInt(storiesCountRow?.count ?? "0", 10),
      },
      subscriptions: {
        starter: subsMap.starter,
        familie: subsMap.familie,
        premium: subsMap.premium,
      },
      storiesByStatus: {
        generating: statusMap.generating,
        complete: statusMap.complete,
        error: statusMap.error,
      },
      recentActivity: {
        latestUser: latestUser ?? null,
        latestAvatar: latestAvatar ?? null,
        latestStory: latestStory ?? null,
      },
    };
  }
);
