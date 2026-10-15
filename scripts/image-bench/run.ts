/**
 * Bild-Benchmark: Modell × Referenz-Strategie × Prompt × Stil × Szene × Seed.
 *
 *   bun --env-file=.env.local run scripts/image-bench/run.ts --phase screen --dry     # nur planen + Kosten schätzen
 *   bun --env-file=.env.local run scripts/image-bench/run.ts --phase screen --budget 1.0
 *   bun --env-file=.env.local run scripts/image-bench/run.ts --phase refs --models klein9,klein9kv --seeds 3
 *   bun --env-file=.env.local run scripts/image-bench/run.ts --report <runname>       # Auswertung neu schreiben
 *
 * Phasen sind nur Voreinstellungen; jede Achse lässt sich mit --models/--refs/--prompts/--styles/--scenes überschreiben.
 * Jede Anfrage wird zwischengespeichert (gleiche Anfrage = kostenlos), jeder Aufruf zählt gegen --budget (Standard $1.50).
 * Der Judge (Vision-Modell) bewertet jedes Bild; --judge off schaltet ihn ab.
 */
import sharp from "sharp";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Budget, ensureDir, flag, generate, option, pool, ROOT } from "./lib/core";
import { judge, type Verdict } from "./lib/judge";
import { rankCandidates } from "./lib/rank";
import { byKey, buildRequest, MODELS, type ModelProfile } from "./lib/models";
import { buildPrompt, PROMPT_VARIANTS, SCENES, STYLES, type PromptVariant } from "./lib/prompts";
import { buildRefs, judgeSheet, REF_STRATEGIES, type BuiltRefs, type RefStrategy } from "./lib/refs";
import { figureById, loadRoster, restylePortrait, type Figure } from "./lib/roster";

const PRICE_GUARD = 0.0125;
const BASE_SCENES = SCENES.filter((scene) => !/^(s5[bcd]|b[0-9]|l[0-9])/.test(scene.id)).map((scene) => scene.id);

interface Variant {
  id: string;
  model: ModelProfile;
  refs: RefStrategy;
  prompt: PromptVariant;
  style: string;
  /** nur gesetzt, wenn per Flag angegeben; sonst Standard des Modells */
  steps?: number;
  accel?: string;
  size: number;
  cfg?: number;
}

interface CaseResult {
  variant: string;
  model: string;
  refs: string;
  prompt: string;
  style: string;
  scene: string;
  figures: number;
  seed: number;
  file?: string;
  cost: number;
  ms: number;
  cached: boolean;
  error?: string;
  verdict?: Verdict | { error: string };
}

const PRESETS: Record<string, { models: string[]; refs: string[]; prompts: string[]; styles: string[]; scenes: string[]; seeds: number }> = {
  probe: { models: MODELS.filter((m) => m.price <= PRICE_GUARD).map((m) => m.key), refs: ["sprite"], prompts: ["current"], styles: ["watercolor"], scenes: ["s3-child-fox"], seeds: 1 },
  screen: { models: ["klein9", "klein4", "klein9kv", "klein4base", "klein9base", "boogu", "qwenedit", "qwenedit2511", "pedit", "muse"], refs: ["sprite"], prompts: ["current"], styles: ["watercolor"], scenes: ["s1-solo", "s3-child-fox", "s5-creatures", "s6-four"], seeds: 2 },
  refs: { models: ["klein9", "klein9kv"], refs: [...REF_STRATEGIES], prompts: ["current"], styles: ["watercolor"], scenes: BASE_SCENES, seeds: 3 },
  prompts: { models: ["klein9"], refs: ["sprite"], prompts: [...PROMPT_VARIANTS], styles: ["watercolor"], scenes: BASE_SCENES, seeds: 3 },
  styles: { models: ["klein9"], refs: ["sprite"], prompts: ["current"], styles: STYLES.map((s) => s.key), scenes: ["s1-solo", "s3-child-fox", "s4-three-humans", "s6-four"], seeds: 2 },
};

