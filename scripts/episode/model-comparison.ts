/** Reproducible text-only Sol/Terra trial. All inference uses the signed-in Codex quota. */
import { mkdir, readFile, readdir, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { codexPort } from "../wonder-story/codex-port";
import { ROLE_QUALITY_RUBRIC, ROLE_REVIEW_SYSTEM } from "./quality-rubric";

const args = process.argv.slice(2);
const opt = (key: string, fallback: string) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const supportStudy = args.includes("--support-study");
const root = resolve(opt("--root", supportStudy ? "Logs/episode-support-comparison/2026-10-26" : "Logs/episode-model-comparison/2026-10-26"));
const publication = resolve(supportStudy ? "docs/story-examples/sol-support-6.1-2026-10-26" : "docs/story-examples/sol-terra-6.1-2026-10-26");
const pool = resolve("exports/character-pool/2026-10-26/talea-characters-2026-10-26-optimiert.json");
const variants: Array<{ id: string; model: string; effort: string; label: string; support?: string }> = supportStudy ? [
  { id: "support-sol", model: "gpt-6.1-sol", effort: "low", support: "gpt-6.1-sol", label: "Sol schreibt · Sol plant/prüft" },
  { id: "support-terra", model: "gpt-6.1-sol", effort: "low", support: "gpt-6.1-terra", label: "Sol schreibt · Terra plant/prüft" },
  { id: "support-luna", model: "gpt-6.1-sol", effort: "low", support: "gpt-6-luna", label: "Sol schreibt · Luna plant/prüft" },
] : [
  { id: "sol-low", model: "gpt-6.1-sol", effort: "low", label: "Sol 6.1 Low" },
  { id: "terra-low", model: "gpt-6.1-terra", effort: "low", label: "Terra 6.1 Low" },
  { id: "terra-medium", model: "gpt-6.1-terra", effort: "medium", label: "Terra 6.1 Mittel" },
];
const cases = [
  { id: "magic", label: "Magisches Abenteuer", poolLead: true },
  { id: "fairytale", label: "Lustiges Märchen", poolLead: true },
  { id: "bedtime", label: "Einschlafgeschichte", poolLead: false },
] as const;
const judges = ["gpt-6.1-sol", "gpt-6.1-terra"];
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const loadJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const norm = (s: string) => s.normalize("NFC").replace(/[„“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const folder = (id: string, variant: string) => join(root, `${id}-${variant}`);
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const n = (v: number) => v.toFixed(2).replace(".", ",");
await mkdir(root, { recursive: true });
const stage = opt("--stage", "generate");

if (stage === "generate") {
  const plan = { pipeline: "talea-folge-v1", created: "2026-10-26", variants, cases, judges,
    length: "medium", rubric: ROLE_QUALITY_RUBRIC, transport: "codex-chatgpt-plan", pool,
    note: supportStudy
      ? "Nine fresh outputs. Sol Low writes and rewrites. Planner and both internal reviewers use the selected support model at Low. Production two-step plus experimental bounded editorial pass; one revision on supported major issues, then recheck. Same first planner prompts per case. External blinded judges fixed at Medium and excluded from generation costs/time. No manual story editing."
      : "Nine fresh outputs; identical first prompts within each case. Production one-shot and its one permitted hard-check revision. No manual literary editing. Review effort medium. Model/effort absent from judges' inputs. Descriptive small-sample test; no significance claims." };
  await writeFile(join(root, "plan.json"), JSON.stringify(plan, null, 2));
  const chosen = variants.find(v => v.id === opt("--variant", ""));
  if (!chosen) throw new Error("Select --variant sol-low|terra-low|terra-medium");
  for (const c of cases) {
    const out = folder(c.id, chosen.id);
    try {
      const old = await loadJson(join(out, "result.json"));
      if (old.writer !== chosen.model || old.effort !== chosen.effort || old.seed !== `terra-sol-2026-10-26-${c.id}` || (supportStudy && (old.planner !== chosen.support || !old.experimentalEditorialPass))) throw new Error("Different saved generation");
      console.log(`Saved ${c.id}/${chosen.id}: ${old.result.title}`);
      continue;
    } catch (error: any) { if (error.code !== "ENOENT") throw error; }
    if (supportStudy) {
      let savedFailure;
      try { savedFailure = await loadJson(join(out, "failure.json")); }
      catch (error: any) { if (error.code !== "ENOENT") throw error; }
      if (savedFailure) {
        if (savedFailure.writer !== chosen.model || savedFailure.planner !== chosen.support || savedFailure.seed !== `terra-sol-2026-10-26-${c.id}`) throw new Error("Different saved failure");
        console.log(`Saved failed trial ${c.id}/${chosen.id}; use a new --root for a fresh experiment.`);
        continue;
      }
    }
    const command = [process.execPath, "scripts/episode/quota-test.ts", "--case", c.id, "--writer", chosen.model,
      "--effort", chosen.effort, "--length", "medium", "--seed", `terra-sol-2026-10-26-${c.id}`,
      "--pool", pool, "--max-calls", supportStudy ? "8" : "2", "--out", out, ...(c.poolLead ? ["--pool-lead"] : []),
      ...(supportStudy ? ["--mode", "two-step", "--support", chosen.support!, "--internal-review"] : [])];
    const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
    if (await child.exited !== 0) throw new Error(`Generation failed: ${c.id}/${chosen.id}; stopped this queue.`);
  }
} else if (stage === "check") {
  const provenance: any[] = [];
  for (const c of cases) {
    const records = await Promise.all(variants.map(async v => {
      const out = folder(c.id, v.id);
      let result;
      try { result = await loadJson(join(out, "result.json")); }
      catch (error: any) {
        if (!supportStudy || error.code !== "ENOENT") throw error;
        result = { ...await loadJson(join(out, "failure.json")), failed: true };
      }
      const firstModel = supportStudy ? v.support! : v.model;
      const firstStage = supportStudy ? "episode-plan" : "episode-oneshot";
      const req = await loadJson(join(out, firstModel, `01-${firstStage}.request.json`));
      if (result.pipeline !== "talea-folge-v1" || result.writer !== v.model || req.actualModel !== firstModel || req.model !== `openai/${firstModel}` || req.effort !== v.effort || result.imagesGenerated || result.databaseCalls) throw new Error("Invalid provenance");
      const events = (await readFile(join(out, firstModel, `01-${firstStage}.events.jsonl`), "utf8")).trim().split(/\r?\n/).map(line => JSON.parse(line));
      if (!events.some(e => e.type === "turn.completed") || events.some(e => e.type === "turn.failed")) throw new Error("Missing successful model turn");
      const toolItems = events.filter(e => e.item?.type && !["reasoning", "agent_message", "error"].includes(e.item.type));
      if (toolItems.length) throw new Error(`Unexpected tool use in text-only trial: ${JSON.stringify(toolItems.map(e => e.item.type))}`);
      if (supportStudy) {
        if (result.mode !== "two-step" || result.planner !== v.support || result.internalCritic !== v.support || !result.experimentalEditorialPass) throw new Error("Wrong role assignment");
        let requestCount = 0;
        for (const model of new Set([v.model, v.support!])) {
          let files: string[];
          try { files = await readdir(join(out, model)); }
          catch (error: any) { if (result.failed && error.code === "ENOENT") continue; throw error; }
          for (const file of files) if (file.endsWith(".request.json")) {
            const recorded = await loadJson(join(out, model, file));
            const expected = /episode-plan|episode-internal/.test(recorded.stage) ? v.support : v.model;
            if (recorded.actualModel !== expected || recorded.model !== `openai/${expected}` || recorded.effort !== "low") throw new Error("Unexpected stage model or effort");
            const stageEvents = (await readFile(join(out, model, file.replace(".request.json", ".events.jsonl")), "utf8")).trim().split(/\r?\n/).map(line => JSON.parse(line));
            if (!stageEvents.some(e => e.type === "turn.completed") || stageEvents.some(e => e.type === "turn.failed" || (e.item?.type && !["reasoning", "agent_message", "error"].includes(e.item.type)))) throw new Error("Invalid stage turn");
            requestCount++;
          }
        }
        if (requestCount !== result.calls || result.calls !== result.stages.length) throw new Error("Incomplete call ledger");
      }
      return { id: v.id, promptSHA256: hash([req.system, req.user]), inputSHA256: result.inputSHA256,
        pipelineSHA256: result.pipelineSHA256, words: result.words || [], calls: result.calls,
        failed: Boolean(result.failed), error: result.error,
        hard: result.result?.episode.checks.hard || [], soft: result.result?.episode.checks.soft || [] };
    }));
    for (const key of ["promptSHA256", "inputSHA256", "pipelineSHA256"] as const) if (new Set(records.map(r => r[key])).size !== 1) throw new Error(`Unmatched ${c.id}/${key}`);
    provenance.push({ case: c.id, records });
  }
  await writeFile(join(root, "provenance-check.json"), JSON.stringify(provenance, null, 2));
  console.log(JSON.stringify(provenance));
} else if (stage === "review") {
  const judge = opt("--judge", "");
  if (!judges.includes(judge)) throw new Error("Invalid judge");
  const judgeIndex = judges.indexOf(judge);
  for (const [caseIndex, c] of cases.entries()) {
    if (opt("--case", "all") !== "all" && opt("--case", "all") !== c.id) continue;
    const out = join(root, "reviews", c.id, judge);
    await mkdir(out, { recursive: true });
    const offset = (caseIndex + judgeIndex) % variants.length;
    let order = [...variants.slice(offset), ...variants.slice(0, offset)];
    if (judgeIndex) order.reverse();
    if (supportStudy) {
      const available = [];
      for (const v of order) {
        try { await readFile(join(folder(c.id, v.id), "story.md"), "utf8"); available.push(v); }
        catch (error: any) {
          if (error.code !== "ENOENT") throw error;
          const failed = await loadJson(join(folder(c.id, v.id), "failure.json"));
          if (failed.planner !== v.support || !failed.error) throw new Error("Unknown missing story");
        }
      }
      order = available;
    }
    if (order.length < 2) throw new Error("Need at least two delivered stories for a comparison");
    const stories: Record<string, string> = {};
    for (const [i, v] of order.entries()) stories[String.fromCharCode(65 + i)] = await readFile(join(folder(c.id, v.id), "story.md"), "utf8");
    const input = await loadJson(join(folder(c.id, variants[0].id), "input.json"));
    const brief = { age: input.config.ageGroup, genre: input.config.genre, wish: input.config.customPrompt,
      leadingFigure: c.poolLead ? input.poolCharacters.find((r: any) => r.canLead)?.name : input.avatars.map((r: any) => r.name).join(" und "),
      avatars: input.avatars.map(({ name, description }: any) => ({ name, description })),
      figures: input.poolCharacters.map(({ name, want, fear, speechStyle, runningGag }: any) => ({ name, want, fear, speechStyle, runningGag })) };
    const shape = { dimensions: Object.fromEntries(Object.keys(ROLE_QUALITY_RUBRIC).map(key => [key, { score: 0, reason: "..." }])),
      findings: [{ severity: "major|minor", quote: "...", readerCost: "...", fix: "..." }], strongest: { quote: "...", reason: "..." }, verdict: "..." };
    const originalUser = `Lies alle drei unabhängigen Manuskripte A, B und C. Bewerte jede Fassung absolut mit derselben festen Rubrik. Keine Herkunftsvermutungen. Länge erhält keinen Bonus. Begründungen je Kriterium höchstens 15 Wörter. Pro Fassung höchstens zwei gewichtige Schwächen und ein starker Moment. Zitiere nur wörtliche zusammenhängende Textstellen (höchstens 25 Wörter), keine Ellipsen. Bewerte nur den Text, nicht den unsichtbaren Plan. Achte auf eine konsistente Wunderregel, eigenständige Figurenwünsche, echte Eskalation, kindlich verständliche Komik und vorbereitete Auflösung. Einschlafen braucht ruhige Entwicklung ohne Gefahr. Bei Gleichstand ist ein geteiltes Ranking erlaubt.\nJSON-Form: ${JSON.stringify({ A: shape, B: shape, C: shape, ranking: [["A"], ["B", "C"]], comparison: "konkreter Vergleich" })}\nLESERAUFTRAG\n${JSON.stringify(brief)}\nMANUSKRIPTE\n${JSON.stringify(stories)}`;
    const user = order.length === 3 ? originalUser : originalUser.replace("alle drei unabhängigen Manuskripte A, B und C", "die beiden unabhängigen Manuskripte A und B")
      .replace(JSON.stringify({ A: shape, B: shape, C: shape, ranking: [["A"], ["B", "C"]], comparison: "konkreter Vergleich" }), JSON.stringify({ A: shape, B: shape, ranking: [["A"], ["B"]], comparison: "konkreter Vergleich" }));
    const promptHash = hash([ROLE_REVIEW_SYSTEM, user, judge, "medium"]);
    try {
      const saved = await loadJson(join(out, "evaluation.json"));
      if (saved.promptHash !== promptHash) throw new Error("Saved review differs");
      console.log(`Saved review ${c.id}/${judge}`);
      continue;
    } catch (error: any) { if (error.code !== "ENOENT") throw error; }
    await writeFile(join(out, "blind-order.json"), JSON.stringify(order.map((v, i) => ({ label: String.fromCharCode(65 + i), variant: v.id })), null, 2));
    const request = { stage: "three-way-blind-review", role: "critic" as const, model: judge,
      system: ROLE_REVIEW_SYSTEM, user, json: true, effort: "medium" as const, maxTokens: 6500, timeoutMs: 420_000 };
    let response;
    try {
      const previous = await loadJson(join(out, "response.json"));
      if (previous.promptHash !== promptHash) throw new Error("Saved response differs");
      response = previous.response;
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
      response = await codexPort(out, judge)(request);
      await writeFile(join(out, "response.json"), JSON.stringify({ promptHash, response }, null, 2));
    }
    const parsed = JSON.parse(response.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const ratings = order.map((v, i) => {
      const label = String.fromCharCode(65 + i), r = parsed[label];
      let score = 0;
      for (const [key, weight] of Object.entries(ROLE_QUALITY_RUBRIC)) {
        const d = r?.dimensions?.[key];
        if (!d || !Number.isFinite(d.score) || d.score < 0 || d.score > 10 || !d.reason) throw new Error(`Invalid ${label}/${key}`);
        score += d.score * weight / 100;
      }
      const evidence = [...(r.findings || []), r.strongest];
      const unsupportedQuotes = evidence.map((f: any) => f?.quote).filter((q: any) => q && !norm(stories[label]).includes(norm(q)));
      const overlongQuotes = evidence.map((f: any) => f?.quote).filter((q: any) => q && q.trim().split(/\s+/).length > 25);
      return { variant: v.id, label, ...r, score: Number(score.toFixed(2)), unsupportedQuotes, overlongQuotes };
    });
    if (!Array.isArray(parsed.ranking) || parsed.ranking.flat().sort().join("") !== Object.keys(stories).sort().join("")) throw new Error("Invalid ranking");
    await writeFile(join(out, "evaluation.json"), JSON.stringify({ case: c.id, judge, effort: "medium", promptHash,
      rubric: ROLE_QUALITY_RUBRIC, ratings, ranking: parsed.ranking, comparison: parsed.comparison, usage: response.usage, seconds: response.durationMs / 1000 }, null, 2));
    console.log(JSON.stringify({ case: c.id, judge, ratings: ratings.map(r => ({ variant: r.variant, score: r.score, unsupportedQuotes: r.unsupportedQuotes.length })) }));
  }
} else if (stage === "report") {
  await loadJson(join(root, "provenance-check.json"));
  await mkdir(publication, { recursive: true });
  let quoteErrata: any[] = [];
  try { quoteErrata = await loadJson(join(publication, "zitatkorrekturen.json")); }
  catch (error: any) { if (error.code !== "ENOENT") throw error; }
  const rows: any[] = [];
  for (const c of cases) {
    const reviews = await Promise.all(judges.map(j => loadJson(join(root, "reviews", c.id, j, "evaluation.json"))));
    for (const v of variants) {
      let result;
      try { result = await loadJson(join(folder(c.id, v.id), "result.json")); }
      catch (error: any) {
        if (!supportStudy || error.code !== "ENOENT") throw error;
        const failure = await loadJson(join(folder(c.id, v.id), "failure.json"));
        rows.push({ case: c.id, caseLabel: c.label, variant: v.id, variantLabel: v.label, support: v.support,
          failed: true, error: failure.error, words: 0, perChapter: [], calls: failure.calls, revised: false,
          seconds: Math.round(failure.stages.reduce((s: number, stage: any) => s + stage.durationMs, 0) / 1000),
          timeBasis: "sum of recorded model durations; failure did not record wall-clock duration",
          stages: failure.stages, editorial: {}, planRepaired: failure.stages.some((s: any) => s.stage === "episode-plan-repair"),
          checks: { hard: [], soft: [] }, chapterBudget: [], chaptersOutsideBudget: 0, ratings: [], mean: null,
          usage: failure.stages.reduce((sum: any, s: any) => ({ prompt: sum.prompt + s.usage.prompt, completion: sum.completion + s.usage.completion }), { prompt: 0, completion: 0 }) });
        continue;
      }
      const brief = await loadJson(join(folder(c.id, v.id), "brief.json"));
      const ratings = reviews.map(r => ({ judge: r.judge, ...r.ratings.find((x: any) => x.variant === v.id) }));
      if (ratings.some(r => !Number.isFinite(r.score))) throw new Error("Missing rating");
      const manuscript = await readFile(join(folder(c.id, v.id), "story.md"), "utf8");
      for (const rating of ratings) {
        rating.quoteCorrections = quoteErrata.filter(e => e.case === c.id && e.judge === rating.judge && e.variant === v.id);
        for (const correction of rating.quoteCorrections) {
          const item = correction.field === "strongest" ? rating.strongest : rating.findings[Number(correction.field.replace("finding:", ""))];
          if (item?.quote !== correction.original || !norm(manuscript).includes(norm(correction.corrected)) || correction.corrected.split(/\s+/).length > 25) throw new Error("Invalid quotation correction");
          item.quote = correction.corrected;
        }
        const evidence = [...rating.findings, rating.strongest];
        rating.unsupportedQuotes = evidence.map(f => f.quote).filter(q => q && !norm(manuscript).includes(norm(q)));
      }
      const file = `${c.id}-${v.id}.md`;
      await copyFile(join(folder(c.id, v.id), "story.md"), join(publication, file));
      rows.push({ case: c.id, caseLabel: c.label, variant: v.id, variantLabel: v.label, title: result.result.title,
        file, words: result.words.reduce((a: number, b: number) => a + b, 0), perChapter: result.words,
        calls: result.calls, revised: result.result.episode.revised, checks: result.result.episode.checks, seconds: result.seconds,
        chapterBudget: [brief.budget.wordsPerPageMin, brief.budget.wordsPerPageMax],
        chaptersOutsideBudget: result.words.filter((w: number) => w < brief.budget.wordsPerPageMin || w > brief.budget.wordsPerPageMax).length,
        usage: result.usage, ...(supportStudy ? { support: v.support, stages: result.stages, editorial: result.editorial, planRepaired: result.result.planRepaired } : {}), ratings, mean: Number(average(ratings.map(r => r.score)).toFixed(3)) });
    }
  }
  const aggregate = variants.map(v => {
    const own = rows.filter(r => r.variant === v.id);
    const delivered = own.filter(r => !r.failed);
    return { ...v, mean: average(delivered.map(r => r.mean)), byJudge: judges.map(j => ({ judge: j, mean: average(delivered.map(r => r.ratings.find((x: any) => x.judge === j).score)) })),
      hardFailures: own.filter(r => r.checks.hard.length).length, revisions: own.filter(r => r.revised).length,
      chaptersOutsideBudget: own.reduce((sum, r) => sum + r.chaptersOutsideBudget, 0),
      seconds: own.reduce((sum, r) => sum + r.seconds, 0), inputTokens: own.reduce((sum, r) => sum + (r.usage.prompt || 0), 0), outputTokens: own.reduce((sum, r) => sum + (r.usage.completion || 0), 0) };
  });
  if (supportStudy) {
    const { writeSupportReport } = await import("./support-report");
    await writeSupportReport({ root, publication, rows, aggregate, judges });
    process.exit(0);
  }
  const table = `| Aufgabe | Variante / Geschichte | Wörter | Sol-Lektorat | Terra-Lektorat | Mittel /10 | Überarbeitet |\n|---|---|---:|---:|---:|---:|---|\n${rows.map(r => `| ${r.caseLabel} | ${r.variantLabel}: [${r.title}](${r.file}) | ${r.words} | ${n(r.ratings[0].score)} | ${n(r.ratings[1].score)} | ${n(r.mean)} | ${r.revised ? "ja" : "nein"} |`).join("\n")}`;
  const summary = `| Variante | Mittel /10 | Sol-Lektorat | Terra-Lektorat | Überarbeitungen | Harte Restfehler | Generierungszeit gesamt |\n|---|---:|---:|---:|---:|---:|---:|\n${aggregate.map(a => `| ${a.label} | ${n(a.mean)} | ${n(a.byJudge[0].mean)} | ${n(a.byJudge[1].mean)} | ${a.revisions} | ${a.hardFailures} | ${a.seconds} s |`).join("\n")}`;
  const findings = rows.map(r => `## ${r.caseLabel} · ${r.variantLabel}\n\n[${r.title}](${r.file}) · Kapitelwörter: ${r.perChapter.join(" / ")} · ${r.seconds} s · ${r.calls} Autorenaufruf(e).\n\n${r.ratings.map((j: any) => `**${j.judge}: ${n(j.score)}/10.** ${j.verdict}\n\n${j.findings.map((f: any) => `- **${f.severity}:** „${f.quote}“ – ${f.readerCost} Vorschlag: ${f.fix}`).join("\n")}\n\nStarker Moment: „${j.strongest.quote}“ – ${j.strongest.reason}\n\nNicht belegte Zitate: ${j.unsupportedQuotes.length}; Zitate über 25 Wörter: ${j.overlongQuotes.length}.`).join("\n\n")}\n\nDeterministische Resthinweise: ${JSON.stringify(r.checks)}.`).join("\n\n");
  const report = `# Talea-Folge: Sol 6.1 gegen Terra 6.1\n\n26. Oktober 2026. Neun neu generierte Folgen, drei identische Aufgaben je Modellvariante.\n\n${summary}\n\n## Methode\n\nDer produktive Textkern **talea-folge-v1**, One-Shot, unveränderte aktuelle Autorenprompts und Figurenpool. Sol Low ist die bisherige Standardkonfiguration; Terra läuft auf Low und Mittel. Pro Aufgabe exakt derselbe erste System- und Nutzerprompt, Eingabehash, Seed und Pipelinehash (automatisch geprüft). Unterschiedlich sind ausschließlich Autorenmodell und Denkstufe. Seeds legen die Vorgaben fest, garantieren keine deterministische Modellausgabe. Drei Kapitel; Abenteuer und Märchen 600–800 Wörter je Kapitel, Einschlafen 170–260. Der normale Textweg darf bei harten Formfehlern einmal überarbeiten; Bewertungen gelten dieser finalen Pipelineausgabe. Alle neun Texte sind frisch, keine Übernahme früherer Gewinner und keine manuellen Textkorrekturen.\n\nInferenz ausschließlich über das angemeldete **Codex-Kontingent**; keine API-Schlüssel, keine Bilder und keine Datenbankzugriffe. Kontingentverbrauch ist kein kostenloser Modellbetrieb. Die CLI bestätigt Aufrufmodell und Tokens in lokalen Ereignislogs; ihr Texttransport erzwingt das Produktions-Ausgabelimit und natives Provider-JSON nicht. Zeiten enthalten normale Pipeline-Überarbeitung und laufen bei bis zu drei gleichzeitigen Modelltests, daher nur grobe Praxiswerte.\n\nZwei Modelllektoren, Sol 6.1 und Terra 6.1, jeweils **Mittel**, lesen je Aufgabe die drei anonymisierten Manuskripte in einem frischen Kontext. Modellnamen, Denkstufen, Laufzeiten und Pläne sind darin entfernt. Rotierende, zwischen Lektoren gespiegelte Reihenfolge reduziert Positionsverzerrung. Die feste vorhandene Rubrik: Kausalität/Wunderregel und Hauptfigurenhandlung je 20 %; Ensemble, Stimmen/Dialog, Humor/Wunder, Tempo, Vorlesbarkeit und Gefühl/Auflösung je 10 %. Gewichte werden im Skript berechnet; alle Belegzitate gegen die jeweilige Textfassung geprüft. Unterschiedliche Genreanforderungen stehen im Leserauftrag. Mittelwerte gewichten Aufgaben und Lektoren gleich.\n\n**Grenzen:** Ein Lauf pro Aufgabe und Variante, drei Aufgaben, keine Wiederholungen, keine Kinder oder menschlichen Blindleser. Beide Lektoren gehören derselben Modellfamilie an und beurteilen auch Texte des eigenen Modells. Anonymisierung beseitigt mögliche Stilpräferenz nicht. Kleine Punktabstände sind kein belastbarer allgemeiner Modellvorsprung.\n\n## Alle Geschichten\n\n${table}\n\n## Einzelbewertungen\n\n${findings}\n\n## Reproduktion\n\nFür jede Variante: \`bun scripts/episode/model-comparison.ts --stage generate --variant sol-low\` (bzw. \`terra-low\`, \`terra-medium\`). Danach \`--stage check\`, \`--stage review --judge gpt-6.1-sol\` und \`--stage review --judge gpt-6.1-terra\`, zuletzt \`--stage report\`. Vollständige gespeicherte Ergebnisse werden fortgesetzt; rohe Antworten, Prompt- und Quellkopien, Modellereignisse, Zuordnung und Einzelnoten liegen in \`Logs/episode-model-comparison/2026-10-26\`.\n`;
  const lengthTable = `## Längentreue\n\n| Variante | Kapitel außerhalb des verlangten Wortbudgets | Generierte Ausgabetokens (CLI) |\n|---|---:|---:|\n${aggregate.map(a => `| ${a.label} | ${a.chaptersOutsideBudget}/9 | ${a.outputTokens} |`).join("\n")}\n\nDie Pipeline prüft Längen tolerant: zu lange Texte werden erst ab 135 % des Gesamtbudgets weich markiert; einzelne Kapitelobergrenzen sind kein hartes Gate. Daher ist „keine harten Restfehler“ keine Bestätigung genauer Längentreue. CLI-Tokens enthalten den Codex-Aufrufrahmen und können versteckte Denkarbeit enthalten; sie sind keine API-Rechnung und keine direkte Prozentangabe des verfügbaren Kontingents.\n\n`;
  const finalReport = report.replace("Die CLI bestätigt Aufrufmodell und Tokens in lokalen Ereignislogs;", "Der Transport protokolliert die explizite CLI-Modellwahl und Denkstufe; Ereignislogs belegen erfolgreiche Antworten und gemeldete Tokens. Ein unabhängiger serverseitiger Modellattest liegt nicht vor;")
    .replace("26. Oktober 2026. Neun neu generierte Folgen, drei identische Aufgaben je Modellvariante.", "26. Oktober 2026. Neun neu generierte Folgen, drei identische Aufgaben je Modellvariante.\n\n**Sol Low erzielt hier die höchste Durchschnittsnote.** Terra Mittel verbessert sich gegenüber Terra Low, bleibt im Mittel hinter Sol. Beide Terra-Einstellungen antworten deutlich schneller. Die Empfehlung für die aktuellen Prompts und konkrete Textbelege stehen in der [redaktionellen Einordnung](einordnung.md).")
    .replace("liegt nicht vor; ihr Texttransport", "liegt nicht vor. Der Texttransport")
    .replace("## Einzelbewertungen\n", `${lengthTable}Zwei kleine Zitierfehler (Großschreibung und ausgelassene Sprecherzuordnung) wurden anhand des Manuskripts berichtigt. Originale und genaue Korrekturen stehen in [zitatkorrekturen.json](zitatkorrekturen.json); Rohlektüren und sämtliche Noten bleiben unverändert.\n\n## Einzelbewertungen\n`);
  await writeFile(join(publication, "README.md"), finalReport);
  await writeFile(join(publication, "ergebnisse.json"), JSON.stringify({ pipeline: "talea-folge-v1", rubric: ROLE_QUALITY_RUBRIC, aggregate, rows }, null, 2));
  console.log(JSON.stringify({ aggregate, publication, unsupportedQuotes: rows.flatMap(r => r.ratings).reduce((s, r) => s + r.unsupportedQuotes.length, 0) }));
} else throw new Error("Unknown stage");
