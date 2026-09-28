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
import { checkProse, issuesToNotes, mentions } from "./checks";
import { selectEnginesForBrief } from "./concept-stage";
import { artifactSheet, briefHeader, broughtArtifact, castSheet, heroSeasoning, heroSheet, wishLines, type StoryBrief } from "./context";
import { buildWriterSystemPrompt, lengthBlock, renderStoryForPrompt } from "./draft-stage";
import type { CostLedger, LlmRole, StorybookLlm, StorybookModels } from "./llm";
import { parseDraft } from "./parsing";
import { pageRhythm } from "./plan-stage";
import { runReviewStage } from "./review-stage";
import type { StoryPlan, StorybookPage } from "./types";
import type { TextEngineResult, StageObserver } from "./engine";

const HEADER = {
  engine: /^\s*BAUPLAN\s*[:：]\s*(.+?)\s*$/im,
  cast: /^\s*BESETZUNG\s*[:：]\s*(.+?)\s*$/im,
  artifact: /^\s*FUNDSTÜCK\s*[:：]\s*(.+?)\s*$/im,
  refrain: /^\s*REFRAIN\s*[:：]\s*(.+?)\s*$/im,
};

export function buildOneShotUserPrompt(brief: StoryBrief): string {
  const lines: string[] = [];
  lines.push("AUFGABE: Erfinde, plane und schreibe ein vollständiges Bilderbuch mit diesen Helden.");
  lines.push("Denk dir zuerst im Kopf drei grundverschiedene Ideen aus (verschiedene Baupläne), nimm die stärkste und plane sie Seite für Seite — wer ist wo, wer hat welches Ding, wie weit ist die Frist. Dann schreib.");
  lines.push("Vor dem Schreiben prüfst du: Ist das Problem echt, oder könnten die Helden einfach hingehen, fragen oder es tragen? Versteht ein Sechsjähriger in einem Satz, warum die Lösung klappt? Würde ein Kind lachen?");
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
    for (const candidate of brief.candidates) lines.push(castSheet(candidate));
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
  for (const beat of pageRhythm(brief.budget.pages)) lines.push(`- ${beat}`);
  lines.push("");
  lines.push(...lengthBlock(brief));
  if (brief.blockedTerms.length > 0) lines.push(`- Diese Begriffe dürfen nirgends vorkommen: ${brief.blockedTerms.join(", ")}`);
  lines.push("");
  lines.push("AUSGABE — zuerst diese vier Kopfzeilen, dann die Geschichte im gewohnten Format:");
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
  const cast = brief.candidates
    .filter((candidate) => castIds.includes(candidate.id) || parsed.pages.some((page) => mentions(page.content, candidate.name)))
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

function buildPatchPrompt(title: string, pages: StorybookPage[], notes: string[]): string {
  return [
    "Du bist die Lektorin dieses Bilderbuchs. Die Geschichte stammt von einer sehr guten Autorin — ihre Stimme, ihr Witz und ihre Sätze bleiben.",
    "Behebe NUR diese Fehler, mit so wenigen Worten wie möglich (einen Satz ergänzen oder ändern, nicht die Seite neu schreiben). Alles andere bleibt Wort für Wort gleich:",
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
  ].join("\n");
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
  const call = await llm({
    stage: "oneshot",
    role: "writer",
    model: strong,
    system: buildWriterSystemPrompt(brief),
    user: buildOneShotUserPrompt(brief),
    json: false,
    maxTokens: 30000,
    effort: "low",
    timeoutMs: 300_000,
    temperature: 0.9,
  });
  record("oneshot", "writer", call);
  const parsed = parseDraft(call.text, brief.budget.pages, { german });
  if (parsed.pages.length === 0) throw new Error("[storybook] Die Geschichte enthielt keine lesbaren Seiten.");
  let plan = planFromOneShot(call.text, brief, parsed);
  let pages = parsed.pages;
  let report = checkProse({ pages, budget: brief.budget, plan, brief });
  await observe("draft", { title: parsed.title, hard: report.hard.map((i) => i.message) });

  // 2) Continuity read by a cheap model of another family (no taste, only logic).
  let review = null;
  try {
    const reviewed = await runReviewStage(llm, brief, parsed.title, pages, plan.cast.map((member) => member.name), models.support);
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
    ...(review?.mustFix || []).slice(0, 5).map((note) => `Seite ${note.page}: ${note.problem}${note.quote ? ` („${note.quote}“)` : ""} → ${note.fix}`),
    ...(review?.languageErrors || []).slice(0, 5).map((error) => `Seite ${error.page}: „${error.quote}“ → ${error.correction}`),
  ];
  let chosen: "draft" | "revision" = "draft";
  if (notes.length > 0) {
    try {
      const patch = await llm({
        stage: "patch",
        role: "support",
        model: models.support,
        system: buildWriterSystemPrompt(brief),
        user: buildPatchPrompt(parsed.title, pages, notes),
        json: false,
        maxTokens: 12000,
        effort: "low",
        timeoutMs: 180_000,
        temperature: 0.4,
      });
      record("patch", "writer", patch);
      const changed = parseDraft(patch.text, brief.budget.pages, { german }).pages;
      // parseDraft renumbers; take the original markers for the page numbers.
      const markers = [...String(patch.text).matchAll(/^\s*SEITE\s+(\d+)\s*$/gim)].map((match) => Number(match[1]));
      const patched = pages.map((page) => {
        const index = markers.indexOf(page.order);
        return index >= 0 && changed[index]?.content ? { ...page, content: changed[index].content } : page;
      });
      const patchedReport = checkProse({ pages: patched, budget: brief.budget, plan, brief });
      if (patchedReport.hard.length <= report.hard.length) {
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
    benchmarkScore: score,
    draftScore: score,
    planRepaired: false,
    draftRetried: false,
  };
}
