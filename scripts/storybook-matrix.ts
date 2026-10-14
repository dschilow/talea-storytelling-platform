/**
 * Runs the wizard matrix through scripts/storybook-live-test.ts.
 *   bun --env-file=.env.local run <this> <tag> [--only B1,B4] [--parallel 4] [extra flags for every run]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const tag = args[0] || "baseline";
const at = (name: string) => args.indexOf(name);
const only = at("--only") >= 0 ? args[at("--only") + 1].split(",") : null;
const parallel = at("--parallel") >= 0 ? Number(args[at("--parallel") + 1]) : 4;
// Same seed tag = same cast shortlist and artifacts, so variants compare fairly.
const seedTag = at("--seed-tag") >= 0 ? args[at("--seed-tag") + 1] : tag;
const own = new Set(["--only", "--parallel", "--seed-tag"]);
const extra = args.slice(1).filter((a, i, all) => !own.has(a) && !own.has(all[i - 1]));

export const MATRIX: Record<string, string[]> = {
  B1: ["--genre", "fairy_tales", "--age", "6-8", "--length", "medium", "--flavors", "lachfreude,prickeln"],
  B2: ["--genre", "fairy_tales", "--age", "6-8", "--length", "medium", "--flavors", "warmherzigkeit"],
  B3: ["--genre", "adventure", "--age", "6-8", "--length", "medium", "--flavors", "prickeln", "--twist"],
  B4: ["--genre", "animals", "--age", "6-8", "--length", "medium", "--flavors", "lachfreude", "--learning", "science", "--objectives", "Warum Igel Winterschlaf halten"],
  B5: ["--genre", "magic", "--age", "3-5", "--length", "short", "--flavors", "lachfreude,uebermut", "--rhymes"],
  B6: ["--genre", "scifi", "--age", "9-12", "--length", "long", "--flavors", "prickeln", "--twist"],
  B7: ["--genre", "modern", "--age", "6-8", "--length", "medium", "--flavors", "warmherzigkeit,zusammenhalt", "--moral"],
  B8: ["--genre", "fairy_tales", "--age", "6-8", "--length", "medium", "--flavors", "lachfreude", "--famous", "--learning", "math", "--objectives", "Verdoppeln"],
  // "Eigener Wunsch (wenn du magst)" — the story has to be about exactly this.
  B9: ["--genre", "magic", "--age", "6-8", "--length", "medium", "--flavors", "lachfreude,warmherzigkeit", "--wish", "Alexander hat seinen ersten Wackelzahn verloren und will unbedingt die Zahnfee kennenlernen"],
  B10: ["--genre", "fairy_tales", "--age", "3-5", "--length", "short", "--flavors", "warmherzigkeit", "--wish", "Ein kleiner Drache, der Angst im Dunkeln hat"],
};

const root = join("Logs", "storybook-v2-release", tag);
await mkdir(root, { recursive: true });
const ids = Object.keys(MATRIX).filter((id) => !only || only.includes(id));
const results: string[] = [];
async function run(id: string) {
  const out = join(root, id);
  const child = Bun.spawn(
    ["bun", "run", "scripts/storybook-live-test.ts", "--hero-file", "Logs/test-heroes-alexander-adrian.json", "--history", "Logs/test-history-alexander-adrian.json", "--seed", `${seedTag}-${id}`, "--out", out, ...MATRIX[id], ...extra],
    { stdout: "pipe", stderr: "pipe", env: process.env }
  );
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  const code = await child.exited;
  await writeFile(`${out}.log`, stdout + "\n--- stderr ---\n" + stderr, "utf8");
  const last = stdout.trim().split("\n").pop() || "";
  results.push(`${id}: exit ${code} ${last}`);
  console.log(`${id}: exit ${code} ${last}`);
}
for (let i = 0; i < ids.length; i += parallel) await Promise.all(ids.slice(i, i + parallel).map(run));
await writeFile(join(root, "summary.txt"), results.sort().join("\n"), "utf8");
