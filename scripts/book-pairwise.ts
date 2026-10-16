/**
 * Pairwise judge for chapter-book variants (book-live-test.ts output): for every run id present
 * in both dirs, each judge hears the opening chapters of A and B in both orders and picks the book
 * a child would beg to continue. Reads only what a child hears — never the plan.
 *
 * 2026-10-16: two judges from different model families by default (the other AI's review: "zwei Richter
 * aus verschiedenen Modell-Familien"); a pair counts as won only when every judge agrees in both orders.
 *
 *   bun --env-file=.env.local run scripts/book-pairwise.ts <dirA> <dirB> [--judges google/gemini-3.8-flash,openai/gpt-6-luna]
 *   (--judge <model> keeps the single-judge mode)
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { bookWishLines } from "../backend/story/storybook/book/prompts";

const [dirA, dirB] = process.argv.slice(2);
const judgeAt = process.argv.indexOf("--judge");
const judgesAt = process.argv.indexOf("--judges");
const judges = judgesAt >= 0
  ? process.argv[judgesAt + 1].split(",").map((entry) => entry.trim()).filter(Boolean)
  : judgeAt >= 0 ? [process.argv[judgeAt + 1]] : ["google/gemini-3.8-flash", "openai/gpt-6-luna"];
const key = process.env.OPENROUTER_API_KEY || "";

const exists = (path: string) => stat(path).then(() => true, () => false);
const load = async (dir: string, id: string) => JSON.parse(await readFile(join(dir, id, "result.json"), "utf8"));
const render = (result: any) => [`TITEL: ${result.plan.title}`, ...result.state.chapters.map((chapter: any) => `KAPITEL ${chapter.order}: ${chapter.title}\n${chapter.content}`)].join("\n\n");

const SYSTEM = [
  "Du bist Lektorin eines großen Kinderbuchverlags und hörst die ersten Kapitel zweier Kapitelbuch-Manuskripte zu denselben Wünschen einer Familie.",
  "Entscheide, welches Buch ein Kind morgen Abend unbedingt weiterhören will — und welches die vorlesenden Eltern selbst gern weiterlesen.",
  "Gewichte: 1) Würde ein Kind dieses Alters es lieben (Figuren, die man nicht vergisst, Lachen, Staunen, Spannung, Herz)? 2) Versteht es beim ersten Hören, wo es ist, wer wer ist und worum es geht? 3) Sind die Wünsche der Familie erfüllt? 4) Sprache und Logik ohne Fehler.",
  "Die Reihenfolge sagt nichts über die Qualität. Länge ist kein Vorteil. Sei streng: Vergleiche beide mit echten Top-Kapitelbüchern (Das kleine Gespenst, Der kleine Drache Kokosnuss, Lichterland, Pumuckl).",
  'Antworte nur mit JSON: {"winner":"A" oder "B","margin":"klar" oder "knapp","scoreA":0-10,"scoreB":0-10,"why":"zwei Sätze"}',
].join("\n");

async function ask(judge: string, user: string): Promise<any> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: judge, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }], max_tokens: 4000, response_format: { type: "json_object" }, reasoning: { effort: "low", exclude: true }, usage: { include: true } }),
  });
  const data: any = await response.json();
  const text = String(data.choices?.[0]?.message?.content || "");
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return { ...json, cost: Number(data.usage?.cost || 0) };
}

/** One judge, both orders: "new", "old" or "split", plus the mean scores. */
async function judgePair(judge: string, wishes: string, a: any, b: any): Promise<{ verdict: "new" | "old" | "split"; newScore: number; oldScore: number; why: string; cost: number }> {
  const [first, second] = await Promise.all([
    ask(judge, `${wishes}\n\nMANUSKRIPT A:\n${render(a)}\n\nMANUSKRIPT B:\n${render(b)}`),
    ask(judge, `${wishes}\n\nMANUSKRIPT A:\n${render(b)}\n\nMANUSKRIPT B:\n${render(a)}`),
  ]);
  // In the second read, "A" is dirB.
  const vote1 = first.winner === "B" ? "new" : "old";
  const vote2 = second.winner === "A" ? "new" : "old";
  return {
    verdict: vote1 === vote2 ? vote1 : "split",
    newScore: ((Number(first.scoreB) || 0) + (Number(second.scoreA) || 0)) / 2,
    oldScore: ((Number(first.scoreA) || 0) + (Number(second.scoreB) || 0)) / 2,
    why: String(first.why || ""),
    cost: first.cost + second.cost,
  };
}

const ids = (await readdir(dirA)).filter((id) => /^K\d+$/.test(id)).sort();
const rows: string[] = [];
let total = 0;
let winsB = 0;
let pairs = 0;
await Promise.all(ids.map(async (id) => {
  if (!(await exists(join(dirA, id, "result.json"))) || !(await exists(join(dirB, id, "result.json")))) return;
  const [a, b] = await Promise.all([load(dirA, id), load(dirB, id)]);
  const wishes = `ALTER: ${a.brief.band} Jahre\nWÜNSCHE DER FAMILIE:\n${bookWishLines(a.brief.config).map((line) => `- ${line}`).join("\n")}`;
  const results = await Promise.all(judges.map((judge) => judgePair(judge, wishes, a, b)));
  total += results.reduce((sum, result) => sum + result.cost, 0);
  // Won only when every judge agrees in both orders; one dissenting judge or order is a split.
  const verdict = results.every((result) => result.verdict === "new") ? "new" : results.every((result) => result.verdict === "old") ? "old" : "split";
  const mean = (pick: (result: (typeof results)[number]) => number) => results.reduce((sum, result) => sum + pick(result), 0) / results.length;
  if (verdict === "new") winsB += 1;
  if (verdict === "split") winsB += 0.5;
  pairs += 1;
  const perJudge = results.map((result, index) => `${judges[index].split("/").pop()}: ${result.verdict}`).join(", ");
  rows.push(`| ${id} | ${a.plan.title} | ${b.plan.title} | ${verdict} | ${perJudge} | ${mean((result) => result.oldScore).toFixed(1)} | ${mean((result) => result.newScore).toFixed(1)} | ${results[0].why} |`);
}));
rows.sort();
const table = [
  `# Paarvergleich Kapitelbuch (${judges.join(" + ")})`, "", `A = ${dirA}`, `B = ${dirB}`, "",
  "| Lauf | A (alt) | B (neu) | Sieger | je Richter | Note A | Note B | Begründung (1. Richter, 1. Lesung) |", "|---|---|---|---|---|---|---|---|", ...rows, "",
  `B gewinnt ${winsB} von ${pairs} (Unentschieden oder uneinige Richter = 0,5). Kosten Richter: $${total.toFixed(4)}`,
].join("\n");
await writeFile(join(dirB, "pairwise-vs-" + dirA.replace(/[\\/:]/g, "_") + ".md"), table, "utf8");
console.log(table);
