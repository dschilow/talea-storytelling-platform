import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { LlmCallResult, LlmRequest } from "../../backend/story/storybook/llm";

/** Fixed before reading the baseline; pipeline self-scores are excluded. */
export const RUBRIC = {
  clarityAndCausality: 20,
  childAgency: 15,
  characterAndDialogue: 15,
  emotion: 10,
  humor: 10,
  pacingAndTension: 10,
  languageAndReadAloud: 10,
  originalityAndPayoff: 10,
} as const;

const normalize = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();

export async function evaluateStory(source: string, out: string, complete: (request: LlmRequest) => Promise<LlmCallResult>) {
  const folder = resolve(source);
  const story = await readFile(join(folder, "story.md"), "utf8");
  const input = JSON.parse(await readFile(join(folder, "input.json"), "utf8"));
  const brief = { config: input.config, avatars: input.avatars, poolCharacters: input.poolCharacters };
  const system = `Du bist ein strenger Kinderbuchlektor. Bewerte ausschließlich das vorliegende Manuskript und den Leserbrief. Du kennst weder Modell, Pipeline, Planung noch frühere Bewertungen. Keine Vermutungen über die Herkunft. Trenne literarische Qualität von erfüllten Formvorgaben. Eine hohe Dialogquote oder viele Adjektive sind kein Qualitätsbeleg.\n\nFeste Skala 0–10: 0 unbrauchbar; 3 schwer verständlich; 5 verständlich, aber schematisch oder blass; 6 brauchbar mit deutlichen Schwächen; 7 gut lesbar mit konkreten Schwächen; 8 stark und einprägsam; 9 außergewöhnlich gut mit nur kleinen Schwächen; 10 in allen Kriterien herausragend. Keine 9 nur für Fehlerfreiheit. Prüfe besonders, ob ein zuhörendes Kind die Ursache jedes magischen Effekts kennt, ob der Schluss ohne neue Regel gelingt, ob beide Kinder eigene entscheidende Beiträge leisten und ob ein Witz tatsächlich funktioniert.\n\nAntwort ausschließlich als JSON: {"dimensions": {${Object.keys(RUBRIC).map(key => `"${key}": {"score": number, "reason": string, "quote": string}`).join(", ")}}, "findings": [{"severity": "major"|"minor", "location": string, "quote": string, "readerCost": string, "fix": string}], "strongestMoment": {"quote": string, "reason": string}, "verdict": string}. Alle Zitate müssen wörtlich aus dem Manuskript stammen und höchstens 35 Wörter enthalten. Jede Note braucht eine inhaltliche Begründung. Findings nach Schwere sortieren, höchstens fünf. Ein leeres Zitat ist nur erlaubt, wenn du ausdrücklich das vollständige Fehlen eines Elements begründest. Schreibe auf Deutsch.`;
  const reviews = [];
  for (const model of ["gpt-6-luna", "gpt-6.1-sol"]) {
    const response = await complete({ stage: "editorial-review", role: "critic", model, system,
      user: `LESERBRIEF\n${JSON.stringify(brief)}\n\nMANUSKRIPT\n${story}`, json: true, maxTokens: 3600, effort: "low", timeoutMs: 180_000 });
    const parsed = JSON.parse(response.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    let weighted = 0;
    for (const [key, weight] of Object.entries(RUBRIC)) {
      const dim = parsed.dimensions?.[key];
      if (!dim || !Number.isFinite(dim.score) || dim.score < 0 || dim.score > 10) throw new Error(`Invalid score: ${model}/${key}`);
      weighted += dim.score * weight / 100;
    }
    const evidence = [...Object.values(parsed.dimensions), ...(parsed.findings || []), parsed.strongestMoment] as Array<{ quote: string }>;
    const unsupportedQuotes = evidence.map(item => item?.quote).filter(quote => quote && !normalize(story).includes(normalize(quote)));
    reviews.push({ model, overall: Number(weighted.toFixed(2)), unsupportedQuotes, ...parsed });
  }
  const report = { source: folder, rubric: RUBRIC, caveat: "Modelllektüren aus derselben Modellfamilie; keine Bewertung mit Kindern und kein unabhängiges menschliches Lektorat.", reviews };
  await writeFile(join(out, "evaluation.json"), JSON.stringify(report, null, 2));
  const rows = Object.keys(RUBRIC).map(key => `| ${key} | ${reviews.map(r => r.dimensions[key].score).join(" | ")} |`).join("\n");
  await writeFile(join(out, "evaluation.md"), `# Lektorat\n\n${report.caveat}\n\n| Kriterium | Luna | Sol 6.1 |\n| --- | ---: | ---: |\n${rows}\n| Gewichtete Note | ${reviews.map(r => r.overall).join(" | ")} |\n\n${reviews.map(r => `## ${r.model}\n\n${r.verdict}\n\n${r.findings.map((f: any) => `- **${f.severity}, ${f.location}:** „${f.quote}“ — ${f.readerCost} Änderung: ${f.fix}`).join("\n")}\n\nNicht belegte Zitate: ${r.unsupportedQuotes.length}`).join("\n\n")}\n`);
  console.log(JSON.stringify({ source: folder, reviews: reviews.map(r => ({ model: r.model, score: r.overall, unsupportedQuotes: r.unsupportedQuotes.length })) }));
}
