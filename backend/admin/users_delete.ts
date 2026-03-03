import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ensureAdmin } from "./authz";
import { cancelUserBillingAtPeriodEnd } from "../helpers/billing";
import { cleanupUserContent } from "../helpers/content-cleanup";

const userDB = SQLDatabase.named("user");

interface DeleteUserParams {
  id: string;
}

interface DeleteUserResponse {
  success: boolean;
  subscriptionCancellation: {
    attempted: boolean;
    scheduled: boolean;
    source: "sdk" | "rest" | "none";
    note?: string;
  };
  removed: {
    avatars: number;
    stories: number;
    dokus: number;
    audioDokus: number;
    generatedAudioLibrary: number;
    profiles: number;
    user: boolean;
  };
}

// Deletes a user, removes all created content, and cancels paid subscriptions at period end.
export const deleteUser = api<DeleteUserParams, DeleteUserResponse>(
  { expose: true, method: "DELETE", path: "/admin/users/:id", auth: true },
  async ({ id }) => {
    ensureAdmin();

    const existing = await userDB.queryRow<{ id: string; subscription: "free" | "starter" | "familie" | "premium" }>`
      SELECT id, subscription FROM users WHERE id = ${id}
    `;
    if (!existing) {
      throw APIError.notFound("user not found");
    }

    const cancellation =
      existing.subscription !== "free"
        ? await cancelUserBillingAtPeriodEnd(id)
        : {
            attempted: false,
            scheduled: true,
            activeItems: 0,
            canceledItems: 0,
            source: "none" as const,
            note: "free_plan_no_cancellation_needed",
          };

    if (!cancellation.scheduled) {
      throw APIError.failedPrecondition(
        `Subscription cancellation could not be scheduled (source=${cancellation.source}, note=${cancellation.note ?? "n/a"}).`
      );
    }

    const removed = await cleanupUserContent(id);

    return {
      success: true,
      subscriptionCancellation: {
        attempted: cancellation.attempted,
        scheduled: cancellation.scheduled,
        source: cancellation.source,
        note: cancellation.note,
      },
      removed: {
        avatars: removed.avatarsDeleted,
        stories: removed.storiesDeleted,
        dokus: removed.dokusDeleted,
        audioDokus: removed.audioDokusDeleted,
        generatedAudioLibrary: removed.generatedAudioLibraryDeleted,
        profiles: removed.profilesDeleted,
        user: removed.userDeleted,
      },
    };
  }
);