const list = (name: string, fallback: string[]) => (option(name) ? option(name)!.split(",").map((s) => s.trim()).filter(Boolean) : fallback);
const slug = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN);
const pct = (n: number) => (Number.isFinite(n) ? `${Math.round(n * 100)} %` : "–");
const fix = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "–");

function isVerdict(v: CaseResult["verdict"]): v is Verdict {
  return Boolean(v) && !("error" in (v as any));
}

type Ranks = Record<string, { score: number; n: number }>;

function summarize(results: CaseResult[], ranks: Ranks = {}) {
  const groups = new Map<string, CaseResult[]>();
  for (const result of results) groups.set(result.variant, [...(groups.get(result.variant) || []), result]);
  return [...groups.entries()].map(([variant, rows]) => {
    const delivered = rows.filter((row) => row.file);
    const judged = delivered.filter((row) => isVerdict(row.verdict)).map((row) => row.verdict as Verdict);
    const passRate = judged.length ? judged.filter((v) => v.pass).length / judged.length : NaN;
    const avgCost = mean(delivered.map((row) => row.cost));
    const byFigures = (count: number) => {
      const subset = delivered.filter((row) => row.figures === count && isVerdict(row.verdict)).map((row) => row.verdict as Verdict);
      return subset.length ? subset.filter((v) => v.pass).length / subset.length : NaN;
    };
    return {
      variant, n: rows.length, delivered: delivered.length, failed: rows.length - delivered.length,
      passRate, identity: mean(judged.map((v) => v.identityScore)), beauty: mean(judged.map((v) => v.beauty)),
      artifacts: mean(judged.map((v) => v.artifacts)), sceneFit: mean(judged.map((v) => v.sceneFit)),
      scenery: mean(judged.map((v) => v.scenery)), action: mean(judged.map((v) => v.action)),
      vignette: judged.length ? judged.filter((v) => v.vignette).length / judged.length : NaN,
      composition: judged.length ? judged.filter((v) => v.scenery >= 2 && v.action >= 2 && !v.vignette).length / judged.length : NaN,
      leak: judged.length ? judged.filter((v) => v.sheetLeak).length / judged.length : NaN,
      text: judged.length ? judged.filter((v) => v.text).length / judged.length : NaN,
      unlisted: judged.length ? judged.filter((v) => v.unlisted > 0).length / judged.length : NaN,
      rank: ranks[variant]?.score ?? NaN, avgCost, perAccepted: passRate > 0 ? avgCost / passRate : Infinity,
      ms: mean(delivered.map((row) => row.ms)), p1: byFigures(1), p2: byFigures(2), p3: byFigures(3), p4: byFigures(4),
    };
  });
}

