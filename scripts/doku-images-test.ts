/**
 * Renders the illustrations of a saved doku-live-test run with the production
 * image logic (doku-images.ts: scrubbed scene, wordless style, vision check for
 * writing, one redraw) and writes a reader fixture.
 *
 *   bun --env-file=.env.local run scripts/doku-images-test.ts Logs/doku-live/<run>/result.json [--model runware:400@4] [--check-only]
 *
 * --check-only runs only the writing check on the existing cover.jpg / section-N.jpg.
 *
 * Output next to result.json: cover.jpg, section-N.jpg (rejected renders as *-rejected-N.jpg)
 * and doku.fixture.json (Doku shape with the Runware image URLs, for the reader preview).
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { toDokuContent } from "../backend/doku/doku-prompt";
import {
  DOKU_IMAGE_QA_MODEL,
  parseTextCheck,
  renderTextFreeImage,
  TEXT_CHECK_SYSTEM,
  TEXT_CHECK_USER,
} from "../backend/doku/doku-images";

const args = process.argv.slice(2);
const [resultPath] = args.filter((arg) => !arg.startsWith("--") && !/^runware:/.test(arg));
const modelAt = args.indexOf("--model");
const model = modelAt >= 0 ? args[modelAt + 1] : "runware:400@4";
const runwareKey = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey || "";
const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey || "";
if (!resultPath) throw new Error("usage: doku-images-test.ts <result.json>");
if (!runwareKey || !openRouterKey) throw new Error("RUNWARE_API_KEY and OPENROUTER_API_KEY are needed — no provider called.");

const saved = JSON.parse(await readFile(resultPath, "utf8"));
const doku = saved.doku;
const outDir = dirname(resultPath);
let spent = 0;

async function checkWriting(bytes: Buffer, label: string): Promise<boolean | undefined> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterKey}`, "X-Title": "Talea doku image check" },
    body: JSON.stringify({
      model: DOKU_IMAGE_QA_MODEL,
      messages: [
        { role: "system", content: TEXT_CHECK_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: TEXT_CHECK_USER },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${bytes.toString("base64")}` } },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: "json_object" },
      reasoning: { effort: "low", exclude: true },
      usage: { include: true },
    }),
  });
  const data: any = await response.json();
  spent += Number(data?.usage?.cost ?? 0);
  const content = String(data?.choices?.[0]?.message?.content || "");
  const verdict = parseTextCheck(content);
  console.log(`  check ${label}: ${verdict === true ? "WRITING" : verdict === false ? "clean" : "?"} ${content.replace(/\s+/g, " ").slice(0, 160)}`);
  return verdict;
}

if (args.includes("--check-only")) {
  const files = ["cover.jpg", ...doku.sections.map((_: unknown, i: number) => `section-${i + 1}.jpg`)];
  for (const file of files) {
    if (existsSync(join(outDir, file))) await checkWriting(await readFile(join(outDir, file)), file);
  }
  console.log(`check cost $${spent.toFixed(4)}`);
  process.exit(0);
}

async function renderFile(prompt: string): Promise<{ url: string; bytes: Buffer } | undefined> {
  const response = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${runwareKey}` },
    body: JSON.stringify([
      {
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        model,
        numberResults: 1,
        outputType: ["URL"],
        outputFormat: "JPEG",
        width: 1024,
        height: 1024,
        steps: 4,
        CFGScale: 4,
        includeCost: true,
        positivePrompt: prompt,
      },
    ]),
  });
  const data: any = await response.json();
  const url = data?.data?.[0]?.imageURL;
  if (!url) {
    console.warn("no image", JSON.stringify(data).slice(0, 300));
    return undefined;
  }
  spent += Number(data.data[0].cost ?? 0);
  return { url, bytes: Buffer.from(await (await fetch(url)).arrayBuffer()) };
}

async function renderJob(scene: string, file: string): Promise<string | undefined> {
  const renders = new Map<string, Buffer>();
  const result = await renderTextFreeImage(scene, {
    render: async (prompt, attempt) => {
      const rendered = await renderFile(prompt);
      if (!rendered) return undefined;
      renders.set(rendered.url, rendered.bytes);
      if (attempt === 0) console.log(`${file} prompt: ${prompt.slice(0, 220)}…`);
      return rendered.url;
    },
    showsWriting: (url) => checkWriting(renders.get(url)!, `${file} (${renders.size}. Versuch)`),
  });
  let rejectedNo = 0;
  for (const [url, bytes] of renders) {
    const target = url === result.url ? file : file.replace(".jpg", `-rejected-${++rejectedNo}.jpg`);
    await writeFile(join(outDir, target), bytes);
  }
  console.log(`${file}: ${result.url ? "kept" : "DROPPED"} after ${result.attempts} render(s), ${result.rejected} rejected`);
  return result.url;
}

const sections = doku.sections as any[];
const jobs: Array<{ file: string; scene: string; apply: (url: string) => void }> = [
  { file: "cover.jpg", scene: doku.coverImagePrompt || doku.title, apply: (url) => (doku.coverImageUrl = url) },
  ...sections.map((section, index) => ({
    file: `section-${index + 1}.jpg`,
    scene: section.sectionImagePrompt || section.title,
    apply: (url: string) => (section.imageUrl = url),
  })),
];
for (let i = 0; i < jobs.length; i += 2) {
  const batch = jobs.slice(i, i + 2);
  const urls = await Promise.all(batch.map((job) => renderJob(job.scene, job.file)));
  urls.forEach((url, index) => url && batch[index].apply(url));
}
doku.coverImageUrl ??= sections.find((section) => section.imageUrl)?.imageUrl;

const fixture = {
  id: "preview-doku",
  userId: "u1",
  title: doku.title,
  topic: saved.config.topic,
  summary: doku.summary,
  content: toDokuContent(doku, sections),
  coverImageUrl: doku.coverImageUrl,
  isPublic: false,
  status: "complete",
  metadata: { model: saved.model, configSnapshot: saved.config },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
await writeFile(join(outDir, "doku.fixture.json"), JSON.stringify(fixture, null, 2));
console.log(`fixture: ${join(outDir, "doku.fixture.json")} · total $${spent.toFixed(4)}`);
