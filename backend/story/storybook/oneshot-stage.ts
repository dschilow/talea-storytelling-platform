/**
 * Storybook Pipeline — experiment "one shot" (2026-09-28).
 *
 * A strong model (GPT-6 Sol) invents, plans and writes the whole story in ONE
 * call; the plan lives in its hidden reasoning instead of an 80-field JSON.
 * The support model (Luna) does everything else: it reads for logic and
 * continuity and patches just the flagged sentences, keeping the writer's voice.
 * Cast, artifact, hero developments and pictures run on the result as before.
 *
 *   one shot (writer) → checks → continuity read (support) → page patch (support, only if needed)
 */

import { isGerman } from "./craft";
import { checkProse, countWords, issuesToNotes, mentions, nameTokens } from "./checks";
import { selectEnginesForBrief } from "./concept-stage";
import { artifactSheet, briefHeader, broughtArtifact, castSheet, heroSeasoning, heroSheet, wishLines, type StoryBrief } from "./context";
import { buildWriterSystemPrompt, lengthBlock, renderStoryForPrompt } from "./draft-stage";
import { modelFamily, type CostLedger, type LlmRole, type StorybookLlm, type StorybookModels } from "./llm";
import { parseDraft } from "./parsing";
import { comprehensionGaps, ledgerNotes, runReviewStage, verifyStorybookRepair } from "./review-stage";
import type { CastCandidate, StoryPlan, StorybookPage } from "./types";
import type { TextEngineResult, StageObserver } from "./engine";

const HEADER = {
  engine: /^\s*BAUPLAN\s*[:：]\s*(.+?)\s*$/im,
  cast: /^\s*BESETZUNG\s*[:：]\s*(.+?)\s*$/im,
  artifact: /^\s*FUNDSTÜCK\s*[:：]\s*(.+?)\s*$/im,
  refrain: /^\s*REFRAIN\s*[:：]\s*(.+?)\s*$/im,
};