function reportMarkdown(name: string, results: CaseResult[], budget?: Budget, ranks: Ranks = {}): string {
  const rows = summarize(results, ranks).sort((a, b) => ((b.rank || 0) - (a.rank || 0)) || ((b.passRate || 0) - (a.passRate || 0)) || a.perAccepted - b.perAccepted);
  const lines = [
    `# Bild-Benchmark ${name}`,
    "",
    `${results.length} Fälle, ${rows.length} Varianten.${budget ? ` Ausgegeben: Bilder $${budget.spent.toFixed(4)}, Judge $${budget.judge.toFixed(4)}.` : ""}`,
    "",
    "| Variante (Modell \\| Referenz \\| Prompt \\| Stil) | n | ok | Rang | Bestanden | Szene gut | Umgebung (0–3) | Aktion (0–3) | Vignette | davon 1 / 2 / 3 / 4 Fig. | Identität | Schön (0–10) | Artefakte (0–3) | Blatt im Bild | Schrift | Fremdfig. | ¢/Bild | ¢/gutes Bild | s |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) =>
      `| ${r.variant} | ${r.n} | ${r.delivered} | ${pct(r.rank)} | **${pct(r.passRate)}** | ${pct(r.composition)} | ${fix(r.scenery)} | ${fix(r.action)} | ${pct(r.vignette)} | ${pct(r.p1)} / ${pct(r.p2)} / ${pct(r.p3)} / ${pct(r.p4)} | ${fix(r.identity)} | ${fix(r.beauty, 1)} | ${fix(r.artifacts, 1)} | ${pct(r.leak)} | ${pct(r.text)} | ${pct(r.unlisted)} | ${fix(r.avgCost * 100, 3)} | ${Number.isFinite(r.perAccepted) ? fix(r.perAccepted * 100, 3) : "∞"} | ${fix(r.ms / 1000, 1)} |`,
    ),
    "",
    "Rang = mittlerer Platz im anonymisierten Vergleich gleicher Szene/Seed (100 % = immer Bester, 0 % = immer Letzter; Identität vor Sauberkeit vor Schönheit).",
    "Szene gut = Umgebung ≥ 2 und Aktion ≥ 2 und keine Vignette (Figuren vor einem hellen Wash ohne Ort).",
    "Bestanden = jede Figur genau einmal, Identität ≥ 2/3, Kleidung ≥ 2/3, Anatomie ≥ 1/2, keine Fremdfiguren, kein Referenzblatt im Bild, keine Schrift, Artefakte ≥ 2/3.",
    "¢/gutes Bild = Ø Kosten pro Bild ÷ Bestehensquote (so viele Versuche braucht ein brauchbares Bild).",
  ];
  const failures = results.filter((r) => r.error);
  if (failures.length) {
    lines.push("", "## Fehler", ...[...new Set(failures.map((r) => `- ${r.variant}: ${r.error}`))].slice(0, 20));
  }
  return lines.join("\n");
}

