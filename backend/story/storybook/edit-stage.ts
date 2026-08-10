/**
 * Storybook Pipeline — Stage 4: one scoped line edit. At most once.
 *
 * The old engine's repair prompt was 55,814 characters: the full blueprint
 * twice, the whole story, and every contract, in order to change three pages.
 * It then renamed the offending character instead of removing it, three times
 * in a row, and the score crept from 7.8 to 8.2 while the story stayed broken.
 *
 * So: one call, only the affected pages, one sentence per defect, and a hard
 * cap of a single attempt. If it still fails, the story ships with its warnings
 * recorded rather than being rewritten a seventh time.
 */

import type { StoryConfig } from "../generate";
import { callWriter, type LlmCallResult } from "./llm";
import { languageName } from "./style-contract";
import { parseEditedPages, resolveTargetPages } from "./parsing";

export { resolveTargetPages } from "./parsing";
import type { CheckIssue, KidLogicCard, StorybookPage } from "./types";

export interface EditStageInput {
  config: StoryConfig;
  card: KidLogicCard;
  pages: StorybookPage[];
  issues: CheckIssue[];
  styleContract: string;
  writerModel: string;
  /** Pages to rewrite. Everything else is passed through untouched. */
  targetPages: number[];
}

export interface EditStageResult {
  pages: StorybookPage[];
  changedPages: number[];
  call?: LlmCallResult;
}

function buildEditSystemPrompt(languageLabel: string): string {
  return [
    `Du bist Lektorin für Kinderbücher und überarbeitest einzelne Seiten auf ${languageLabel}.`,
    "",
    "Du änderst NUR, was in der Fehlerliste steht. Handlung, Figuren, Reihenfolge und Ton bleiben.",
    "Du kürzt nicht, um Fehler loszuwerden, und du erfindest nichts dazu.",
    "",
    "AUSGABEFORMAT (nur das):",
    "SEITE <Zahl>",
    "<überarbeitete Absätze>",
    "",
    "Gib nur die Seiten aus, die du überarbeiten sollst.",
  ].join("\n");
}

function buildEditUserPrompt(input: EditStageInput): string {
  const lines: string[] = [];
  const byOrder = new Map(input.pages.map((page) => [page.order, page]));

  lines.push("WAS IST FALSCH:");
  for (const issue of input.issues.slice(0, 6)) lines.push(`- ${issue.message}`);
  lines.push("");

  lines.push("ZUR ORIENTIERUNG (nicht ausgeben, nur zum Verstehen):");
  lines.push(`- Der rote Faden: ${input.card.kette?.will} ${input.card.kette?.aber} ${input.card.kette?.also} ${input.card.kette?.dadurch}`);
  lines.push(`- Der Refrain lautet genau: „${input.card.refrain}“`);
  lines.push(`- Das Ankerobjekt ist: ${input.card.ankerObjekt}`);
  const introFigures = (input.card.figuren || []).filter((figure) => figure?.werSieSind);
  if (introFigures.length > 0) {
    lines.push("- Wer die Figuren sind:");
    for (const figure of introFigures) lines.push(`  ${figure.name}: ${figure.werSieSind}`);
  }
  lines.push("");

  lines.push("DIESE SEITEN ÜBERARBEITEN:");
  for (const order of input.targetPages) {
    const page = byOrder.get(order);
    if (!page) continue;
    lines.push("");
    lines.push(`SEITE ${order}`);
    lines.push(page.content);
  }
  lines.push("");

  lines.push(input.styleContract);
  lines.push("");
  lines.push("Behalte die Länge jeder Seite ungefähr bei. Gib die überarbeiteten Seiten im Format oben aus.");

  return lines.join("\n");
}

export async function runEditStage(input: EditStageInput): Promise<EditStageResult> {
  if (input.targetPages.length === 0) {
    return { pages: input.pages, changedPages: [] };
  }

  const call = await callWriter({
    system: buildEditSystemPrompt(languageName(input.config.language)),
    user: buildEditUserPrompt(input),
    model: input.writerModel,
    maxTokens: 1600,
    json: false,
    temperature: 0.7,
  });

  const edited = parseEditedPages(call.text);
  if (edited.size === 0) {
    return { pages: input.pages, changedPages: [], call };
  }

  const changedPages: number[] = [];
  const pages = input.pages.map((page) => {
    const replacement = edited.get(page.order);
    // Guard against an "edit" that silently deletes half the page.
    if (!replacement || replacement.length < page.content.length * 0.5) return page;
    changedPages.push(page.order);
    return { ...page, content: replacement };
  });

  return { pages, changedPages, call };
}
