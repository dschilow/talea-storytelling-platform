import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROLE_QUALITY_RUBRIC } from "./quality-rubric";

/** Standard short-context list prices checked against official model pages, 2026-10-26. USD / million tokens. */
export const ROLE_TEST_PRICES: Record<string, { input: number; cached: number; output: number; source: string }> = {
  "gpt-6.1-sol": { input: 2, cached: 0.10, output: 10, source: "https://developers.openai.com/api/docs/models/gpt-6.1-sol" },
  "gpt-6.1-terra": { input: 1, cached: 0.05, output: 5, source: "https://developers.openai.com/api/docs/models/gpt-6.1-terra" },
  "gpt-6-luna": { input: 0.10, cached: 0.01, output: 0.50, source: "https://developers.openai.com/api/docs/models/gpt-6-luna" },
};

export function apiEquivalent(model: string, usage: any) {
  const price = ROLE_TEST_PRICES[model.replace(/^openai\//, "")];
  if (!price) throw new Error(`Missing verified price: ${model}`);
  const input = usage.prompt || 0, output = usage.completion || 0;
  const cached = Math.min(input, usage.cachedPromptTokens || 0);
  return { input, output, cached,
    noCacheUSD: (input * price.input + output * price.output) / 1_000_000,
    reportedCacheUSD: ((input - cached) * price.input + cached * price.cached + output * price.output) / 1_000_000 };
}

const roleOf = (stage: string) => stage.includes("episode-plan") ? "planner" : stage.includes("episode-internal") ? "critic" : "writer";
const sum = (rows: any[], key: string) => rows.reduce((total, row) => total + row[key], 0);
const mean = (rows: any[], key: string) => sum(rows, key) / rows.length;
const de = (n: number, places = 2) => n.toFixed(places).replace(".", ",");
const usd = (n: number) => `$${de(n, 4)}`;

export async function writeSupportReport({ root, publication, rows, aggregate, judges }: {
  root: string; publication: string; rows: any[]; aggregate: any[]; judges: string[];
}) {
  const completed = rows.filter(r => !r.failed);
  const commonCases = [...new Set(rows.map(r => r.case))].filter(c => aggregate.every(a => completed.some(r => r.case === c && r.variant === a.id)));
  for (const row of rows) {
    row.roles = row.stages.map((s: any) => ({ stage: s.stage, role: roleOf(s.stage), model: s.modelUsed,
      seconds: (s.durationMs || 0) / 1000, ...apiEquivalent(s.modelUsed, s.usage) }));
    row.cost = { noCacheUSD: sum(row.roles, "noCacheUSD"), reportedCacheUSD: sum(row.roles, "reportedCacheUSD"), additionalApiInvoiceUSD: 0 };
    row.unsupportedInternalQuotes = (row.editorial.before?.unsupported?.length || 0) + (row.editorial.after?.unsupported?.length || 0);
  }
  const summary = aggregate.map(a => {
    const selected = rows.filter(r => r.variant === a.id);
    return { ...a, meanSeconds: mean(selected, "seconds"), meanCalls: mean(selected, "calls"),
      deliveredCount: selected.filter(r => !r.failed).length, attempts: selected.length,
      workSecondsPerDelivered: sum(selected, "seconds") / selected.filter(r => !r.failed).length,
      pairedMean: mean(selected.filter(r => !r.failed && commonCases.includes(r.case)), "mean"),
      meanApiEquivalentNoCacheUSD: mean(selected.map(r => r.cost), "noCacheUSD"),
      meanApiEquivalentReportedCacheUSD: mean(selected.map(r => r.cost), "reportedCacheUSD"),
      apiEquivalentPerDeliveredNoCacheUSD: sum(selected.map(r => r.cost), "noCacheUSD") / selected.filter(r => !r.failed).length,
      totalApiEquivalentNoCacheUSD: sum(selected.map(r => r.cost), "noCacheUSD"),
      editorialRevisions: selected.filter(r => r.editorial.revisionAccepted).length,
      planRepairs: selected.filter(r => r.stages.some((s: any) => s.stage === "episode-plan-repair")).length,
      unsupportedInternalQuotes: sum(selected, "unsupportedInternalQuotes"),
      roles: ["planner", "writer", "critic"].map(role => {
        const calls = selected.flatMap(r => r.roles).filter(r => r.role === role);
        return { role, calls: calls.length, totalSeconds: sum(calls, "seconds"), meanSecondsPerStory: sum(calls, "seconds") / selected.length,
          totalNoCacheUSD: sum(calls, "noCacheUSD"), meanNoCacheUSDPerStory: sum(calls, "noCacheUSD") / selected.length };
      }),
    };
  });
  const externalReviews = [];
  for (const c of ["magic", "fairytale", "bedtime"]) for (const judge of judges) {
    const review = JSON.parse(await readFile(join(root, "reviews", c, judge, "evaluation.json"), "utf8"));
    externalReviews.push({ case: c, judge, seconds: review.seconds, ...apiEquivalent(judge, review.usage) });
  }
  const totals = { generationCalls: sum(rows, "calls"), generationNoCacheUSD: sum(rows.map(r => r.cost), "noCacheUSD"),
    generationReportedCacheUSD: sum(rows.map(r => r.cost), "reportedCacheUSD"),
    externalReviewCalls: externalReviews.length, externalReviewNoCacheUSD: sum(externalReviews, "noCacheUSD"),
    externalReviewReportedCacheUSD: sum(externalReviews, "reportedCacheUSD"), additionalApiInvoiceUSD: 0 };
  const previousOneShot = [];
  for (const c of ["magic", "fairytale", "bedtime"]) {
    const old = JSON.parse(await readFile(join(root, "../../episode-model-comparison/2026-10-26", `${c}-sol-low`, "result.json"), "utf8"));
    previousOneShot.push({ case: c, seconds: old.seconds, calls: old.calls,
      noCacheUSD: old.stages.reduce((s: number, stage: any) => s + apiEquivalent(stage.modelUsed, stage.usage).noCacheUSD, 0) });
  }
  const ranking = [...summary].sort((a, b) => b.pairedMean - a.pairedMean);
  const overview = `| Planer und interne Prüfer | Schreiber / Überarbeitung | Qualität gemeinsame Fälle /10 | Geliefert | Ø Sekunden/Versuch | Ø API-Äquivalent/Versuch, ohne Cache | Ø Aufrufe/Versuch |\n|---|---|---:|---:|---:|---:|---:|\n${summary.map(a => `| ${a.support} Low | Sol 6.1 Low | ${de(a.pairedMean)} | ${a.deliveredCount}/${a.attempts} | ${de(a.meanSeconds, 0)} | ${usd(a.meanApiEquivalentNoCacheUSD)} | ${de(a.meanCalls, 1)} |`).join("\n")}`;
  const stories = `| Aufgabe | Planer/Prüfer | Geschichte | Wörter | Sol-Lektor | Terra-Lektor | Mittel /10 | Sekunden | API-Äquivalent ohne Cache | Aufrufe |\n|---|---|---|---:|---:|---:|---:|---:|---:|---:|\n${rows.map(r => r.failed
    ? `| ${r.caseLabel} | ${r.support} | **Abbruch nach Planreparatur** | — | — | — | — | ≈${r.seconds} | ${usd(r.cost.noCacheUSD)} | ${r.calls} |`
    : `| ${r.caseLabel} | ${r.support} | [${r.title}](${r.file}) | ${r.words} | ${de(r.ratings[0].score)} | ${de(r.ratings[1].score)} | ${de(r.mean)} | ${r.seconds} | ${usd(r.cost.noCacheUSD)} | ${r.calls} |`).join("\n")}`;
  const roles = `| Unterstützung | Rolle | Ø Sekunden/Folge | Ø API-Äquivalent/Folge ohne Cache | Aufrufe insgesamt |\n|---|---|---:|---:|---:|\n${summary.flatMap(a => a.roles.map((r: any) => `| ${a.support} | ${r.role} | ${de(r.meanSecondsPerStory, 1)} | ${usd(r.meanNoCacheUSDPerStory)} | ${r.calls} |`)).join("\n")}`;
  const internal = `| Unterstützung | Planreparaturen | Akzeptierte Lektoratsüberarbeitungen | Nicht wörtlich belegte interne Hinweise | Kapitel außerhalb Budget |\n|---|---:|---:|---:|---:|\n${summary.map(a => `| ${a.support} | ${a.planRepairs} | ${a.editorialRevisions}/${a.deliveredCount} | ${a.unsupportedInternalQuotes} | ${a.chaptersOutsideBudget}/${a.deliveredCount * 3} |`).join("\n")}`;
  const details = rows.map(r => {
    const stages = `| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |\n|---|---|---:|---:|---:|\n${r.roles.map((s: any) => `| ${s.stage} | ${s.model} | ${de(s.seconds, 1)} | ${s.input} / ${s.output} | ${usd(s.noCacheUSD)} |`).join("\n")}`;
    if (r.failed) return `### ${r.caseLabel} · ${r.support}: fehlgeschlagen\n\nKeine Geschichte und keine literarische Nullnote. ${r.error} Der erste Plan enthielt zwei neue Figuren, obwohl für 3–5 Jahre nur eine erlaubt ist. Die reguläre Reparatur lieferte ungültiges JSON; dadurch blieb kein auswertbarer Kapitelplan. Ein zusätzlicher Neustart wurde nicht zur Erfolgsauswahl verwendet. In diesem CLI-Transport ist natives JSON/Schema nicht erzwungen; ein nativer API-JSON-Modus könnte diesen konkreten Fehler verhindern. Die Kosten beider Planaufrufe zählen mit. Die ≈${r.seconds} Sekunden sind aus ihren gemessenen Modellzeiten rekonstruiert.\n\n${stages}`;
    return `### ${r.caseLabel} · ${r.support}\n\n[${r.title}](${r.file}) · ${r.perChapter.join(" / ")} Wörter je Kapitel.\n\n${r.ratings.map((j: any) => `**${j.judge}: ${de(j.score)}/10.** ${j.verdict}\n\n${j.findings.map((f: any) => `- **${f.severity}:** ${f.quote ? `„${f.quote}“` : "Kein Textbeleg (Element fehlt)"} – ${f.readerCost} Vorschlag: ${f.fix}`).join("\n")}\n\nBelegzitate außerhalb der Quelle: ${j.unsupportedQuotes.length}; über 25 Wörter: ${j.overlongQuotes.length}.`).join("\n\n")}\n\nInterne Überarbeitung: ${r.editorial.revisionAccepted ? "akzeptiert" : r.editorial.revisionAttempted ? "wegen Formfehlern verworfen" : "keine belegten größeren Fehler gemeldet"}. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.\n\n${stages}`;
  }).join("\n\n");
  const report = `# Talea-Folge: Sol als Autor, drei Besetzungen der Nebenrollen\n\n26. Oktober 2026. Neun neue Textläufe. **Höchste mittlere Blindnote in diesem Versuch: ${ranking[0].support}, ${de(ranking[0].mean)}/10.** Der Schreiber war in allen Stufen Sol 6.1 Low.\n\n${overview}\n\n## Wer machte im vorherigen Versuch was?\n\nDie frühere Untersuchung nutzte One-Shot: Das ausgewählte Schreibermodell plante still und schrieb selbst; ein Aufruf pro Geschichte. Es gab keinen separaten Modellplaner und keinen internen Modellprüfer. Die Formprüfung war deterministischer Programmcode. Luna war in unbenutzten Konfigurationsfeldern genannt, wurde aber nicht aufgerufen. Erst die getrennte Schlussbewertung nutzte Sol 6.1 und Terra 6.1 auf Mittel. Die neun damaligen Stufenprotokolle zeigen ausschließlich den jeweiligen Autor.\n\n## Neuer Versuchsaufbau\n\n1. Separater Plan, Figurenbibel und Kapitelstruktur: ausgewähltes Unterstützermodell auf Low, vorhandener Zwei-Schritt-Modus von talea-folge-v1. Eine strukturbezogene Planreparatur ist wie im Original erlaubt.\n2. Manuskript: Sol 6.1 Low, unveränderte produktive Autorenprompts. Der Schreiber sieht natürlich den je Variante unterschiedlichen Plan.\n3. Interne Textprüfung: ausgewähltes Unterstützermodell auf Low, identischer Prüfauftrag. Höchstens drei konkrete Probleme. Nicht wörtlich belegte Zitate werden gekennzeichnet und nicht zur Überarbeitung verwendet.\n4. Nur bei belegten größeren Fehlern: Sol 6.1 Low überarbeitet einmal vollständig. Eine Fassung mit mehr harten Formfehlern wird verworfen. Akzeptierte neue Fassungen werden vom selben Unterstützermodell noch einmal geprüft. Keine Endlosschleife.\n5. Separate Schlussbewertung: Sol und Terra auf Mittel, frische Kontexte, anonymisierte A/B/C-Texte und rotierende Reihenfolge. Die internen Urteile verändern diese Noten nicht.\n\nDie interne Lektoratsstufe ist eine **Versuchserweiterung**: Auch der vorhandene Zwei-Schritt-Kern hat von sich aus keinen Modellkritiker. Es wurde keine Produktionskonfiguration umgestellt. Es sind drei Rollenpakete (Planer und Prüfer wechseln zusammen), keine vollständige Kreuzung aller Planer-/Prüferkombinationen. Alle Textüberarbeitungen schreibt weiterhin Sol. Keine Bilder, Bildregie, Audio oder Persistenz; „alles andere“ bezieht sich hier auf die tatsächlich ausgeführten Textrollen.\n\nGleiche drei Leseraufträge, Familien, Figurenpool, Seeds, Kapitelbudgets und erste Planerprompts wie untereinander und dieselben Testfälle wie im vorherigen Versuch: Abenteuer, Märchen, Einschlafen. Die neue Architektur unterscheidet sich vom alten One-Shot; die Rollenpakete untereinander sind der kontrollierte Vergleich. Alle Ausgaben sind frisch. Die Rollenzuordnung jedes tatsächlichen Modellaufrufs und die Eingabe-/Quellhashes werden geprüft. Der vollständige Testcode ist mit den Läufen archiviert.\n\nBewertungsrubrik: Kausalität/Wunderregel und Hauptfigurenhandlung je 20 %, Ensemble, Stimmen, Humor/Wunder, Tempo, Vorlesbarkeit und Gefühl/Auflösung je 10 %. Drei Aufgaben und zwei Lektoren werden gleich gewichtet. Pro Aufgabe nur ein Lauf: ein beschreibender Pilot, keine statistische Absicherung. Beide Lektoren gehören zur selben Modellfamilie.\n\n## Kosten richtig lesen\n\n**Zusätzliche API-Rechnung dieses Versuchs: $0.** Alle Aufrufe laufen über das angemeldete Codex-Kontingent. Das Abonnement beziehungsweise dessen Verbrauch ist damit nicht kostenlos; ein genauer Geldbetrag oder Prozentsatz pro Lauf wird von diesem Transport nicht geliefert.\n\nDie Tabellen zeigen ein **rechnerisches API-Äquivalent der gemeldeten CLI-Tokens**, Standardtarif, USD, ohne Cacheabschläge. Formel je Aufruf: (Inputtokens × Inputpreis + Ausgabetokens × Ausgabepreis) / 1.000.000. Die CLI-Eingabe enthält Codex-Rahmeninstruktionen; Ausgabe kann Denktokens enthalten. Das ist keine gemessene Rechnung der nativen Talea-API und keine verlässliche Produktionskostenschätzung. Zusätzlich ist in ergebnisse.json ein Äquivalent mit den gemeldeten Cache-Treffern gespeichert. Cache-Schreibkosten, regionale Aufschläge und Flex-Rabatte sind nicht eingerechnet.\n\nOffizielle Standardpreise, am 26.10.2026 geprüft, je 1 Mio. Tokens: [Sol: $2 Input / $0,10 gecacht / $10 Output](${ROLE_TEST_PRICES["gpt-6.1-sol"].source}), [Terra: $1 / $0,05 / $5](${ROLE_TEST_PRICES["gpt-6.1-terra"].source}), [Luna: $0,10 / $0,01 / $0,50](${ROLE_TEST_PRICES["gpt-6-luna"].source}).\n\nHerstellung aller neun Folgen: ${totals.generationCalls} Aufrufe, rechnerisch ${usd(totals.generationNoCacheUSD)} ohne Cache. Die sechs externen Blindbewertungen kommen separat hinzu: ${usd(totals.externalReviewNoCacheUSD)} ohne Cache. Sie sind in den Pro-Folge-Herstellungskosten und -zeiten oben nicht enthalten. Tatsächlich zusätzliche API-Rechnung für beide Gruppen zusammen: $0.\n\nZeit ist gemessene Gesamtlaufzeit je Folge inklusive Planung, interner Prüfung und aller tatsächlich nötigen Reparaturen. Bis zu drei Rollenpakete laufen gleichzeitig; daher Praxisbeobachtung statt isoliertem Geschwindigkeitsbenchmark. Modellzeit je Rolle folgt unten. Eine längere Laufzeit kann auch durch zusätzliche Schreiberüberarbeitungen entstehen.\n\n## Alle neun Geschichten\n\n${stories}\n\n## Wo Zeit und Geldäquivalent entstehen\n\n${roles}\n\n${internal}\n\n## Einzelbewertungen und tatsächliche Aufrufe\n\n${details}\n\n## Reproduktion\n\n\`bun scripts/episode/model-comparison.ts --support-study --stage generate --variant support-sol\` (bzw. support-terra, support-luna). Danach \`--support-study --stage check\`, je Lektor \`--support-study --stage review --judge gpt-6.1-sol\` bzw. gpt-6.1-terra, abschließend \`--support-study --stage report\`. Rohantworten, ursprüngliche Pläne, Manuskripte vor der Lektoratsstufe, Prüfhinweise, Request-/Ereignisprotokolle und Zeiten: Logs/episode-support-comparison/2026-10-26.\n`;
  const baselineNote = `## Bezug zum vorherigen One-Shot\n\nSol Low allein erreichte im vorigen Versuch 7,87/10, durchschnittlich ${de(mean(previousOneShot, "seconds"), 0)} Sekunden und ${usd(mean(previousOneShot, "noCacheUSD"))} API-Äquivalent ohne Cache pro Folge bei einem Aufruf. Das sind dieselben drei Leseraufträge, aber andere Texte und ein anderer Blindvergleich; der Wert ist eine Orientierung, kein isolierter Nachweis des Nutzens einer zusätzlichen Pipeline-Stufe. Die drei neuen Rollenpakete untereinander wurden gemeinsam bewertet.\n\n`;
  const finalReport = report.replace("## Wer machte im vorherigen Versuch was?", `${baselineNote}## Wer machte im vorherigen Versuch was?`)
    .replace(`Neun neue Textläufe. **Höchste mittlere Blindnote in diesem Versuch: ${ranking[0].support}, ${de(ranking[0].mean)}/10.**`, `Neun neue Textläufe: **${completed.length} Geschichten und ${rows.length - completed.length} Abbruch. Höchste Blindnote über die ${commonCases.length} gemeinsam gelieferten Aufgaben: ${ranking[0].support}, ${de(ranking[0].pairedMean)}/10.**`)
    .replace("Drei Aufgaben und zwei Lektoren werden gleich gewichtet.", `Die gemeinsame Qualitätsnote vergleicht ausschließlich ${commonCases.join(" und ")}: Diese ${commonCases.length} Aufgaben wurden von allen drei Paketen geliefert. Beide Lektoren und diese Aufgaben zählen gleich. Die Einschlafgeschichten von Sol und Terra werden zusätzlich separat bewertet. Der fehlgeschlagene Luna-Fall erhält keine literarische Nullnote, sondern zählt bei Lieferquote, Zeit und Kosten.`)
    .replace("Herstellung aller neun Folgen:", "Herstellung aller neun Versuche einschließlich des Abbruchs:")
    .replace("## Alle neun Geschichten", "## Alle neun Versuche")
    .replace("Ø Sekunden/Folge", "Ø Sekunden/Versuch")
    .replace("Ø API-Äquivalent/Folge", "Ø API-Äquivalent/Versuch");
  const deliveryEconomics = `## Aufwand pro tatsächlich gelieferter Geschichte\n\nHier werden die Kosten und Arbeitszeiten aller drei Versuche durch die Zahl gelieferter Geschichten geteilt. Fehlversuche zählen also mit; beim Luna-Abbruch ist die Zeit aus den beiden Modellaufrufen rekonstruiert. Das ist kein isolierter Latenzwert eines einzelnen erfolgreichen Laufs.\n\n| Planer/Prüfer | Geliefert | Arbeitssekunden je gelieferter Geschichte | API-Äquivalent je gelieferter Geschichte ohne Cache |\n|---|---:|---:|---:|\n${summary.map(a => `| ${a.support} | ${a.deliveredCount}/${a.attempts} | ${de(a.workSecondsPerDelivered, 0)} | ${usd(a.apiEquivalentPerDeliveredNoCacheUSD)} |`).join("\n")}\n\n`;
  await writeFile(join(publication, "README.md"), finalReport
    .replace("## Bezug zum vorherigen One-Shot", "Die praktische Empfehlung und konkrete Textbelege stehen in der [zusätzlichen redaktionellen Einordnung](einordnung.md).\n\n## Bezug zum vorherigen One-Shot")
    .replace("## Wo Zeit und Geldäquivalent entstehen", `${deliveryEconomics}## Wo Zeit und Geldäquivalent entstehen`));
  await writeFile(join(publication, "ergebnisse.json"), JSON.stringify({ pipeline: "talea-folge-v1-two-step-plus-experimental-editor", rubric: ROLE_QUALITY_RUBRIC, prices: ROLE_TEST_PRICES, qualityCommonCases: commonCases, summary, rows, externalReviews, totals, previousOneShot }, null, 2));
  console.log(JSON.stringify({ summary, totals, publication, unsupportedFinalQuotes: rows.flatMap(r => r.ratings).reduce((s, r) => s + r.unsupportedQuotes.length, 0) }));
}
