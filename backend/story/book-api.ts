import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { ensureAdmin } from "../admin/authz";
import { storyDB } from "./db";
import { bookJobStatus, requeueChapterBook } from "./book-generation";

interface BookJobStatusResponse {
  status: string;
  stage: string;
  error?: string;
  attempts: number;
}

/** Where the chapter book job stands (owner or admin). */
export const bookStatus = api<{ id: string }, BookJobStatusResponse>(
  { expose: true, method: "GET", path: "/story/book/:id/status", auth: true },
  async ({ id }) => {
    const auth = getAuthData()!;
    const story = await storyDB.queryRow<{ user_id: string }>`SELECT user_id FROM stories WHERE id = ${id}`;
    if (!story) throw APIError.notFound("Story not found");
    if (story.user_id !== auth.userID && auth.role !== "admin") throw APIError.permissionDenied("Not your story");
    const job = await bookJobStatus(id);
    if (!job) throw APIError.notFound("No chapter book job for this story");
    return { status: job.status, stage: job.stage, error: auth.role === "admin" ? job.error || undefined : undefined, attempts: job.attempts };
  }
);

/** Admin: continue a stalled or failed chapter book after its last published chapter. */
export const bookRequeue = api<{ id: string }, { requeued: boolean }>(
  { expose: true, method: "POST", path: "/story/book/:id/requeue", auth: true },
  async ({ id }) => {
    ensureAdmin();
    return { requeued: await requeueChapterBook(id) };
  }
);
