/**
 * Re-checks every picture attempt of a finished Figurenabenteuer (character-series-v1) story with other vision models,
 * using the production review (SERIES_IMAGE_REVIEW, readSeriesQa, seriesPicturePasses/Usable) and the production
 * identity sheet built from local portraits. Optional human labels ({"p0-1":{"label":"print|reject|gray"}}) turn the
 * run into a scored benchmark: good pictures kept, bad pictures stopped, verdicts that change between runs.
 *
 * Production story (the log has no text, so the chapters come from {"chapters":[{"title","paragraphs":[…]}]}):
 *   cd backend; encore exec -- bun --env-file=../.env.local ../scripts/image-bench/series-recheck.ts \
 *     --log <logs.json> --text <story.json> --portraits <id>=<file>,… --images <dir> [--labels <labels.json>]
 * Pilot run of scripts/character-series/pilot-v2.ts (its saved review requests are replayed as they were):
 *     --pilot <out>/episode-1 --set <name> --portraits <id>=<file>,… --images <dir> [--labels <labels.json>]
 * Common: [--models anthropic/claude-haiku-5.5,openai/gpt-6.1-terra:think] [--runs 2] [--only p1-3,p4-1] [--out <jsonl>] [--flex]
 *
 * A model suffixed with ":think" runs in the critic role (Claude then thinks at effort low; production's support role
 * switches Claude's thinking off). Pictures missing in --images are downloaded (bucket keys through the production proxy).
 */
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import sharp from "sharp";
import { createOpenRouterStorybookLlm } from "../../backend/story/storybook/llm-openrouter";
import { readSeriesQa, seriesPicturePasses, seriesPictureSource, seriesPictureUsable, SERIES_IMAGE_REVIEW } from "../../backend/story/character-series/quality";
import { seriesPaintableMoment, SERIES_STYLE_REFERENCE } from "../../backend/story/character-series/pictures";
import { buildImageSlots, pagesFor } from "../../backend/story/storybook/book/illustrations";
import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from "../../backend/story/image-reference-sprite";
import type { VisualEntity } from "../../backend/story/storybook/illustration-stage";
import type { IllustrationShot } from "../../backend/story/storybook/types";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const cwd = process.env.INIT_CWD || process.cwd();
const path = (p: string) => resolve(cwd, p);
const models = (arg("models") || "anthropic/claude-haiku-5.5").split(",");
const runs = Number(arg("runs") || 1);
const only = arg("only")?.split(",");
const imagesDir = path(arg("images") || "Logs/image-bench/series-recheck");
const out = path(arg("out") || "Logs/image-bench/series-recheck.jsonl");
const proxy = "https://backend-2-production-3de1.up.railway.app/story/image?key=";
const labels = arg("labels") ? JSON.parse(await readFile(path(arg("labels")!), "utf8")) as Record<string, { label: string }> : {};
const portraits = new Map((arg("portraits") || "").split(",").filter(Boolean).map(pair => pair.split("=") as [string, string]));
const flex = process.argv.includes("--flex");
const forbidden = new Map((arg("forbidden") || "").split(",").filter(Boolean).map(pair => pair.split("=") as [string, string]));

/** One review as production sent it: the picture, the figures on the identity sheet (in slot order) and the user text. */
interface Case { id: string; url: string; drawn: VisualEntity[]; user: string; cover: boolean }
const ATTEMPTS = new Set(["series-scene", "targeted-scene-edit", "same-scene-repair", "simplified-scene-repair"]);