async function montage(runDir: string, results: CaseResult[]): Promise<void> {
  const cell = 360;
  const bar = 36;
  const columns = 5;
  const variants = [...new Set(results.map((r) => r.variant))];
  const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  for (const sceneId of [...new Set(results.map((r) => r.scene))]) {
    const rows = results.filter((r) => r.scene === sceneId && r.file).sort((a, b) => variants.indexOf(a.variant) - variants.indexOf(b.variant) || a.seed - b.seed);
    const tiles: sharp.OverlayOptions[] = [];
    for (const [index, found] of rows.entries()) {
      const left = (index % columns) * cell;
      const top = Math.floor(index / columns) * (cell + bar);
      const verdict = isVerdict(found.verdict) ? found.verdict : undefined;
      const color = verdict ? (verdict.pass ? "#2e7d4f" : "#b3382f") : "#555555";
      const caption = `${found.variant.split("|").slice(0, 2).join(" ")} ${found.variant.split("|").slice(2).filter((p) => p !== "current" && p !== "watercolor").join(" ")} s${found.seed} · ${(found.cost * 100).toFixed(2)}¢`.trim();
      tiles.push({ input: await sharp(found.file!).resize(cell, cell, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer(), left, top: top + bar });
      tiles.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${bar}"><rect width="100%" height="100%" fill="${color}"/><text x="8" y="23" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#fff">${esc(caption)}</text></svg>`), left, top });
    }
    const rowCount = Math.ceil(rows.length / columns);
    await sharp({ create: { width: cell * columns, height: rowCount * (cell + bar), channels: 3, background: "#ffffff" } })
      .composite(tiles).jpeg({ quality: 85 }).toFile(join(runDir, `montage-${sceneId}.jpg`));
  }
}

async function loadRanks(runDir: string): Promise<Ranks> {
  try {
    return JSON.parse(await readFile(join(runDir, "ranks.json"), "utf8"));
  } catch {
    return {};
  }
}

async function writeReports(name: string, runDir: string, results: CaseResult[], budget?: Budget): Promise<void> {
  await writeFile(join(runDir, "report.md"), reportMarkdown(name, results, budget, await loadRanks(runDir)));
  await montage(runDir, results);
}

async function readResults(runDir: string): Promise<CaseResult[]> {
  const text = await readFile(join(runDir, "results.jsonl"), "utf8");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function rankRun(runDir: string, results: CaseResult[], model: string, budget: Budget, rounds: number): Promise<Ranks> {
  const roster = await loadRoster(budget);
  const groups = new Map<string, CaseResult[]>();
  for (const result of results) {
    if (!result.file) continue;
    const key = `${result.scene}|${result.seed}`;
    groups.set(key, [...(groups.get(key) || []), result]);
  }
  const prepared = [];
  for (const [id, rows] of groups) {
    if (rows.length < 3) continue;
    const scene = SCENES.find((candidate) => candidate.id === rows[0].scene)!;
    const figures = scene.cast.map((key) => figureById(roster, key));
    prepared.push({ id, sheet: await judgeSheet(figures), figures, scene: scene.text, candidates: rows.map((row) => ({ key: row.variant, file: row.file! })) });
  }
  const ranks: Ranks = Object.fromEntries(await rankCandidates({ groups: prepared, model, budget, rounds }));
  await writeFile(join(runDir, "ranks.json"), JSON.stringify(ranks, null, 1));
  return ranks;
}

// ---------------------------------------------------------------------------
// Lauf
// ---------------------------------------------------------------------------
const rankOnly = option("--rank");
if (rankOnly) {
  const runDir = join(ROOT, "runs", rankOnly);
  const results = await readResults(runDir);
  const rankBudget = new Budget(Number(option("--budget", "1.0")));
  const ranks = await rankRun(runDir, results, option("--rank-judge", option("--judge", "openai/gpt-6-luna"))!, rankBudget, Number(option("--rounds", "2")));
  await writeReports(rankOnly, runDir, results);
  console.log(reportMarkdown(rankOnly, results, rankBudget, ranks));
  process.exit(0);
}

const rejudgeOnly = option("--rejudge");
if (rejudgeOnly) {
  const runDir = join(ROOT, "runs", rejudgeOnly);
  const results = await readResults(runDir);
  const rejudgeBudget = new Budget(Number(option("--budget", "0.5")));
  const roster = await loadRoster(rejudgeBudget);
  const model = option("--judge", "openai/gpt-6-luna")!;
  await pool(results, 4, async (result) => {
    if (!result.file) return;
    const scene = SCENES.find((candidate) => candidate.id === result.scene)!;
    const figures = scene.cast.map((key) => figureById(roster, key));
    result.verdict = await judge({ image: await readFile(result.file), sheet: await judgeSheet(figures), figures, scene: scene.text, model, budget: rejudgeBudget });
  });
  await writeFile(join(runDir, "results.jsonl"), results.map((result) => JSON.stringify(result)).join("\n") + "\n");
  await writeReports(rejudgeOnly, runDir, results, rejudgeBudget);
  console.log(reportMarkdown(rejudgeOnly, results, rejudgeBudget, await loadRanks(runDir)));
  process.exit(0);
}

const reportOnly = option("--report");
if (reportOnly) {
  const runDir = join(ROOT, "runs", reportOnly);
  const results = await readResults(runDir);
  await writeReports(reportOnly, runDir, results);
  console.log(reportMarkdown(reportOnly, results, undefined, await loadRanks(runDir)));
  process.exit(0);
}

const phase = option("--phase", "screen")!;
const preset = PRESETS[phase];
if (!preset) throw new Error(`unknown --phase ${phase}; use ${Object.keys(PRESETS).join(", ")}`);
const allowExpensive = flag("--allow-expensive");
const models = list("--models", preset.models).map(byKey).filter((model) => {
  const ok = allowExpensive || model.price <= PRICE_GUARD;
  if (!ok) console.log(`übersprungen (Preis ${model.price} > ${PRICE_GUARD}, --allow-expensive zum Erzwingen): ${model.key}`);
  return ok;
});
const refStrategies = list("--refs", preset.refs) as RefStrategy[];
const promptVariants = list("--prompts", preset.prompts) as PromptVariant[];
const styleKeys = list("--styles", preset.styles);
const stepList = option("--steps") ? list("--steps", []).map(Number) : [undefined];
const accelList = option("--accel") ? list("--accel", []) : [undefined];
const sizeList = list("--sizes", ["1024"]).map(Number);
const cfgList = option("--cfgs") ? list("--cfgs", []).map(Number) : [undefined];
const sceneIds = list("--scenes", preset.scenes);
const scenes = sceneIds.map((id) => SCENES.find((scene) => scene.id === id || scene.id.startsWith(id)) || (() => { throw new Error(`unknown scene ${id}`); })());
const seedCount = Number(option("--seeds", String(preset.seeds)));
const seedBase = Number(option("--seed-base", "21"));
const budget = new Budget(Number(option("--budget", "1.5")));
const judgeModel = option("--judge", "openai/gpt-6-luna")!;
const judgeOn = judgeModel !== "off";

const variants: Variant[] = [];
for (const model of models) {
  for (const refs of refStrategies) {
    if (refs === "grid" && !model.dims) continue; // ohne Maße ist jedes Blatt ohnehin ein Raster
    if ((refs === "multi" || refs.endsWith("-multi")) && model.maxRefs === 1) continue;
    for (const prompt of promptVariants) {
      if (refs === "none" && prompt === "nolooks") continue;
      for (const style of styleKeys) for (const steps of stepList) for (const accel of accelList) for (const size of sizeList) for (const cfg of cfgList) {
        const suffix = [steps ? `steps=${steps}` : "", accel ? `accel=${accel}` : "", size !== 1024 ? `size=${size}` : "", cfg !== undefined ? `cfg=${cfg}` : ""].filter(Boolean);
        variants.push({ id: [model.key, refs, prompt, style, ...suffix].join("|"), model, refs, prompt, style, steps, accel, size, cfg });
      }
    }
  }
}

const caseCount = variants.length * scenes.length * seedCount;
const estimate = variants.reduce((sum, v) => sum + v.model.price * scenes.length * seedCount, 0) + (judgeOn ? caseCount * 0.0003 : 0);
console.log(`Phase ${phase}: ${variants.length} Varianten × ${scenes.length} Szenen × ${seedCount} Seeds = ${caseCount} Bilder; geschätzt ≈ $${estimate.toFixed(2)} (Budget $${budget.cap.toFixed(2)})`);
if (flag("--dry")) {
  for (const v of variants) console.log("  ", v.id);
  process.exit(0);
}
if (estimate > budget.cap * 1.5 && !flag("--force")) throw new Error(`Schätzung $${estimate.toFixed(2)} liegt weit über dem Budget — --budget erhöhen oder --force`);

const name = option("--name", `${phase}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}`)!;
const runDir = join(ROOT, "runs", name);
await ensureDir(join(runDir, "images"));
await ensureDir(join(runDir, "prompts"));
await writeFile(join(runDir, "config.json"), JSON.stringify({ phase, variants: variants.map((v) => v.id), scenes: scenes.map((s) => s.id), seedCount, seedBase, judgeModel, budget: budget.cap }, null, 1));

const roster = await loadRoster(budget);
// --portrait-style <stil>: alle Referenzporträts vorher in diesen Stil umzeichnen (Stilwechsel-Test); der Judge vergleicht weiter gegen die Originale.
const portraitStyle = option("--portrait-style");
if (portraitStyle) {
  const style = STYLES.find((candidate) => candidate.key === portraitStyle) || (() => { throw new Error(`unknown style ${portraitStyle}`); })();
  for (const figure of roster) {
    figure.original = figure.portrait;
    figure.portrait = await restylePortrait(figure, style, budget);
  }
  console.log(`Referenzporträts in "${portraitStyle}" neu gezeichnet (${roster.length}), bisher $${budget.spent.toFixed(3)}`);
}
const refCache = new Map<string, Promise<BuiltRefs>>();
const sheetCache = new Map<string, Promise<Buffer>>();
const concurrency = Number(option("--concurrency", "4"));

interface Job { variant: Variant; scene: (typeof SCENES)[number]; seed: number }
const jobs: Job[] = [];
for (const scene of scenes) for (let i = 0; i < seedCount; i++) for (const variant of variants) jobs.push({ variant, scene, seed: seedBase + i });

// Vorab sequenziell alle einmaligen Hilfsbilder (Kanon-Karten, Freisteller) erzeugen, damit nichts doppelt bezahlt wird.
for (const scene of scenes) {
  const onStage = scene.cast.map((key) => figureById(roster, key));
  for (const variant of variants) {
    const cacheKey = `${variant.refs}|${variant.model.maxRefs}|${variant.model.dims}|${scene.id}`;
    if (!refCache.has(cacheKey)) refCache.set(cacheKey, buildRefs(variant.refs, onStage, variant.model, budget));
    await refCache.get(cacheKey);
  }
}

let done = 0;
const results = await pool(jobs, concurrency, async ({ variant, scene, seed }): Promise<CaseResult> => {
  const onStage: Figure[] = scene.cast.map((key) => figureById(roster, key));
  const refs = await refCache.get(`${variant.refs}|${variant.model.maxRefs}|${variant.model.dims}|${scene.id}`)!;
  const style = STYLES.find((s) => s.key === variant.style) || (() => { throw new Error(`unknown style ${variant.style}`); })();
  const { prompt, negative } = buildPrompt(variant.prompt, { scene, onStage, refs, style });
  const request = buildRequest(variant.model, { prompt, negative, refs: refs.images, seed, size: variant.size, steps: variant.steps, cfg: variant.cfg, accel: variant.accel });
  const promptFile = join(runDir, "prompts", `${slug(variant.id)}__${scene.id}.txt`);
  await writeFile(promptFile, `${prompt}\n\n--- negative ---\n${negative}\n\n--- refs: ${refs.mode}/${refs.layout}, ${refs.images.length} Bild(er) ---\n`);
  const file = join(runDir, "images", slug(variant.id), `${scene.id}-s${seed}.jpg`);
  const generated = await generate(request, file, budget);
  let verdict: CaseResult["verdict"];
  if (generated.file && judgeOn) {
    const sheetKey = scene.id;
    if (!sheetCache.has(sheetKey)) sheetCache.set(sheetKey, judgeSheet(onStage));
    try {
      verdict = await judge({ image: await readFile(generated.file), sheet: await sheetCache.get(sheetKey)!, figures: onStage, scene: scene.text, model: judgeModel, budget });
    } catch (error) {
      verdict = { error: String((error as Error).message || error).slice(0, 200) };
    }
  }
  const result: CaseResult = {
    variant: variant.id, model: variant.model.key, refs: variant.refs, prompt: variant.prompt, style: variant.style, scene: scene.id, figures: onStage.length, seed,
    file: generated.file, cost: generated.cost, ms: generated.ms, cached: generated.cached, error: generated.error, verdict,
  };
  await appendFile(join(runDir, "results.jsonl"), JSON.stringify(result) + "\n");
  done++;
  const flagText = isVerdict(verdict) ? (verdict.pass ? "ok  " : "FAIL") : verdict ? "judge-error" : "    ";
  console.log(`[${done}/${jobs.length}] ${flagText} ${variant.id} ${scene.id} s${seed}  $${generated.cost.toFixed(4)}${generated.cached ? " (cache)" : ""}${generated.error ? `  ✗ ${generated.error.slice(0, 120)}` : ""}  [Σ $${(budget.spent + budget.judge).toFixed(3)}]`);
  return result;
});

let ranks: Ranks = {};
if (judgeOn && !flag("--no-rank") && variants.length >= 3) ranks = await rankRun(runDir, results, option("--rank-judge", judgeModel)!, budget, Number(option("--rounds", "2")));
await writeReports(name, runDir, results, budget);
console.log("\n" + reportMarkdown(name, results, budget, ranks));
console.log(`\nLauf: ${runDir}  (report.md, montage-*.jpg, prompts/, images/)`);
