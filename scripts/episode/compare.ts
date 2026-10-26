import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { codexPort } from "../wonder-story/codex-port";
import { ROLE_QUALITY_RUBRIC, ROLE_REVIEW_SYSTEM } from "./quality-rubric";

const args = process.argv.slice(2);
const opt = (key: string, fallback: string) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const variant = opt("--variant", "medium");
const model = opt("--model", "gpt-6-luna");
if (!["gpt-6-luna", "gpt-6.1-sol"].includes(model)) throw new Error("Unauthorised model");
const root = resolve(opt("--root", "Logs/episode-role-quality/2026-10-26"));
const caseIds = opt("--cases", "imp,witch,sleep,hero").split(",");
const payload: any[] = [];
const mapping: any[] = [];
const sources = new Map<string, Record<string, string>>();
const norm = (text: string) => text.normalize("NFC").replace(/[„“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
for (const [index, id] of caseIds.entries()) {
  const paths = { baseline: join(root, `baseline-${id}`), candidate: join(root, `${variant}-${id}`) };
  const manifests = await Promise.all(Object.values(paths).map(path => readFile(join(path, "manifest.json"), "utf8").then(JSON.parse)));
  if (manifests.some(m => m.pipeline !== "talea-folge-v1") || manifests[0].inputSHA256 !== manifests[1].inputSHA256 || manifests[0].seed !== manifests[1].seed) throw new Error(`Unmatched pair ${id}`);
  const text = await Promise.all(Object.values(paths).map(path => readFile(join(path, "story.md"), "utf8")));
  const input = JSON.parse(await readFile(join(paths.baseline, "input.json"), "utf8"));
  const bFirst = (index + (model === "gpt-6.1-sol" ? 1 : 0)) % 2 === 1;
  const labels = bFirst ? { A: "candidate", B: "baseline" } : { A: "baseline", B: "candidate" };
  const stories = { A: bFirst ? text[1] : text[0], B: bFirst ? text[0] : text[1] };
  sources.set(id, stories);
  const wantedLead = input.config.avatarIsHero === false ? input.poolCharacters.find((r: any) => r.canLead)?.name : input.avatars.map((r: any) => r.name).join(" und ");
  payload.push({ id, readerBrief: { age: input.config.ageGroup, genre: input.config.genre, wish: input.config.customPrompt,
    leadingFigure: wantedLead, avatars: input.avatars.map((r: any) => ({ name: r.name, description: r.description })),
    figures: input.poolCharacters.map((r: any) => ({ name: r.name, want: r.want, fear: r.fear, speechStyle: r.speechStyle, runningGag: r.runningGag })) }, ...stories });
  mapping.push({ id, labels, manifests });
}
const output = resolve(opt("--out", join(root, `comparison-${variant}-${model}`)));
await mkdir(output, { recursive: true });
const readShape = { dimensions: Object.fromEntries(Object.keys(ROLE_QUALITY_RUBRIC).map(key => [key, { score: 0, reason: "..." }])),
  findings: [{ severity: "major|minor", quote: "...", readerCost: "...", fix: "..." }], strongest: { quote: "...", reason: "..." } };
const user = `Vergleiche jedes A/B-Paar getrennt. Bewerte beide Fassungen absolut 0–10. Prüfe, ob die Geschichte sich weiterentwickelt oder nur die gleiche Handlung wiederholt. Gib pro Fassung höchstens zwei konkrete wichtige Probleme und einen starken Moment an. Keine Pipelinevermutungen. Begründungen pro Kriterium höchstens zwölf Wörter.
JSON-Form: ${JSON.stringify({ cases: [{ id: "...", A: readShape, B: readShape, winner: "A|B|tie", verdict: "konkrete Begründung" }] })}
ALLE PAARE:
${JSON.stringify(payload)}`;
await writeFile(join(output, "blind-order.json"), JSON.stringify(mapping, null, 2));
await writeFile(join(output, "review-prompt.json"), JSON.stringify({ system: ROLE_REVIEW_SYSTEM, user }, null, 2));
if (args.includes("--dry")) { console.log(JSON.stringify({ pairs: payload.length, model, output })); process.exit(0); }
const call = await codexPort(join(output, model), model)({ stage: "episode-pair-review", role: "critic", model,
  system: ROLE_REVIEW_SYSTEM, user, json: true, effort: "low", maxTokens: 6000, timeoutMs: 300_000 });
await writeFile(join(output, "raw-review.txt"), call.text);
const parsed = JSON.parse(call.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
if (!Array.isArray(parsed.cases) || parsed.cases.length !== payload.length || new Set(parsed.cases.map((r: any) => r.id)).size !== payload.length) throw new Error("Missing or duplicate pair ratings");
const reviews = parsed.cases.map((review: any) => {
  const order = mapping.find(r => r.id === review.id);
  if (!order || !["A", "B", "tie"].includes(review.winner)) throw new Error("Invalid pair rating");
  const ratings: Record<string, any> = {};
  for (const label of ["A", "B"]) {
    const read = review[label];
    let score = 0;
    for (const [key, weight] of Object.entries(ROLE_QUALITY_RUBRIC)) {
      const value = read.dimensions?.[key];
      if (!value || !Number.isFinite(value.score) || value.score < 0 || value.score > 10) throw new Error(`Invalid dimension ${review.id}/${label}/${key}`);
      score += value.score * weight / 100;
    }
    const evidence = [...(read.findings || []), read.strongest];
    const unsupportedQuotes = evidence.map((r: any) => r?.quote).filter((quote: any) => quote && !norm(sources.get(review.id)![label]).includes(norm(quote)));
    ratings[order.labels[label]] = { ...read, score: Number(score.toFixed(2)), unsupportedQuotes };
  }
  return { id: review.id, ...ratings, preferred: review.winner === "tie" ? "tie" : order.labels[review.winner], verdict: review.verdict };
});
const mean = (key: string) => Number((reviews.reduce((sum: number, r: any) => sum + r[key].score, 0) / reviews.length).toFixed(3));
const report = { pipeline: "talea-folge-v1", variant, model, rubric: ROLE_QUALITY_RUBRIC,
  reviewPromptSHA256: createHash("sha256").update(ROLE_REVIEW_SYSTEM + user).digest("hex"),
  caveat: "Kleine Stichprobe; Modelllektoren derselben Familie, kein Kindertest. Die neue Rubrik ist nicht mit den früheren Storynoten vergleichbar.",
  baseline: mean("baseline"), candidate: mean("candidate"), reviews };
await writeFile(join(output, "evaluation.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ variant, model, baseline: report.baseline, candidate: report.candidate,
  cases: reviews.map((r: any) => ({ id: r.id, baseline: r.baseline.score, candidate: r.candidate.score, preferred: r.preferred,
    unsupportedQuotes: r.baseline.unsupportedQuotes.length + r.candidate.unsupportedQuotes.length })), output }));