export function buildOneShotUserPrompt(brief: StoryBrief, options: { visiblePlan?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push("AUFGABE: Erfinde, plane und schreibe ein vollständiges Bilderbuch mit diesen Helden.");
  lines.push("Wähle still eine frische Idee. Prüfe vor dem Schreiben: persönliches Ziel, echtes Hindernis, verständliche Lösung und räumliche Abläufe. Die Einführung bekommt den Anfang von Seite 1.");
  // Story a9c00c8b (Sol): the fifth "vain Brunhilde, distracted by a reflection" plot in a row.
  lines.push("Frische: Diese Lösungen kennt die Familie schon zu oft — nimm sie nicht: ein eitler Gegenspieler, der von Spiegelbildern abgelenkt wird; ein Gegenspieler, der zwanghaft im Takt mittanzen muss; ein Glockenschlag als Frist. Die Eigenart einer Pool-Figur zeigt sich, aber sie muss nicht jedes Mal die Lösung sein.");
  lines.push("");
  lines.push("RAHMEN:");
  for (const line of briefHeader(brief)) lines.push(`- ${line}`);
  for (const line of wishLines(brief.config)) lines.push(`- ${line}`);
  lines.push("");
  lines.push("DIE HELDEN (sie haben die entscheidende Idee):");
  for (const hero of brief.heroes) {
    lines.push(heroSheet(hero, brief.heroMemories[hero.id] || []));
    const seasoning = heroSeasoning(hero);
    if (seasoning) lines.push(`  Würze, höchstens einmal und nie als Lösung: ${seasoning}`);
  }
  lines.push("");
  if (brief.candidates.length > 0) {
    lines.push(`FIGURENPOOL — Pflicht: besetze 1 bis ${brief.budget.maxCast} davon mit echter Aufgabe, bis ins Finale (ihre Eigenart und ihr Spruch machen sie wiedererkennbar). Keine weiteren Figuren mit Namen:`);
    for (const candidate of brief.candidates) lines.push(castSheet(candidate, true));
    lines.push("");
  }
  const brought = broughtArtifact(brief);
  if (brought) {
    lines.push("MITGEBRACHTES ARTEFAKT (Pflicht, ist von Anfang an dabei):");
    lines.push(artifactSheet(brought));
    lines.push("");
  } else if (brief.artifacts.length > 0) {
    lines.push("MÖGLICHE FUNDSTÜCKE (optional, höchstens eins, nur wenn es natürlich passt; nenne es immer mit genau diesem Namen):");
    for (const artifact of brief.artifacts) lines.push(artifactSheet(artifact));
    lines.push("");
  }
  lines.push("BAUPLÄNE (bewährt):");
  // Three engines are enough to choose from; every input token is paid at the writer's price.
  for (const engine of selectEnginesForBrief(brief, 3)) lines.push(`- ${engine.id} — ${engine.name}: ${engine.mechanism}`);
  lines.push("");
  if (brief.recentStories.length > 0) {
    lines.push("DIESE FAMILIE KENNT SCHON (nichts davon wiederholen):");
    for (const story of brief.recentStories.slice(0, 5)) lines.push(`- ${story}`);
    lines.push("");
  }
  lines.push(`SEITENRHYTHMUS für ${brief.budget.pages} Seiten:`);
  lines.push(`- Seite 1: ankommen und kennenlernen, dann Störung. Seite 2: Problem klar, erster Versuch.`);
  lines.push(`- Bis Seite ${brief.budget.pages - 2}: kausale Versuche, Rückschlag passend zur gewünschten Spannung. Seite ${brief.budget.pages - 1}: eigene vorbereitete Idee und Lösung. Seite ${brief.budget.pages}: Auflösung und warmes oder komisches Schlussbild.`);
  lines.push("");
  lines.push(...lengthBlock(brief));
  if (brief.blockedTerms.length > 0) lines.push(`- Diese Begriffe dürfen nirgends vorkommen: ${brief.blockedTerms.join(", ")}`);
  lines.push("");
  if (brief.experiment?.pictureBook) {
    lines.push("BILDERBUCH-FORM (so klingen die besten Bilderbücher):");
    lines.push("- Jede Seite ist EIN Moment, den man malen kann. Keine Nebenhandlungen, keine Kleinigkeiten, die das Bild ohnehin zeigt. Jede Seite endet so, dass das Umblättern eine Überraschung bringt.");
    lines.push("- Schreib zum Vorlesen: kurze Sätze mit Rhythmus, Wiederholung mit kleiner Veränderung (erst …, dann …, dann …). Ein Satz, den Kinder beim zweiten Mal mitsprechen.");
    lines.push("- Mindestens eine Lachkaskade: Eine Lage steigert sich dreimal und kippt beim dritten Mal. Übertreibung, Missgeschicke, Figuren, die sich lächerlich sicher sind.");
    lines.push("- Herz: Einmal geht es den Helden selbst ans Herz — sie haben Angst, sind traurig oder platzen vor Stolz — und das Kind fühlt mit. Das Ziel ist IHR Ziel, nicht nur das eines anderen.");
    lines.push("");
  }
  // Only these names exist in the story (Sonnet 5.5 invented "Mats" and "Königin Isabella").
  const allowed = [...brief.heroes.map((hero) => hero.name), ...brief.candidates.map((candidate) => candidate.name)];
  lines.push(`NAMEN: Nur diese Figuren haben Namen: ${allowed.join(", ")}. Alle anderen bleiben namenlos (die Königin, ein Bär) — höchstens eine solche Randfigur.`);
  lines.push("");
  if (options.visiblePlan) {
    // Models that think little before writing (Sonnet 5.5 on "low") improvised
    // their endings. A short plan they write themselves, then follow, fixes that
    // for ~200 tokens; the parser drops it (only SEITE blocks become pages).
    lines.push("ZUERST DEIN PLAN — sechs kurze Zeilen, dann hältst du dich beim Schreiben genau daran:");
    lines.push("PLAN-ZIEL: was die Helden wollen und warum es IHNEN wichtig ist");
    lines.push("PLAN-HINDERNIS: was den einfachen Weg sichtbar versperrt");
    lines.push("PLAN-SCHLÜSSEL: die Eigenart oder Regel, die die Lösung trägt — und auf welchen Seiten (mindestens zweimal, vor dem Finale) sie gezeigt wird");
    lines.push("PLAN-LÖSUNG: in einem Satz, den ein Sechsjähriger versteht — nichts darin darf neu sein");
    lines.push("PLAN-FRIST: die eine Frist und ihre sichtbare Folge");
    lines.push("PLAN-FIGUREN: alle Figuren der Geschichte (nur erlaubte Namen, höchstens eine namenlose Randfigur)");
    lines.push("");
  }
  if (brief.experiment?.selfCheck) {
    lines.push("BEVOR DU AUSGIBST: Schreib die Geschichte zuerst im Kopf. Dann lies sie gegen wie die strengste Lektorin — und wie ein sechsjähriges Kind, das sie zum ersten Mal hört:");
    lines.push("- Ist das, was die Lösung trägt, vorher gezeigt worden (mindestens einmal, besser zweimal)?");
    lines.push("- Ist jede Figur und jedes Ding immer da, wo es sein muss? Weiß jeder nur, was er wissen kann?");
    lines.push("- Gibt es auf jeder Seite einen Grund zu lachen oder zu zittern? Wo nicht: nachschärfen.");
    lines.push("- Klingt jeder Satz beim Vorlesen? Holprige Sätze glätten.");
    lines.push("Verbessere alles, was nicht stimmt, und gib erst dann die fertige Fassung aus. Die Prüfung selbst schreibst du nicht hin.");
    lines.push("");
  }
  lines.push(`AUSGABE — ${options.visiblePlan ? "nach dem Plan " : "zuerst "}diese vier Kopfzeilen, dann die Geschichte im gewohnten Format:`);
  lines.push("BAUPLAN: <id des Bauplans>");
  lines.push(`BESETZUNG: <ids aus dem Figurenpool, mit Komma getrennt>`);
  lines.push("FUNDSTÜCK: <id oder keins>");
  lines.push("REFRAIN: <der Satz zum Mitsprechen oder keiner>");
  // Control run 2026-09-28: 3 of 4 titles named the opponent or a thing, not a hero.
  lines.push(`TITEL: <mit dem Namen von ${brief.heroes.map((hero) => hero.name).join(" oder ")} — die Helden gehören in den Titel, nicht der Gegenspieler>`);
  lines.push("BESCHREIBUNG: …");
  lines.push("SEITE 1 …");
  return lines.join("\n");
}

/** A plan reconstructed from the header and the prose — enough for checks, pictures and rewards. */
export function planFromOneShot(raw: string, brief: StoryBrief, parsed: { title: string; description: string; pages: StorybookPage[] }): StoryPlan {
  const header = (pattern: RegExp) => (String(raw).match(pattern)?.[1] || "").trim();
  const none = (value: string) => !value || /^(keins?|keiner|keine|null|—|-)$/i.test(value);
  const castIds = header(HEADER.cast).split(/[,;]/).map((id) => id.trim()).filter(Boolean);
  const fullText = parsed.pages.map((page) => page.content).join("\n");
  // Run intro-0929-2: "Bäcker Wilhelm" in the text also cast "König Wilhelm"
  // (and would have drawn a king). When two candidates share their name, only
  // the header id or the full name counts.
  const shared = (candidate: CastCandidate) =>
    brief.candidates.some((other) => other.id !== candidate.id && nameTokens(other.name).some((token) => nameTokens(candidate.name).includes(token)));
  const inText = (candidate: CastCandidate) =>
    shared(candidate) ? fullText.toLocaleLowerCase("de-DE").includes(candidate.name.toLocaleLowerCase("de-DE")) : mentions(fullText, candidate.name);
  const cast = brief.candidates
    .filter((candidate) => castIds.includes(candidate.id) || inText(candidate))
    .slice(0, brief.budget.maxCast)
    .map((candidate) => ({ id: candidate.id, name: candidate.name, role: "", want: "", voice: "", signature: "" }));
  const artifactId = header(HEADER.artifact);
  const brought = broughtArtifact(brief);
  const artifactOption = brought || (none(artifactId) ? undefined : brief.artifacts.find((artifact) => artifact.id === artifactId));
  const pageOf = (name: string) => parsed.pages.find((page) => mentions(page.content, name))?.order || 1;
  const refrain = header(HEADER.refrain).replace(/^[„"]|[“"]$/g, "");
  return {
    title: parsed.title,
    logline: parsed.description,
    engine: header(HEADER.engine) || "frei",
    chosenPitch: 0,
    whyChosen: "",
    want: "",
    stakes: "",
    worldRule: null,
    ruleIntro: null,
    solutionWhy: "",
    refrain: none(refrain) ? null : refrain,
    runningGag: { what: "", beats: [] },
    dramaticIrony: "",
    setups: [],
    obstacleMotive: "",
    props: [],
    heroes: brief.heroes.map((hero) => ({ id: hero.id, name: hero.name, strength: "", voice: "", contribution: "" })),
    cast,
    artifact: artifactOption
      ? { id: artifactOption.id, name: artifactOption.name, role: "", firstPage: brought ? 1 : pageOf(artifactOption.name), usePage: brief.budget.pages - 1, carried: Boolean(brought) }
      : null,
    pages: parsed.pages.map((page) => ({
      page: page.order,
      place: "",
      action: page.content.slice(0, 500),
      heroMoment: "",
      humor: "",
      emotion: "",
      turn: "",
      picture: "",
      onPage: [...brief.heroes, ...cast].filter((entity) => mentions(page.content, entity.name)).map((entity) => entity.id),
      after: "",
    })),
    ending: { resolution: "", callback: "", lastLine: "" },
  };
}

function buildPolishPrompt(raw: string, notes: string[]): string {
  return [
    "Du hast diese Geschichte geschrieben. Lies sie jetzt einmal laut, so wie ein sechsjähriges Kind sie hört. Dann überarbeite sie genau einmal:",
    "1. Behebe diese Anmerkungen der Lektorin:",
    ...(notes.length ? notes.map((note) => `   - ${note}`) : ["   - (keine)"]),
    "2. Mach die lustigen Stellen lustiger: eine Lage, die sich dreimal steigert und beim dritten Mal kippt; Übertreibung; Figuren, die sich lächerlich sicher sind. Kein erklärter Witz.",
    "3. Schärfe jeden Satz, der beim Vorlesen nicht klingt. Streiche, was die Handlung nicht braucht.",
    "4. Handlung, Lösung, Figuren, Namen und der Satz zum Mitsprechen bleiben. Keine neuen Figuren.",
    "",
    "DEINE GESCHICHTE:",
    raw,
    "",
    "Gib die vollständige überarbeitete Geschichte im selben Format aus: die vier Kopfzeilen, TITEL, BESCHREIBUNG, SEITE 1 …",
  ].join("\n");
}

/** A patched page may grow by at most ~two short sentences and must keep most of the original. */
export function acceptablePatch(before: string, after: string): boolean {
  const words = (text: string) => text.toLocaleLowerCase("de-DE").match(/[\p{L}\p{N}]+/gu) || [];
  const original = words(before);
  const patched = words(after);
  if (patched.length === 0) return false;
  if (patched.length - original.length > 25) return false;
  const kept = new Set(patched);
  const shared = original.filter((word) => kept.has(word)).length;
  return shared >= original.length * 0.7;
}

export function buildPatchPrompt(title: string, pages: StorybookPage[], notes: string[], brief: StoryBrief): string {
  return [
    "Du bist die Lektorin dieses Bilderbuchs. Die Geschichte stammt von einer sehr guten Autorin — ihre Stimme, ihr Witz und ihre Sätze bleiben.",
    "Behebe die konkreten Fehler: fehlende Einführung oder Motivation, unklare Orte und Besitzwechsel, Widersprüche, unverständliche Lösung, Sprachfehler und fehlende Pflichtfiguren. Reine Geschmacksänderungen an Stil, Witz oder Spannung bleiben aus.",
    // Story 774d5a5e: these need a sentence in the RIGHT place, usually an earlier page.
    "Liegt die Lösung zufällig bereit, ergänze auf einer früheren Seite einen kurzen Satz, in dem die Helden das Ding sehen, kennen oder mitnehmen. Erfüllt das Ende das Anfangsziel nicht, zeig auf der letzten Seite in einem Satz, dass genau dieses Ziel erreicht ist. Wird etwas angekündigt und nie eingelöst, löse es mit einem Satz ein oder streiche die Ankündigung. Wechselt ein Ding ohne Grund Form, Ort oder Besitzer, gleiche die frühere Stelle an.",
    `Die Familie wählte ${brief.band} Jahre, ${brief.budget.pages} Seiten und ${brief.budget.totalWordsMin}–${brief.budget.totalWordsMax} Wörter (${brief.budget.wordsPerPageMin}–${brief.budget.wordsPerPageMax} je Seite). Diese Vorgaben bleiben erhalten.`,
    "Mit so wenigen Worten wie möglich: einen Satz ändern oder einen kurzen Satz ergänzen, nie die Seite neu schreiben, nie eine neue Handlung erfinden.",
    // Story 2db50859: the patch pasted the critic's fix into page 5 and gave
    // the solution away one page before the heroes' "Ich hab's!".
    "Verrate NIE die Lösung oder den Plan der Helden vor der Seite, auf der sie ihn selbst haben. Übernimm keine Formulierung aus den Anmerkungen wörtlich.",
    "",
    "ANMERKUNGEN:",
    ...notes.map((note) => `- ${note}`),
    "",
    "DEINE GESCHICHTE:",
    renderStoryForPrompt(title, pages),
    "",
    "Gib NUR die Seiten aus, die du änderst, jeweils vollständig, im Format:",
    "SEITE <Nummer>",
    "<der ganze neue Text dieser Seite>",
    "Prüf dabei, dass deine Änderung zu den Seiten davor und danach passt.",
    // Story a9c00c8b: the patch replaced the refrain on one page only — two refrains.
    "Der Satz zum Mitsprechen bleibt auf jeder Seite wortgleich. Ändere ihn nie, auch wenn eine Anmerkung es vorschlägt.",
    "Wenn keine Änderung nötig ist: KEINE ÄNDERUNG. Niemals zusätzliche Seiten oder dieselbe Seitennummer zweimal ausgeben.",
  ].join("\n");
}

/** Atomic patch: reject ambiguous numbering and changes that introduce a new hard defect. */
export function mergeStorybookPatch(raw: string, pages: StorybookPage[], brief: StoryBrief): StorybookPage[] {
  const markers = [...raw.matchAll(/^\s*SEITE\s+(\d+)\s*$/gim)].map((match) => Number(match[1]));
  const changed = parseDraft(raw, brief.budget.pages, { german: isGerman(brief.config.language) }).pages;
  if (!markers.length || changed.length !== markers.length || new Set(markers).size !== markers.length || markers.some((n) => !pages.some((page) => page.order === n))) return pages;
  return pages.map((page) => {
    const index = markers.indexOf(page.order);
    const content = index >= 0 ? changed[index]?.content : undefined;
    return content && acceptablePatch(page.content, content) ? { ...page, content } : page;
  });
}

export async function runOneShotEngine(input: {
  llm: StorybookLlm;
  brief: StoryBrief;
  models: StorybookModels;
  ledger: CostLedger;
  observe?: StageObserver;
}): Promise<TextEngineResult> {
  const { llm, brief, models, ledger } = input;
  const strong = brief.experiment?.plannerModel || models.writer;
  const record = (stage: string, role: LlmRole, call: Parameters<CostLedger["recordCall"]>[1]) => ledger.recordCall(stage, call, role);
  const observe = async (stage: string, payload: Record<string, unknown>) => {
    try {
      await input.observe?.(stage, payload);
    } catch {
      // Observers never change the story.
    }
  };
  const german = isGerman(brief.config.language);

  // 1) Invent, plan and write in one call.
  let call = await llm({
    stage: "oneshot",
    role: "writer",
    model: strong,
    system: buildWriterSystemPrompt(brief, { oneShot: true }),
    user: buildOneShotUserPrompt(brief, { visiblePlan: modelFamily(strong) === "anthropic" }),
    json: false,
    // A whole story is ~2.500 tokens (Sol low) to ~5.000 (medium). 30k let
    // Sonnet 5.5 think itself into a 31 ¢ loop without a single page (2026-09-29).
    maxTokens: Math.min(10000, Math.max(4000, Math.ceil(brief.budget.totalWordsMax * 3.5 + 2000))),
    effort: brief.experiment?.writerEffort || "low",
    timeoutMs: 300_000,
    temperature: 0.9,
  });
  record("oneshot", "writer", call);
  let parsed = parseDraft(call.text, brief.budget.pages, { german });
  let plan = planFromOneShot(call.text, brief, parsed);
  let pages = parsed.pages;
  let report = checkProse({ pages, budget: brief.budget, plan, brief });
  let draftRetried = false;
  const structural = new Set(["wrong_page_count", "too_short", "too_long", "serialization_artifact"]);
  if (!pages.length || report.hard.some((issue) => structural.has(issue.code))) {
    draftRetried = true;
    const retry = await llm({
      stage: "oneshot-repair", role: "writer", model: strong,
      system: buildWriterSystemPrompt(brief, { oneShot: true }),
      user: [buildOneShotUserPrompt(brief), "Behebe ausschließlich diese Format-/Umfangsfehler im Entwurf:", ...issuesToNotes(report.hard, 6), call.text].join("\n"),
      json: false, maxTokens: 10000, effort: "low", timeoutMs: 300_000,
    });
    record("oneshot-repair", "writer", retry);
    const repaired = parseDraft(retry.text, brief.budget.pages, { german });
    const repairedPlan = planFromOneShot(retry.text, brief, repaired);
    const repairedReport = checkProse({ pages: repaired.pages, budget: brief.budget, plan: repairedPlan, brief });
    if (repairedReport.hard.length <= report.hard.length) {
      call = retry; parsed = repaired; plan = repairedPlan; pages = repaired.pages; report = repairedReport;
    }
  }
  // Never spend on illustrations for an incomplete manuscript.
  if (!pages.length || report.hard.some((issue) => structural.has(issue.code))) throw new Error("[storybook] Die Geschichte erfüllt die gewählte Länge oder Seitenzahl noch nicht. Bitte erneut versuchen.");
  await observe("draft", { title: parsed.title, hard: report.hard.map((i) => i.message) });

  // 2) Continuity read by the critic of the OTHER family (no taste, only logic).
  // Story 774d5a5e: Luna — Sol's own family — found a typo and missed a chance
  // solution, an unreached goal and a painted arrow that later hung on a peg.
  let review = null;
  try {
    const reviewed = await runReviewStage(llm, brief, parsed.title, pages, plan.cast.map((member) => member.name), models.critic, "review", true);
    if (reviewed.failedCall) record("review-unusable", "critic", reviewed.failedCall);
    record("review", "critic", reviewed.call);
    review = reviewed.review;
  } catch (err) {
    console.warn("[storybook] continuity read failed:", (err as Error)?.message || err);
  }
  await observe("review", { review });

  // 3) Patch only the pages with real defects.
  // Pool characters are part of the product: a story without one gets one.
  const castNote =
    brief.candidates.length > 0 && plan.cast.length === 0
      ? [`Keine Figur aus dem Figurenpool kommt vor. Baue ${brief.candidates[0].name} (${brief.candidates[0].whoTheyAre}) mit einer kleinen, echten Aufgabe auf mindestens zwei Seiten ein, eine davon in der zweiten Hälfte.`]
      : [];
  const notes = [
    ...castNote,
    ...issuesToNotes(report.hard, 6),
    ...(review ? comprehensionGaps(review) : []),
    ...(review ? ledgerNotes(review) : []),
    // Only the problem, never the critic's suggested wording: Luna pasted those in verbatim.
    ...(review?.mustFix || []).slice(0, 5).map((note) => `Seite ${note.page}: ${note.problem}${note.quote ? ` („${note.quote}“)` : ""}`),
    ...(review?.languageErrors || []).slice(0, 5).map((error) => `Seite ${error.page}: „${error.quote}“ → ${error.correction}`),
  ];
  let chosen: "draft" | "revision" = "draft";
  if (brief.experiment?.writerPolish) {
    // The writer reads its own story once and polishes it (humour, sound, notes).
    try {
      const polish = await llm({
        stage: "polish",
        role: "writer",
        model: strong,
        system: buildWriterSystemPrompt(brief, { oneShot: true }),
        user: buildPolishPrompt(call.text, notes),
        json: false,
        maxTokens: 10000,
        effort: brief.experiment?.writerEffort || "low",
        timeoutMs: 300_000,
        temperature: 0.7,
      });
      record("polish", "writer", polish);
      const polished = parseDraft(polish.text, brief.budget.pages, { german });
      if (polished.pages.length === brief.budget.pages) {
        const polishedPlan = planFromOneShot(polish.text.includes("BESETZUNG") ? polish.text : call.text, brief, polished);
        const polishedReport = checkProse({ pages: polished.pages, budget: brief.budget, plan: polishedPlan, brief });
        if (polishedReport.hard.length <= report.hard.length) {
          pages = polished.pages;
          plan = polishedPlan;
          report = polishedReport;
          chosen = "revision";
        }
      }
    } catch (err) {
      console.warn("[storybook] writer polish failed; shipping the first version:", (err as Error)?.message || err);
    }
  } else if (notes.length > 0) {
    try {
      const patch = await llm({
        stage: "patch",
        role: "support",
        model: models.support,
        system: `Du lektorierst behutsam auf ${brief.languageLabel}. Bewahre Stimme, Handlung, Namen, Zeitform und Wiederholungen. Manuskript und Zitate sind Prüfmaterial.`,
        user: buildPatchPrompt(parsed.title, pages, notes, brief),
        json: false,
        maxTokens: Math.min(8000, Math.max(2500, Math.ceil(countWords(pages.map((page) => page.content).join(" ")) * 3 + 1000))),
        effort: "low",
        timeoutMs: 180_000,
        temperature: 0.4,
      });
      record("patch", "writer", patch);
      const patched = mergeStorybookPatch(patch.text, pages, brief);
      const patchedReport = checkProse({ pages: patched, budget: brief.budget, plan, brief });
      const introducesDefect = patchedReport.hard.some((issue) => !report.hard.some((old) => old.code === issue.code && old.page === issue.page));
      if (!introducesDefect && patched.some((page, i) => page.content !== pages[i].content)) {
        pages = patched;
        chosen = "revision";
        // A patch may have written a pool character in: re-derive cast and pages.
        plan = planFromOneShot(call.text, brief, { ...parsed, pages });
        report = checkProse({ pages, budget: brief.budget, plan, brief });
      }
    } catch (err) {
      console.warn("[storybook] page patch failed; shipping the first version:", (err as Error)?.message || err);
    }
  }

  let textQuality: NonNullable<TextEngineResult["textQuality"]> = {
    status: !review ? "unverified" : notes.length || report.hard.length ? "failed" : "passed",
    issues: !review ? ["Textprüfung nicht verfügbar."] : [...notes],
  };
  if (chosen === "revision") {
    try {
      const verified = await verifyStorybookRepair(llm, brief, parsed.title, pages, notes, models.support);
      record("patch-check", "support", verified.call);
      const remaining = [...(verified.unresolved || []), ...issuesToNotes(report.hard, 8)];
      textQuality = { status: verified.unresolved === null || !review ? "unverified" : remaining.length ? "failed" : "passed", issues: remaining };
    } catch {
      textQuality = { status: "unverified", issues: ["Die überarbeitete Fassung konnte nicht geprüft werden."] };
    }
    await observe("patch-check", { ...textQuality });
  }
  const score = review ? review.scores.overall : null;
  return {
    title: parsed.title || plan.title,
    description: parsed.description,
    pages,
    plan,
    pitches: [],
    engineIds: [plan.engine],
    review,
    pairwise: null,
    chosen,
    finalChecks: report,
    benchmarkScore: chosen === "revision" ? null : score,
    draftScore: score,
    planRepaired: false,
    draftRetried,
    textQuality,
  };
}
