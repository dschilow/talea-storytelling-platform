/**
 * Asks Jev (typesafe/jev-1.14, ≈ 0.004 ct a picture) the production questions plus candidate questions for the faults of
 * Figurenabenteuer pictures on a folder of labelled pictures, and prints how well each question separates good from bad
 * pictures. Labels: {"<file stem>":{"label":"print|reject|gray"}} (the file stem is the picture's file name without .webp).
 *
 *   bun --env-file=.env.local run scripts/image-bench/series-jev.ts --images <dir>[,<dir>] --labels <labels.json>[,<labels.json>] [--out <jsonl>]
 */
import { appendFile, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createOpenRouterJevPort } from "../../backend/story/storybook/jev-openrouter";
import type { JevQuestion } from "../../backend/story/storybook/jev";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const cwd = process.env.INIT_CWD || process.cwd();
const dirs = (arg("images") || "").split(",").filter(Boolean).map(p => resolve(cwd, p));
const labelFiles = (arg("labels") || "").split(",").filter(Boolean).map(p => resolve(cwd, p));
const out = resolve(cwd, arg("out") || "Logs/image-bench/series-jev.jsonl");
const labels: Record<string, { label: string }> = {};
for (const file of labelFiles) Object.assign(labels, JSON.parse(await readFile(file, "utf8")));

const q = (instructions: string): JevQuestion => ({ type: "noul", instructions });
// Production questions (backend/story/storybook/jev.ts) and candidates for this lane's real faults.
const QUESTIONS: Record<string, JevQuestion> = {
  hybrid: q("A human child in the picture has animal body parts such as a tail, scales, claws, a snout or dinosaur legs."),
  twins: q("Two of the figures look like the same person: same face, same hair and same clothes."),
  fused: q("A character's legs or arms are fused into one shape or merge with another figure's body."),
  text: q("The picture contains readable written words or letters."),
  blend: q("One figure mixes features of two different characters, for example a child's hair, face or clothes together with an animal creature's ears, fur or snout."),
  garment: q("Two different figures wear the same distinctive garment, such as the same vest, jacket or hat."),
  stump: q("A person has an arm that ends in a shapeless stump, a mitten or a blur instead of a hand with fingers."),
  elfears: q("A child has huge pointed ears like an elf or a bat, much bigger than normal human ears."),
  extra: q("The picture contains a figure or creature in the background that does not belong to the story, such as a strange animal peeking out."),
};

const port = createOpenRouterJevPort(() => process.env.OPENROUTER_API_KEY);
if (!port) throw new Error("No OpenRouter key.");
const rows: Array<{ id: string; label: string; scores: Record<string, number>; costUSD: number }> = [];
for (const dir of dirs) {
  for (const file of (await readdir(dir)).filter(f => f.endsWith(".webp")).sort()) {
    const stem = file.replace(/\.webp$/, "");
    const label = labels[stem]?.label || labels[stem.replace(/^.*_/, "")]?.label || labels[stem.replace(/^([^_]+)_/, "$1:")]?.label;
    if (!label) continue;
    const reply = await port({ imageUrl: `data:image/webp;base64,${(await readFile(join(dir, file))).toString("base64")}`, questions: QUESTIONS });
    rows.push({ id: stem, label, scores: reply.answers, costUSD: reply.costUSD });
    await appendFile(out, JSON.stringify(rows.at(-1)) + "\n");
  }
}

const groups = ["print", "gray", "reject"];
console.log(`\n${rows.length} pictures (${groups.map(g => `${g} ${rows.filter(r => r.label === g).length}`).join(", ")}), ${(rows.reduce((s, r) => s + r.costUSD, 0) * 100 / Math.max(1, rows.length)).toFixed(4)} ct each`);
console.log("question   mean print / gray / reject   best cut: caught rejects  false alarms on prints");
for (const key of Object.keys(QUESTIONS)) {
  const of = (g: string) => rows.filter(r => r.label === g).map(r => r.scores[key] ?? 0);
  const mean = (a: number[]) => a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : "-";
  // The cut-off that keeps false alarms on good pictures at or below 1 and catches the most bad ones.
  let best = { cut: 1, caught: 0, alarms: 0 };
  for (let cut = 0.05; cut <= 1; cut += 0.05) {
    const alarms = of("print").filter(v => v >= cut).length, caught = of("reject").filter(v => v >= cut).length;
    if (alarms <= 1 && caught >= best.caught) best = { cut: Math.round(cut * 100) / 100, caught, alarms };
  }
  console.log(`${key.padEnd(10)} ${mean(of("print"))} / ${mean(of("gray"))} / ${mean(of("reject"))}        ≥${best.cut}: ${best.caught}/${of("reject").length}   ${best.alarms}/${of("print").length}`);
}
await writeFile(out.replace(/\.jsonl$/, ".done"), "ok");