async function productionCases(): Promise<Case[]> {
  const logs = JSON.parse(await readFile(path(arg("log")!), "utf8")).logs as any[];
  const stage = (name: string) => logs.find(entry => entry.metadata?.stage === name)?.response;
  const direction = stage("illustration-plan").illustrations;
  const complete = stage("complete");
  const rejected = stage("series-images-rejected")?.outcomes as any[] | undefined;
  const story = JSON.parse(await readFile(path(arg("text")!), "utf8")) as { chapters: Array<{ title: string; paragraphs: string[] }> };
  // Reading segments exactly as the director saw them: two per chapter, cut at paragraph borders.
  const slots = buildImageSlots(story.chapters.map((c, i) => ({ order: i + 1, content: c.paragraphs.join("\n\n") })), { chapters: [] }, 2);
  const pageTexts = Object.fromEntries(pagesFor(slots).map(p => [p.order, p.content]));
  // Looks as production sent them: the identity-sheet line of the first prompt that names the figure.
  const looks = new Map<string, string>();
  for (const prompt of (rejected || []).map(o => o.prompt).filter(Boolean) as string[]) {
    for (const m of prompt.matchAll(/is ONLY ([^:]+): (.*?)(?=; slot \d|\. Keep each face)/g)) if (!looks.has(m[1])) looks.set(m[1], m[2]);
  }
  const shots: any[] = [direction.cover, ...direction.pages];
  // actionKey is "<name> <action>; <result>", so every figure that acts somewhere is named.
  const nameOf = (id: string) => {
    for (const shot of shots) if (shot.visualBeat?.actorId === id) return String(shot.actionKey).slice(0, String(shot.actionKey).indexOf(shot.visualBeat.action)).trim();
    return id;
  };
  const entity = (id: string): VisualEntity => ({ id, name: nameOf(id), kind: "character", role: "cast", species: "human", isHuman: true, appearance: looks.get(nameOf(id)) || nameOf(id), forbidden: forbidden.has(id) ? [forbidden.get(id)!] : [] });
  /** The shot an attempt was judged against: a simplified rescue redirects to a solo moment (recovered from its prompt). */
  const shotFor = (outcome: any, attempt: any): IllustrationShot => {
    const shot = shots.find(s => s.page === outcome.page);
    if (attempt.kind !== "simplified-scene-repair") return shot;
    const prompt = rejected?.find(x => x.page === outcome.page)?.prompt as string;
    const actor = prompt.match(/<seriesfigure1> is ([^,]+), taken only/)?.[1] || nameOf(shot.visualBeat.actorId);
    const actorId = shot.onStage.find((id: string) => nameOf(id) === actor) || shot.visualBeat.actorId;
    const fact = prompt.match(/Freeze the physical instant: <seriesfigure1> (.*?)\. (?:WIDE|MEDIUM|CLOSE) framing/)?.[1] || "";
    const [action, result] = fact.split("; ");
    return { ...shot, onStage: [actorId], scene: prompt.split("\n")[0].replaceAll("<seriesfigure1>", actor), visualBeat: { actorId, action, result: result || action, framing: "close" } };
  };
  const cases: Case[] = [];
  for (const outcome of complete.imageQa as any[]) {
    for (const [index, attempt] of (outcome.history || []).entries()) {
      if (!attempt.url || !ATTEMPTS.has(attempt.kind)) continue;
      const shot = shotFor(outcome, attempt);
      const drawn = shot.onStage.map(entity);
      const moment = seriesPaintableMoment(shot);
      const user = `${shot.page === 0 ? "COVER: judge the selected character-in-world composition. No chapter action is compulsory." : "CHAPTER PICTURE: judge this selected moment, allowing harmless staging differences."}\nEXPECTED IDENTITIES:\n${drawn.map(e => `${e.id}: ${e.name}; ${e.appearance}; forbidden features: ${e.forbidden.join(", ") || "none specified"}`).join("\n")}\nPROPOSED CAPTION:\n${moment.scene}\nPRIMARY STORY FACT: ${moment.fact}\n${shot.page === 0 ? "" : seriesPictureSource(pageTexts[shot.page] || "", shot.paragraph, (shot as any).storyQuote)}\nAttachment 2 is the identity sheet, left to right: ${drawn.map((e, i) => `slot ${i + 1} = ${e.id} (${e.name})`).join("; ")}. The last attachment is the public style example.`;
      cases.push({ id: `p${outcome.page}-${index + 1}`, url: attempt.url, drawn, user, cover: shot.page === 0 });
    }
  }
  return cases;
}

