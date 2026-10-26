import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { ROLE_QUALITY_RUBRIC, ROLE_REVIEW_SYSTEM } from "../episode/quality-rubric";
import { parseJsonObject } from "../../backend/story/storybook/llm";
import { quotaPort } from "./port";

const args = process.argv.slice(2);
const source = resolve(args[0]);
const data = JSON.parse(await readFile(join(source, "result.json"), "utf8"));
const out = join(source, "blind-review");
await mkdir(out, { recursive: true });
const { llm } = await quotaPort(out, 6);
const text = data.pages.map((p: any) => `${p.title || ""}\n${p.content}`).join("\n\n");
const sourceHash = createHash("sha256").update(text).digest("hex");
const format = data.lane === "chapterbook" ? "Ein vollständiges Kapitelbuch mit acht Kapiteln für mehrere Abende." : data.lane === "storybook" || data.lane === "workshop" || data.result.unified?.format === "picture-book" ? "Eine vollständige kurze Geschichte in knappen Leseseiten; die Illustrationen fehlen in diesem reinen Texttest." : "Eine vollständige kurze Vorlesegeschichte in Kapiteln.";
const input = JSON.parse(await readFile(join(source, "input.json"), "utf8"));
const young = input.config.ageGroup === "3-5";
const request = {
  reader: `Kinder ${input.config.ageGroup}, deutsch. ${input.config.customPrompt}`,
  format,
  figures: input.candidates.map((c: any) => ({ name: c.name, want: c.want, fear: c.fear, comicPattern: c.comicPattern, canLead: c.canLead })),
  rubric: ROLE_QUALITY_RUBRIC,
  task: "Bewerte nur den vorliegenden Text. Bei leadingCharacterAgency zählt diejenige Figur, die der Text tatsächlich als Hauptfigur aufbaut; benenne sie. Dass die gewünschte Pool-Hauptrolle fehlt, ist zusätzlich eine Auftragsabweichung. Kein Längenbonus und keine erfundenen Leserreaktionen. Humor für Einschlaftexte an sanftem Schmunzeln messen. Zitate maximal 20 Wörter, wortgetreu aus dem Manuskript. Trenne literarische Qualität von Auftrags- und Format-Treue.",
  schema: { actualLead: "name", scores: Object.fromEntries(Object.keys(ROLE_QUALITY_RUBRIC).map(k => [k, { score: "0..10", reason: "konkret", quote: "wörtlich oder leer bei fehlendem Element" }])), requestFit: { score: "0..10", reasons: ["konkret"] }, formatFit: { score: "0..10", reasons: ["konkret"] }, strengths: ["übertragbare Stärke mit Textbeleg"], weaknesses: ["größte Schwäche mit Textbeleg"], transferableTechnique: "welche Technik lohnt sich für andere Geschichten?", verdict: "kurzes deutsches Lektoratsurteil" },
};
const results = [];
for (const model of ["gpt-6-luna", "gpt-6.1-sol"]) {
  const reviewRequest: any = { stage: "anonymous-literary-review", model, role: "critic", json: true, effort: "low", maxTokens: 6000, timeoutMs: 420_000,
    system: ROLE_REVIEW_SYSTEM + "\nDu erhältst ein einzelnes Manuskript ohne Pipeline- oder Modellnamen. Bewerte unabhängig. " + (young ? "Es ist eine ruhige Einschlafgeschichte; fordere keine lauten Gags oder Gefahr." : ""),
    user: `${JSON.stringify(request)}\n\nANONYMES MANUSKRIPT\n${text}` };
  let raw = (await llm(reviewRequest)).text;
  let review: any = parseJsonObject(raw);
  const validScores = (r: any) => Object.keys(ROLE_QUALITY_RUBRIC).every(key => Number.isFinite(r?.scores?.[key]?.score) && r.scores[key].score >= 0 && r.scores[key].score <= 10);
  if (!validScores(review)) {
    review = parseJsonObject((await llm({ ...reviewRequest, stage: "review-format-correction", user: reviewRequest.user + `\n\nDie vorherige Antwort war kein vollständiges JSON mit den acht geforderten numerischen scores. Gib die gesamte Bewertung strukturell korrekt erneut aus. Alle acht Kriterien gehören in scores; requestFit, formatFit, strengths, weaknesses und verdict stehen außerhalb von scores. Vorherige Antwort: ${raw}` })).text);
  }
  const quoteErrors = (r: any) => Object.keys(ROLE_QUALITY_RUBRIC).filter(k => r?.scores?.[k]?.quote && !text.replace(/\s+/g, " ").includes(r.scores[k].quote.replace(/\s+/g, " ")));
  const errors = quoteErrors(review);
  if (errors.length) {
    await writeFile(join(out, `${model}-invalid-evidence.json`), JSON.stringify(review, null, 2));
    review = parseJsonObject((await llm({ ...reviewRequest, stage: "evidence-correction", user: reviewRequest.user + `\n\nDeine vorherige Bewertung: ${JSON.stringify(review)}\nDie Zitate für ${errors.join(", ")} stehen nicht exakt so im Text. Prüfe auch deine Figurenzuordnung: Im Manuskript dürfen kanonische Namen abgekürzt sein (etwa Kicher für Kobold Kicher). Gib die gesamte sachlich geprüfte Bewertung erneut aus; behebe unbelegte Behauptungen und zitiere wortgetreu, ohne Abschnitte zusammenzusetzen. Kein höheres Rating als Belohnung für diese Korrektur.` })).text);
  }
  for (const key of Object.keys(ROLE_QUALITY_RUBRIC)) {
    const point = review?.scores?.[key];
    if (!point || !Number.isFinite(point.score) || point.score < 0 || point.score > 10) throw new Error(`Invalid score ${key}`);
  }
  const score = Object.entries(ROLE_QUALITY_RUBRIC).reduce((n, [key, weight]) => n + review.scores[key].score * weight / 100, 0);
  // Preserve and flag invalid evidence; it never becomes a verified citation.
  // One failed quote does not silently discard an unfavourable numeric score.
  results.push({ model, sourceHash, score: Math.round(score * 100) / 100, invalidEvidence: quoteErrors(review), review });
  await writeFile(join(out, "reviews.json"), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ source, mean: results.reduce((n, r) => n + r.score, 0) / results.length, reviews: results.map(r => ({ model: r.model, score: r.score })) }));
