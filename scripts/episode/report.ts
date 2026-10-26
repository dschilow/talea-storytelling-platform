import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { ROLE_QUALITY_RUBRIC } from "./quality-rubric";

const root = resolve("Logs/episode-role-quality/2026-10-26");
const out = resolve("docs/story-examples/talea-folge-rollen-2026-10-26");
const groups = [
  { name: "Erstvergleich", slug: "ersttest", folder: root, ids: ["imp", "witch", "sleep"] },
  { name: "Nachprüfung", slug: "nachpruefung", folder: join(root, "validation"), ids: ["imp", "sleep"] },
];
const labels: Record<string, string> = { imp: "Kobold", witch: "Hexe", sleep: "Nachtgeschichte" };
const dimensionLabels: Record<string, string> = {
  causalityAndRule: "Verständlichkeit und Wunderregel", leadingCharacterAgency: "Handlungsmacht der Hauptfigur",
  ensembleContribution: "Beiträge der Avatare", voiceAndDialogue: "Stimmen und Dialog", humorAndWonder: "Humor und Wunder",
  pacing: "Tempo und Entwicklung", readAloud: "Vorlesesprache", emotionAndPayoff: "Gefühl und Auflösung",
};
const mean = (numbers: number[]) => Number((numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(3));
const num = (value: number) => value.toFixed(2).replace(".", ",");
const flat: any[] = [];
const pairs: any[] = [];
const summaries: any[] = [];
const generations: any[] = [];
await mkdir(out, { recursive: true });
for (const group of groups) {
  const reviews: any[] = [];
  for (const model of ["gpt-6-luna", "gpt-6.1-sol"]) {
    const names = [`comparison-want-${model}`, `comparison-want-${model}-retry1`, `comparison-want-${model}-retry2`];
    const path = names.map(name => join(group.folder, name, "evaluation.json")).find(existsSync);
    if (!path) throw new Error(`Missing completed review: ${group.name}/${model}`);
    const report = JSON.parse(await readFile(path, "utf8"));
    if (report.pipeline !== "talea-folge-v1" || report.model !== model || JSON.stringify(report.rubric) !== JSON.stringify(ROLE_QUALITY_RUBRIC)) throw new Error("Wrong pipeline/model or changed rubric");
    reviews.push(report);
  }
  const groupReads: any[] = [];
  for (const id of group.ids) {
    const reads = reviews.map(report => ({ model: report.model, ...report.reviews.find((r: any) => r.id === id) }));
    if (reads.some(r => !r.baseline || !r.candidate)) throw new Error(`Missing case ${id}`);
    for (const read of reads) { const row = { group: group.name, id, ...read }; flat.push(row); groupReads.push(row); }
    const files: Record<string, string> = {};
    const results: Record<string, any> = {};
    for (const [key, prefix] of [["baseline", "baseline"], ["candidate", "want"]]) {
      const folder = join(group.folder, `${prefix}-${id}`);
      const result = JSON.parse(await readFile(join(folder, "result.json"), "utf8"));
      if (result.pipeline !== "talea-folge-v1" || result.imagesGenerated || result.databaseCalls) throw new Error("Invalid generation provenance");
      results[key] = result;
      generations.push({ group: group.name, id, variant: key, title: result.result.title, words: result.words.reduce((sum: number, n: number) => sum + n, 0), calls: result.calls,
        hard: result.result.episode.checks.hard, soft: result.result.episode.checks.soft, seconds: result.seconds, effort: result.effort });
      const filename = `${group.slug}-${id}-${key === "baseline" ? "vorher" : "nachher"}.md`;
      await copyFile(join(folder, "story.md"), join(out, filename));
      files[key] = filename;
    }
    if (results.baseline.inputSHA256 !== results.candidate.inputSHA256 || results.baseline.seed !== results.candidate.seed || results.baseline.effort !== results.candidate.effort) throw new Error(`Unmatched generation pair ${id}`);
    pairs.push({ group: group.name, id, files, baseline: mean(reads.map(r => r.baseline.score)), candidate: mean(reads.map(r => r.candidate.score)), reads });
  }
  summaries.push({ group: group.name, pairs: group.ids.length, baseline: mean(groupReads.map(r => r.baseline.score)), candidate: mean(groupReads.map(r => r.candidate.score)) });
}
const summary = { pipeline: "talea-folge-v1", baseline: mean(flat.map(r => r.baseline.score)), candidate: mean(flat.map(r => r.candidate.score)),
  summaries, dimensions: Object.fromEntries(Object.keys(ROLE_QUALITY_RUBRIC).map(key => [key, {
    baseline: mean(flat.map(r => r.baseline.dimensions[key].score)), candidate: mean(flat.map(r => r.candidate.dimensions[key].score)),
  }])), preferredCandidate: flat.filter(r => r.preferred === "candidate").length, preferredBaseline: flat.filter(r => r.preferred === "baseline").length,
  ties: flat.filter(r => r.preferred === "tie").length, unsupportedQuotes: flat.reduce((sum, r) => sum + r.baseline.unsupportedQuotes.length + r.candidate.unsupportedQuotes.length, 0),
  improvedRatings: flat.filter(r => r.candidate.score > r.baseline.score).length,
  regressedRatings: flat.filter(r => r.candidate.score < r.baseline.score).length,
  generations, pairs };
const heroOld = JSON.parse(await readFile(join(root, "baseline-hero/gpt-6.1-sol/01-episode-oneshot.request.json"), "utf8"));
const heroNew = JSON.parse(await readFile(join(root, "want-hero-control/request.json"), "utf8"));
if (heroOld.system !== heroNew.system || heroOld.user !== heroNew.user) throw new Error("Avatar-mode prompts changed");
await copyFile(join(root, "baseline-hero/story.md"), join(out, "kontrolle-avatar.md"));
await writeFile(join(out, "ergebnisse.json"), JSON.stringify(summary, null, 2));
const table = pairs.map(pair => `| ${pair.group}: ${labels[pair.id]} | ${pair.reads.map((r: any) => `${num(r.baseline.score)} → ${num(r.candidate.score)}`).join(" | ")} | **${num(pair.baseline)} → ${num(pair.candidate)}** |`).join("\n");
const detailLinks = pairs.map(pair => `- ${pair.group}, ${labels[pair.id]}: [vorher](${pair.files.baseline}) · [nachher](${pair.files.candidate})`).join("\n");
const dims = Object.entries(summary.dimensions).map(([key, value]) => `| ${dimensionLabels[key]} | ${num(value.baseline)} | ${num(value.candidate)} |`).join("\n");
const text = [
  "# Talea-Folge: geprüfte Rollenoptimierung · 26. Oktober 2026", "",
  `Der tatsächliche Textkern **talea-folge-v1** wurde mit dem überarbeiteten Figurenpool geprüft. Über fünf gepaarte Fälle bewerten Luna und Sol 6.1 die Ausgangsfassungen im Mittel mit **${num(summary.baseline)}/10**, die Fassung mit verankertem Figurenwunsch mit **${num(summary.candidate)}/10**. Das ist ein Befund dieser kleinen Stichprobe, keine Garantie für jede Geschichte.`, "",
  "Der Autor war in allen Läufen **gpt-6.1-sol, effort=low**. Die Lektoren liefen in frischen, getrennten Kontexten. Verwendet wurde das vom Nutzer gewünschte Codex-Kontingent. **Keine Bilder, keine Produktivdatenbank, keine manuell umgeschriebenen Ergebnisgeschichten.**", "",
  "## Konkrete Änderung", "",
  "Wenn die Avatare Begleiter sind, wird der im Figurenprofil gelieferte Wunsch der ausgewählten Hauptfigur ausdrücklich als Handlungsmotor eingesetzt. Die Tages-Kindersituation darf ihn zuspitzen, aber nicht durch eine beliebige Lektion oder eine neu erfundene Bindung an einen Gegenstand ersetzen. Das betrifft `backend/story/episode/cast-focus.ts` und gilt im One-shot wie im Plan-/Autorenmodus.", "",
  "Anlass war die ursprüngliche Hexengeschichte: Statt des Wunsches nach einem würdigen Rätselgegner stand ein alter Umhang im Mittelpunkt. Mit der Änderung wird der neue Konflikt durch das Rätselduell und den Aufbruch ihres Gegners verursacht. Die Figur hat dadurch einen erkennbaren eigenen Antrieb.", "",
  "Die Produktionskette bekommt dafür keinen weiteren Modellaufruf und keine höhere Denkstufe. Die übrige Rollensteuerung lässt die Avatare mit eigenen entscheidenden Beiträgen mitwirken. Die Änderung ist lokal umgesetzt, noch nicht veröffentlicht.", "",
  "## Ergebnisse", "",
  "| Fall | Luna: vorher → nachher | Sol 6.1: vorher → nachher | Mittel |", "| --- | ---: | ---: | ---: |", table,
  `| Gesamt, alle fünf Paare | | | **${num(summary.baseline)} → ${num(summary.candidate)}** |`, "",
  ...summaries.map(row => `${row.group}: **${num(row.baseline)} → ${num(row.candidate)}** über ${row.pairs} Paare.`), "",
  "Die Nachprüfung verwendet zwei neue Seeds nach dem Formulieren der Änderung. Der Seed steuert die Auswahl der Tagesvorgaben; er macht die Modellantworten nicht deterministisch. Innerhalb jedes Paares blieben Profile, Wünsche, Altersband, Längenvorgabe, Seed und Effort gleich. Die zweite Ausgangsgruppe wurde mit dem vorigen Prompt rekonstruiert; diese Rekonstruktion wurde gegen einen gespeicherten Erstprompt auf exakte Gleichheit geprüft.", "",
  "## Geschichten zum Nachlesen", "", detailLinks, "- [Avatar-Hauptrollen als Kontrollfall](kontrolle-avatar.md)", "",
  "Der Avatar-Kontrollfall wurde einmal erzeugt; nach der Änderung sind System- und Nutzerprompt dieser Einstellung exakt identisch. Er wird nicht als zusätzliches unabhängiges A/B-Paar in die Gesamtnote eingerechnet.", "",
  "## Kriterien", "",
  "Die Rubrik wurde vor den Ausgangsläufen festgelegt: Kausalität/Regel und Handlungsmacht je 20 %, Ensemble, Stimmen/Dialog, Humor/Wunder, Tempo, Vorlesesprache und Gefühl/Auflösung je 10 %. Die frühere 7,45/10 aus dem ersten Talea-Folge-Test beruht auf anderen Fällen und einer anderen Rubrik; sie ist kein Vergleichswert für diese Tabelle.", "",
  "| Kriterium | Vorher | Nachher |", "| --- | ---: | ---: |", dims, "",
  `${summary.improvedRatings} der zehn gewichteten Einzelnoten stiegen, ${summary.regressedRatings} fielen. Bei der zusätzlich gefragten freien Präferenz entfielen ${summary.preferredCandidate} Stimmen auf die neue, ${summary.preferredBaseline} auf die alte Fassung und ${summary.ties} auf Gleichstand. Freie Präferenz und gewichtete Note können auseinandergehen; beide sind deshalb getrennt erfasst.`, "",
  "## Grenzen und verbleibende Schwächen", "",
  "Fünf Paare und zwei Modelle derselben Familie sind keine statistische Absicherung und kein Test mit Kindern. Beide Verfahren sind subjektive Modelllektüren. Einzelne neue Fassungen können schwächer abschneiden, auch wenn der Durchschnitt steigt. Die Autorenantworten variieren trotz gleicher Vorgaben.", "",
  `Die Prüfung fand ${summary.unsupportedQuotes} nicht exakt belegte Zitate. Außerdem waren einzelne Detailvorwürfe ungenau, etwa die Behauptung, der Käfer bekomme im ursprünglichen Hexentext das ganze Tor geschenkt. Solche Aussagen wurden nicht blind in Änderungen umgesetzt.`, "",
  "Wiederholte Befreiungsversuche, eine gelegentlich aufgesetzt wirkende Erwachsenenbegegnung und die Hand-/Gegenstandslogik bei viel Slapstick bleiben redaktionelle Prüfpunkte. Formale Fehlerfreiheit allein ist kein Beleg für eine gute Vorlesegeschichte. Langfristige Abwechslung über viele Familiengeschichten wurde hier nicht gemessen.", "",
  "## Technischer Nachweis", "",
  `Es gibt ${generations.length} vollständige Generierungen in den bewerteten Paaren plus die Avatar-Kontrolle. Die einzelnen Wortzahlen, Autorenaufrufe und Prüfmeldungen stehen in ergebnisse.json. Manifeste, Quellen-Snapshots, tatsächliche Modellrequests, A/B-Zuordnung, Rohlektüren und Zitatprüfung liegen unter Logs/episode-role-quality/2026-10-26/.`, "",
  "Ein Sol-Lektorat erhielt zunächst HTTP 429 und wurde nach einer Pause mit demselben Auftrag wiederholt. Eine begonnene Nachprüfung traf später das Codex-Kontingentlimit; nach dem Nutzerwunsch „weiter“ und wieder verfügbarer regulärer Nutzung wurde sie fortgesetzt. Es wurden weder zusätzliche Credits gekauft noch Reset-Gutschriften eingesetzt oder andere Modelle untergeschoben. Fehlgeschlagene Transporte wurden nicht literarisch bewertet.", "",
  "Die Anwendung samt Datenbank, Bildern, Speicherung und Avatarentwicklungen wurde nicht als angemeldeter Live-Ablauf geprüft. Die gesonderte Importkorrektur muss vor dem Einspielen des Figurenexports bereitgestellt sein, damit bestehende Figuren-Origins erhalten bleiben.", "",
  "Die lokalen Regressionstests für Episode, Storybook, Figurenimport und Origins sind separat in Logs/episode-role-quality/2026-10-26/unit-tests.log dokumentiert. Der vollständige Anwendungsbuild ist wegen der zuvor festgestellten Sandbox-Verzeichnissperren nicht bestätigt; die berührten Laufzeitdateien wurden syntaktisch geprüft.", "",
].join("\n");
await writeFile(join(out, "README.md"), text);
console.log(JSON.stringify({ baseline: summary.baseline, candidate: summary.candidate, groups: summaries,
  preferredCandidate: summary.preferredCandidate, preferredBaseline: summary.preferredBaseline, ties: summary.ties, out }));
