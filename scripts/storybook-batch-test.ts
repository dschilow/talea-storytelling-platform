/**
 * Batch live test for the Bilderbuch-Modus: runs storybook-live-test.ts N times
 * with different seeds and writes one comparison table.
 *
 *   bun --env-file=<keys file> run scripts/storybook-batch-test.ts --count 6 --parallel 3 [--genre fairy_tales --age 6-8 --length medium] [--no-images]
 *
 * --parallel N runs the stories in waves of N at once. Every other option is
 * passed through to storybook-live-test.ts.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
function numberFlag(name: string, fallback: number): number {
  const at = args.indexOf(name);
  return at >= 0 ? Math.max(1, Number(args[at + 1]) || fallback) : fallback;
}
const count = numberFlag("--count", 3);
const parallel = numberFlag("--parallel", 1);
const passThrough = args.filter((_, index) => !["--count", "--parallel"].includes(args[index]) && !["--count", "--parallel"].includes(args[index - 1]));
// Märchen, 6-8 Jahre, mittlere Länge — unless the caller says otherwise.
const defaultPairs = [["--genre", "fairy_tales"], ["--age", "6-8"], ["--length", "medium"]]
  .filter(([flag]) => !passThrough.includes(flag))
  .flat();

const root = join("Logs", "storybook-v2-batch", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(root, { recursive: true });

// Like one family in production: every wave knows the stories before it, so
// the engine rotation and "don't repeat" rules get exercised.
const history = { stories: [] as string[], engines: [] as string[] };
const rows: string[] = [];

async function runOne(run: number, historyFile: string): Promise<void> {
  const out = join(root, `run-${run}`);
  console.log(`\n=== Lauf ${run}/${count} → ${out}`);
  const child = Bun.spawn(["bun", "run", "scripts/storybook-live-test.ts", ...defaultPairs, ...passThrough, "--history", historyFile, "--seed", `batch-${Date.now()}-${run}`, "--out", out], {
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  const code = await child.exited;
  if (code !== 0) {
    rows[run - 1] = `| ${run} | FEHLER (exit ${code}) | – | – | – | – | – |`;
    return;
  }
  if (passThrough.includes("--dry")) return;
  const result = JSON.parse(await readFile(join(out, "result.json"), "utf8"));
  const text = result.text;
  const total = (result.totals?.costUSD || 0) + (result.imageCostUSD || 0);
  rows[run - 1] = `| ${run} | ${text.title} | ${text.plan?.engine} | ${text.draftScore ?? "–"} | ${text.benchmarkScore ?? "–"} | $${total.toFixed(4)} | [story.md](run-${run}/story.md) |`;
  history.stories.unshift(`${text.title}: ${text.plan?.logline || ""}`);
  if (text.plan?.engine) history.engines.unshift(text.plan.engine);
}

for (let first = 1; first <= count; first += parallel) {
  const historyFile = join(root, `history-${first}.json`);
  await writeFile(historyFile, JSON.stringify(history), "utf8");
  const wave = Array.from({ length: Math.min(parallel, count - first + 1) }, (_, index) => first + index);
  await Promise.all(wave.map((run) => runOne(run, historyFile)));
}

const table = [
  "# Bilderbuch-Modus — Serienlauf",
  "",
  "| Lauf | Titel | Bauplan | Note Entwurf | Note Endfassung | Kosten | Geschichte |",
  "|---|---|---|---|---|---|---|",
  ...rows.filter(Boolean),
  "",
  "Noten: Lektorat (0–10 gegen veröffentlichte Top-Bilderbücher).",
].join("\n");
await writeFile(join(root, "summary.md"), table, "utf8");
console.log(`\n${table}\n\n→ ${join(root, "summary.md")}`);
