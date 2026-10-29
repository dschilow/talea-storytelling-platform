/**
 * Re-checks every picture attempt of a finished Figurenabenteuer (character-series-v1) story with other vision models,
 * using the production review (SERIES_IMAGE_REVIEW, readSeriesQa, seriesPicturePasses/Usable) and the production
 * identity sheet built from local portraits. The story log has no text, so the chapters come from a JSON file
 * ({"chapters":[{"title","paragraphs":[…]}]}). Optional human labels ({"p0-1":{"label":"print|reject|gray"}}) turn the
 * run into a scored benchmark: good pictures kept, bad pictures stopped, verdicts that change between runs.
 *
 *   cd backend; encore exec -- bun --env-file=../.env.local ../scripts/image-bench/series-recheck.ts \
 *     --log <logs.json> --text <story.json> --portraits <id>=<file>,… --images <dir> [--labels <labels.json>] \
 *     [--models anthropic/claude-haiku-5.5,openai/gpt-6.1-terra:think] [--runs 2] [--only p1-3,p4-1]
 *
 * A model suffixed with ":think" runs in the critic role (Claude then thinks at effort low; production's support role
 * switches Claude's thinking off). Pictures missing in --images are downloaded through the production image proxy.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
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

const logs = JSON.parse(await readFile(path(arg("log")!), "utf8")).logs as any[];
const stage = (name: string) => logs.find(entry => entry.metadata?.stage === name)?.response;
const direction = stage("illustration-plan").illustrations;
const complete = stage("complete");
const story = JSON.parse(await readFile(path(arg("text")!), "utf8")) as { chapters: Array<{ title: string; paragraphs: string[] }> };
const labels = arg("labels") ? JSON.parse(await readFile(path(arg("labels")!), "utf8")) as Record<string, { label: string }> : {};
const portraits = new Map((arg("portraits") || "").split(",").filter(Boolean).map(pair => pair.split("=") as [string, string]));
const forbidden = new Map((arg("forbidden") || "").split(",").filter(Boolean).map(pair => pair.split("=") as [string, string]));

// Reading segments exactly as the director saw them: two per chapter, cut at paragraph borders.
const slots = buildImageSlots(story.chapters.map((c, i) => ({ order: i + 1, content: c.paragraphs.join("\n\n") })), { chapters: [] }, 2);
const pageTexts = Object.fromEntries(pagesFor(slots).map(p => [p.order, p.content]));

// Looks as production sent them: the identity-sheet line of the first prompt that names the figure.
const prompts = (complete.imageQa as any[]).map(o => stage("series-images-rejected")?.outcomes?.find((x: any) => x.page === o.page)?.prompt).filter(Boolean) as string[];
const looks = new Map<string, string>();
for (const prompt of prompts) {
  for (const m of prompt.matchAll(/is ONLY ([^:]+): (.*?)(?=; slot \d|\. Keep each face)/g)) if (!looks.has(m[1])) looks.set(m[1], m[2]);
}
const shots: any[] = [direction.cover, ...direction.pages];
// actionKey is "<name> <action>; <result>", so every figure that acts somewhere is named.
const nameOf = (id: string) => {
  for (const shot of shots) {
    const caption = String(shot.actionKey || "");
    if (shot.visualBeat?.actorId === id) return caption.slice(0, caption.indexOf(shot.visualBeat.action)).trim();
  }
  return id;
};
const entity = (id: string): VisualEntity => {
  const name = nameOf(id);
  return { id, name, kind: "character", role: "cast", species: "human", isHuman: true, appearance: looks.get(name) || name, forbidden: forbidden.has(id) ? [forbidden.get(id)!] : [] };
};

const sheets = new Map<string, string>();
const sheetFor = async (figures: VisualEntity[]) => {
  const key = figures.map(f => f.id).join(",");
  if (!sheets.has(key)) {
    if (!figures.every(f => portraits.has(f.id))) throw new Error(`Portrait missing for ${figures.map(f => f.name).join(", ")}`);
    const buffers = await Promise.all(figures.map(f => readFile(path(portraits.get(f.id)!))));
    const png = figures.length === 1 ? await renderSingleReference(buffers[0]) : await renderIdentitySprite(buffers);
    sheets.set(key, `data:image/jpeg;base64,${(await encodeReferenceSprite(png)).toString("base64")}`);
  }
  return sheets.get(key)!;
};

const picture = async (id: string, url: string) => {
  await mkdir(imagesDir, { recursive: true });
  const file = join(imagesDir, `${id}.webp`);
  if (!existsSync(file)) {
    const key = String(url).replace(/^bucket:\/\/[^/]+\//, "");
    const response = await fetch(`${proxy}${encodeURIComponent(key)}`);
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  return `data:image/jpeg;base64,${(await sharp(await readFile(file)).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`;
};

/** The shot a given attempt was judged against: a simplified rescue redirects to a solo moment (recovered from its prompt). */
const shotFor = (outcome: any, attempt: any): IllustrationShot => {
  const shot = shots.find(s => s.page === outcome.page);
  if (attempt.kind !== "simplified-scene-repair") return shot;
  const prompt = stage("series-images-rejected")?.outcomes?.find((x: any) => x.page === outcome.page)?.prompt as string;
  const actor = prompt.match(/<seriesfigure1> is ([^,]+), taken only/)?.[1] || nameOf(shot.visualBeat.actorId);
  const actorId = shot.onStage.find((id: string) => nameOf(id) === actor) || shot.visualBeat.actorId;
  const scene = prompt.split("\n")[0].replaceAll("<seriesfigure1>", actor);
  const fact = prompt.match(/Freeze the physical instant: <seriesfigure1> (.*?)\. (?:WIDE|MEDIUM|CLOSE) framing/)?.[1] || "";
  const [action, result] = fact.split("; ");
  return { ...shot, onStage: [actorId], scene, visualBeat: { actorId, action, result: result || action, framing: "close" } };
};

