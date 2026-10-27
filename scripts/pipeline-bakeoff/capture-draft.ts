/** Offline only: publish the already saved author response, never invoke a model. */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readOneShot } from "../../backend/story/episode/engine";
const dir = "Logs/pipeline-bakeoff/2026-10-26/unified";
const saved = [];
for (const file of await readdir(dir)) if (file.endsWith(".saved.json")) saved.push({ file, ...JSON.parse(await readFile(join(dir, file), "utf8")) });
const author = saved.find(r => r.request.stage === "episode-oneshot" && r.response.text?.trim());
if (!author) throw new Error("No completed author response to preserve.");
const parsed = readOneShot(author.response.text);
const cold = JSON.parse(await readFile(join(dir, "unified-cold-read.json"), "utf8"));
const words = parsed.story.chapters.map(c => c.text.trim().split(/\s+/).length);
await writeFile(join(dir, "draft.md"), `# ${parsed.story.title}\n\n**Unfertiger Pipeline-Kandidat.** Gespeicherter erster Autorenentwurf; keine neue Inferenz, keine abgeschlossene Überarbeitung und keine Schlussbewertung.\n\n${parsed.story.description}\n\n${parsed.story.chapters.map(c => `## ${c.title}\n\n${c.text}`).join("\n\n")}\n`);
await writeFile(join(dir, "draft.json"), JSON.stringify({ status: "draft-only", title: parsed.story.title, words, sourceResponse: author.file,
  responseSHA256: createHash("sha256").update(author.response.text).digest("hex"), requestSHA256: createHash("sha256").update(JSON.stringify(author.request)).digest("hex"),
  originalRequest: author.request, coldRead: cold, images: 0, newModelCalls: 0, interruption: "The semantic repair received HTTP 429. Further inference stopped at the user's credit constraint." }, null, 2));
console.log(JSON.stringify({ title: parsed.story.title, words, newModelCalls: 0 }));