async function pilotCases(dir: string, set: string): Promise<Case[]> {
  const result = JSON.parse(await readFile(join(dir, "result.json"), "utf8"));
  const outcomes = [result.pictures.cover, ...result.pictures.pages.map((entry: [number, any]) => entry[1])];
  const cases: Case[] = [];
  for (const file of (await readdir(dir)).filter(f => /series-image-qa-\d+-\d+\.request\.json$/.test(f))) {
    const [, page, attempt] = file.match(/series-image-qa-(\d+)-(\d+)\.request\.json$/)!.map(Number);
    const request = JSON.parse(await readFile(join(dir, file), "utf8"));
    const url = (outcomes.find(o => o.page === page)?.history || []).filter((h: any) => ATTEMPTS.has(h.kind))[attempt - 1]?.url;
    if (!url) continue;
    const identities = String(request.user).split("EXPECTED IDENTITIES:\n")[1].split("\nPROPOSED CAPTION")[0].split("\n");
    const looks = new Map(identities.map(line => { const [id, rest] = [line.slice(0, line.indexOf(": ")), line.slice(line.indexOf(": ") + 2)]; return [id, rest.split("; ")] as const; }));
    const order = [...String(request.user).matchAll(/slot \d+ = ([^ ]+) \(/g)].map(m => m[1]);
    const drawn = order.map(id => ({ id, name: looks.get(id)?.[0] || id, kind: "character", role: "cast", species: "human", isHuman: true, appearance: looks.get(id)?.[1] || "", forbidden: [] } as VisualEntity));
    cases.push({ id: `${set}:p${page}-${attempt}`, url, drawn, user: request.user, cover: page === 0 });
  }
  return cases.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

const sheets = new Map<string, string>();
const sheetFor = async (figures: VisualEntity[]) => {
  const key = figures.map(f => f.id).join(",");
  if (!sheets.has(key)) {
    if (!figures.every(f => portraits.has(f.id))) throw new Error(`Portrait missing for ${figures.map(f => f.id).join(", ")}`);
    const buffers = await Promise.all(figures.map(async f => {
      const source = portraits.get(f.id)!;
      return /^https?:/.test(source) ? Buffer.from(await (await fetch(source)).arrayBuffer()) : readFile(path(source));
    }));
    const png = figures.length === 1 ? await renderSingleReference(buffers[0]) : await renderIdentitySprite(buffers);
    sheets.set(key, `data:image/jpeg;base64,${(await encodeReferenceSprite(png)).toString("base64")}`);
  }
  return sheets.get(key)!;
};
const picture = async (id: string, url: string) => {
  await mkdir(imagesDir, { recursive: true });
  const file = join(imagesDir, `${id.replace(/[:/]/g, "_")}.webp`);
  if (!existsSync(file)) {
    const source = /^bucket:\/\//.test(url) ? `${proxy}${encodeURIComponent(url.replace(/^bucket:\/\/[^/]+\//, ""))}` : url;
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  return `data:image/jpeg;base64,${(await sharp(await readFile(file)).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`;
};

const cases = arg("pilot") ? await pilotCases(path(arg("pilot")!), arg("set") || basename(dirname(path(arg("pilot")!)))) : await productionCases();
const llm = createOpenRouterStorybookLlm();
const rows: any[] = [];
for (const item of cases) {
  if (only && !only.includes(item.id)) continue;
  const image = await picture(item.id, item.url);
  const sheet = await sheetFor(item.drawn);
  for (const spec of models) {
    const [model, mode] = spec.split(":");
    for (let run = 1; run <= runs; run++) {
      const started = Date.now();
      let row: any;
      try {
        const reply = await llm({ stage: "series-recheck", role: mode === "think" ? "critic" : "support", model, fallbackModel: model, effort: "low", json: true, maxTokens: /claude|gemini|deepseek/.test(model) ? 4000 : 2500, timeoutMs: 120_000, ...(flex ? { serviceTier: "flex" as const } : {}), system: SERIES_IMAGE_REVIEW, user: item.user, imageInputs: [image, sheet, SERIES_STYLE_REFERENCE] });
        const qa = readSeriesQa(reply.text, item.drawn);
        const pass = seriesPicturePasses(qa, item.cover);
        const usable = !pass && seriesPictureUsable(qa);
        row = { id: item.id, spec, run, status: !qa ? "unreadable" : pass ? "passed" : usable ? "flawed" : "failed", accept: pass || usable, identity: qa?.identityById, sceneMatch: qa?.sceneMatch, storyConsistent: qa?.storyConsistent, actionClear: qa?.primaryActionClear, defects: qa?.defects.map(d => `${d.kind}${d.blocksAction ? "!" : ""}: ${d.detail}`), costUSD: reply.usage.costUSD, ms: Date.now() - started };
      } catch (error) {
        row = { id: item.id, spec, run, status: "error", accept: false, error: String((error as Error).message).slice(0, 200), ms: Date.now() - started };
      }
      row.label = labels[item.id]?.label;
      rows.push(row);
      await mkdir(dirname(out), { recursive: true });
      await appendFile(out, `${JSON.stringify(row)}\n`);
      console.log(`${item.id.padEnd(18)} ${spec.padEnd(32)} #${run} ${String(row.status).padEnd(10)} label=${String(row.label || "-").padEnd(6)} ${(row.defects || [row.error || ""]).join(" | ").slice(0, 140)}`);
    }
  }
}

// Score per model: good pictures kept, bad pictures stopped, verdicts that flip between runs, cost.
console.log("\nmodel                            keep-good  stop-bad  gray-kept  flips  unreadable  ¢/check   s/check");
for (const spec of models) {
  const mine = rows.filter(r => r.spec === spec);
  const share = (label: string, accept: boolean) => {
    const set = mine.filter(r => r.label === label);
    return `${set.filter(r => r.accept === accept).length}/${set.length}`;
  };
  const ids = [...new Set(mine.map(r => r.id))];
  const flips = ids.filter(id => new Set(mine.filter(r => r.id === id).map(r => r.accept)).size > 1).length;
  const cost = mine.reduce((sum, r) => sum + (r.costUSD || 0), 0) / Math.max(1, mine.length) * 100;
  const secs = mine.reduce((sum, r) => sum + r.ms, 0) / Math.max(1, mine.length) / 1000;
  console.log(`${spec.padEnd(32)} ${share("print", true).padEnd(10)} ${share("reject", false).padEnd(9)} ${share("gray", true).padEnd(10)} ${String(flips).padEnd(6)} ${String(mine.filter(r => r.status === "unreadable" || r.status === "error").length).padEnd(11)} ${cost.toFixed(3).padEnd(9)} ${secs.toFixed(1)}`);
}
