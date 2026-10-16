/**
 * Local end-to-end test of the chapter-book job against the local Encore database.
 *
 *   cd backend
 *   $env:OPENROUTER_API_KEY = "…"; $env:TALEA_BOOK_IMAGES = "off"   (or "fake": placeholder pictures, tests text-first + pictures-in-parallel)
 *   encore exec -- npx tsx scripts/book-job-smoke.ts [chapters] [form]
 *
 * Inserts a story row like /story/generate does, enqueues the job and follows it
 * step by step (plan → batches → finish) until it is done, then prints what the
 * reader and the admin would see. Uses the test heroes from Logs/.
 */

import { readFileSync } from "node:fs";
import { storyDB } from "../story/db";
import { bookJobStatus, enqueueChapterBook } from "../story/book-generation";

const chapters = Number(process.argv[2]) || 8;
const form = process.argv[3] || "funny";
const heroes = JSON.parse(readFileSync("../Logs/test-heroes-alexander-adrian.json", "utf8"));
const storyId = crypto.randomUUID();
const userId = "smoke-user";
const config: any = {
  avatarIds: heroes.map((hero: any) => hero.id),
  genre: "magic", setting: "varied", ageGroup: "6-8", length: "long", complexity: "medium", language: "de",
  emotionalFlavors: ["lachfreude"], humorLevel: 2, suspenseLevel: 1, requireHappyEnd: true,
  aiProvider: "openrouter", openRouterModel: "openai/gpt-6.1-sol",
  storybookMode: true, storybookEngine: "chapter-book-v1", bookChapters: chapters, bookImagesPerChapter: 1, experienceForm: form,
};

await storyDB.exec`
  INSERT INTO stories (id, user_id, title, description, config, status, created_at, updated_at)
  VALUES (${storyId}, ${userId}, ${"Wird generiert..."}, ${"Deine Geschichte wird erstellt..."}, ${JSON.stringify(config)}, 'generating', NOW(), NOW())
`;
await enqueueChapterBook({ storyId, userId, config, heroes, blockedTerms: [] });
console.log(`story ${storyId}: ${chapters} chapters, form ${form}`);

const started = Date.now();
for (;;) {
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  const job = await bookJobStatus(storyId);
  const story = await storyDB.queryRow<{ status: string; title: string }>`SELECT status, title FROM stories WHERE id = ${storyId}`;
  const count = await storyDB.queryRow<{ n: number; pictured: number }>`
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE jsonb_typeof(images) = 'array' AND jsonb_array_length(images) > 0)::int AS pictured FROM chapters WHERE story_id = ${storyId}
  `;
  console.log(`${Math.round((Date.now() - started) / 1000)}s job=${job?.status}/${job?.stage} attempts=${job?.attempts} story=${story?.status} „${story?.title}“ chapters=${count?.n} with pictures=${count?.pictured}${job?.error ? ` error=${job.error}` : ""}`);
  if (job?.status === "done" || job?.status === "failed") break;
}

const rows = await storyDB.queryAll<{ chapter_order: number; title: string; chars: number; images: unknown }>`
  SELECT chapter_order, title, length(content) AS chars, images FROM chapters WHERE story_id = ${storyId} ORDER BY chapter_order
`;
for (const row of rows) console.log(`  ${row.chapter_order}. ${row.title} (${row.chars} Zeichen) images=${JSON.stringify(row.images)}`);
const story = await storyDB.queryRow<{ metadata: any; series_id: string | null; series_volume: number | null; avatar_developments: string | null; cover_image_url: string | null }>`
  SELECT metadata, series_id, series_volume, avatar_developments, cover_image_url FROM stories WHERE id = ${storyId}
`;
const metadata = typeof story?.metadata === "string" ? JSON.parse(story.metadata) : story?.metadata || {};
console.log("book:", JSON.stringify({ ...metadata.book, recaps: metadata.book?.recaps?.length }));
console.log("totalCost:", JSON.stringify(metadata.totalCost), "stages:", metadata.adminGenerationMetrics?.stages?.length, "cached input:", metadata.adminGenerationMetrics?.tokens?.cachedInput);
console.log("bookAdmin keys:", Object.keys(metadata.bookAdmin || {}).join(", "), "| curve:", JSON.stringify((metadata.bookAdmin?.curve || []).map((point: any) => `${point.chapter}:${point.suspense}/${point.humor}${point.rewritten ? "R" : ""}`)));
console.log("series:", story?.series_id, "volume", story?.series_volume, "| developments:", story?.avatar_developments?.slice(0, 300));
if (story?.series_id) {
  const series = await storyDB.queryRow<{ memory: any }>`SELECT memory FROM story_series WHERE id = ${story.series_id}`;
  console.log("series memory:", JSON.stringify(series?.memory).slice(0, 800));
}
process.exit(0);