const llm = createOpenRouterStorybookLlm();
const rows: any[] = [];
for (const outcome of complete.imageQa as any[]) {
  for (const [index, attempt] of (outcome.history || []).entries()) {
    const id = `p${outcome.page}-${index + 1}`;
    if (!attempt.url || (only && !only.includes(id))) continue;
    const shot = shotFor(outcome, attempt);
    const drawn = shot.onStage.map(entity);
    const moment = seriesPaintableMoment(shot);
    const image = await picture(id, attempt.url);
    const sheet = await sheetFor(drawn);
    const reviewUser = `${shot.page === 0 ? "COVER: judge the selected character-in-world composition. No chapter action is compulsory." : "CHAPTER PICTURE: judge this selected moment, allowing harmless staging differences."}\nEXPECTED IDENTITIES:\n${drawn.map(e => `${e.id}: ${e.name}; ${e.appearance}; forbidden features: ${e.forbidden.join(", ") || "none specified"}`).join("\n")}\nPROPOSED CAPTION:\n${moment.scene}\nPRIMARY STORY FACT: ${moment.fact}\n${shot.page === 0 ? "" : seriesPictureSource(pageTexts[shot.page] || "", shot.paragraph, (shot as any).storyQuote)}\nAttachment 2 is the identity sheet, left to right: ${drawn.map((e, i) => `slot ${i + 1} = ${e.id} (${e.name})`).join("; ")}. The last attachment is the public style example.`;
    for (const spec of models) {
      const [model, mode] = spec.split(":");
      for (let run = 1; run <= runs; run++) {
        const started = Date.now();
        let row: any;
        try {
          const reply = await llm({ stage: "series-recheck", role: mode === "think" ? "critic" : "support", model, fallbackModel: model, effort: "low", json: true, maxTokens: /claude/.test(model) ? 4000 : 2500, timeoutMs: 120_000, system: SERIES_IMAGE_REVIEW, user: reviewUser, imageInputs: [image, sheet, SERIES_STYLE_REFERENCE] });
          const qa = readSeriesQa(reply.text, drawn);
          const pass = seriesPicturePasses(qa, shot.page === 0);
          const usable = !pass && seriesPictureUsable(qa);
          row = { id, spec, run, status: !qa ? "unreadable" : pass ? "passed" : usable ? "flawed" : "failed", accept: pass || usable, identity: qa?.identityById, sceneMatch: qa?.sceneMatch, storyConsistent: qa?.storyConsistent, actionClear: qa?.primaryActionClear, defects: qa?.defects.map(d => `${d.kind}${d.blocksAction ? "!" : ""}: ${d.detail}`), costUSD: reply.usage.costUSD, ms: Date.now() - started };
        } catch (error) {
          row = { id, spec, run, status: "error", accept: false, error: String((error as Error).message).slice(0, 200), ms: Date.now() - started };
        }
        row.label = labels[id]?.label;
        rows.push(row);
        await mkdir(join(out, ".."), { recursive: true });
        await appendFile(out, `${JSON.stringify(row)}\n`);
        console.log(`${id.padEnd(5)} ${spec.padEnd(32)} #${run} ${String(row.status).padEnd(10)} label=${String(row.label || "-").padEnd(6)} ${(row.defects || [row.error || ""]).join(" | ").slice(0, 160)}`);
      }
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
