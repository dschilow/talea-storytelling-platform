/**
 * Storybook Pipeline — avatar development.
 *
 * Reads the FINAL story text and derives trait growth per hero. Every change
 * carries a story-specific description, because the platform contract is that a
 * child can always see WHY a value went up — a bare "+2 Mut" tells them nothing.
 *
 * Base traits cap at 100, knowledge subcategories at 1000, and a subcategory is
 * only ever created when the model actually asks for it.
 */

import { callSupport, parseJsonObject, type LlmCallResult } from "./llm";
import type { StorybookAvatarDevelopment, StorybookHero, StorybookPage } from "./types";

const BASE_TRAIT_IDS = [
  "knowledge",
  "creativity",
  "vocabulary",
  "courage",
  "curiosity",
  "teamwork",
  "empathy",
  "persistence",
  "logic",
] as const;

const KNOWLEDGE_SUBCATEGORY_IDS = [
  "knowledge.biology",
  "knowledge.history",
  "knowledge.physics",
  "knowledge.geography",
  "knowledge.astronomy",
  "knowledge.mathematics",
  "knowledge.chemistry",
] as const;

const ALLOWED_TRAIT_IDS = new Set<string>([...BASE_TRAIT_IDS, ...KNOWLEDGE_SUBCATEGORY_IDS]);
const MAX_STORY_CHARS = 8_000;
const MAX_TRAITS_PER_AVATAR = 3;

export interface DevelopmentStageInput {
  heroes: StorybookHero[];
  title: string;
  pages: StorybookPage[];
}

export interface DevelopmentStageResult {
  developments: StorybookAvatarDevelopment[];
  call?: LlmCallResult;
}

function buildSystemPrompt(): string {
  return [
    "Du liest eine fertige Kindergeschichte und leitest daraus ab, was die Hauptfiguren daran gewachsen sind.",
    "",
    "Regeln:",
    "- Nur Eigenschaften, die im TEXT sichtbar geworden sind. Keine Vermutungen.",
    "- Pro Figur höchstens drei Eigenschaften.",
    "- change ist 1, 2 oder 3. 3 nur, wenn die Eigenschaft die Geschichte getragen hat.",
    "- Jede Änderung braucht eine Begründung aus DIESER Geschichte, in einem Satz, kindgerecht.",
    "  Falsch: „Mut ist wichtig.“  Richtig: „Ben ging als Erster durch die dunkle Scheune, obwohl er zitterte.“",
    "- Wenn eine Figur nichts gelernt hat, gib für sie eine leere Liste zurück. Das ist erlaubt.",
    "",
    `Erlaubte Eigenschaften: ${[...ALLOWED_TRAIT_IDS].join(", ")}`,
    "",
    "Antworte ausschließlich mit einem gültigen JSON-Objekt.",
  ].join("\n");
}

function buildUserPrompt(input: DevelopmentStageInput): string {
  const storyText = input.pages
    .map((page) => `--- Seite ${page.order} ---\n${page.content}`)
    .join("\n\n")
    .slice(0, MAX_STORY_CHARS);

  return [
    `TITEL: ${input.title}`,
    "",
    `HAUPTFIGUREN: ${input.heroes.map((hero) => hero.name).join(", ")}`,
    "",
    storyText,
    "",
    "Antworte mit:",
    JSON.stringify(
      {
        developments: input.heroes.map((hero) => ({
          name: hero.name,
          changedTraits: [{ trait: "courage", change: 2, description: "konkreter Satz aus dieser Geschichte" }],
        })),
      },
      null,
      1
    ),
  ].join("\n");
}

function sanitize(raw: any, heroes: StorybookHero[]): StorybookAvatarDevelopment[] {
  const byName = new Map(heroes.map((hero) => [hero.name.toLowerCase(), hero]));
  const entries = Array.isArray(raw?.developments) ? raw.developments : [];
  const result: StorybookAvatarDevelopment[] = [];

  for (const entry of entries) {
    const name = String(entry?.name || "").trim();
    const hero = byName.get(name.toLowerCase());
    if (!hero) continue;

    const seenTraits = new Set<string>();
    const changedTraits: StorybookAvatarDevelopment["changedTraits"] = [];

    for (const traitEntry of Array.isArray(entry?.changedTraits) ? entry.changedTraits : []) {
      const trait = String(traitEntry?.trait || "").trim().toLowerCase();
      if (!ALLOWED_TRAIT_IDS.has(trait) || seenTraits.has(trait)) continue;

      const change = Math.max(1, Math.min(3, Math.round(Number(traitEntry?.change) || 0)));
      if (!Number.isFinite(change) || change < 1) continue;

      const description = String(traitEntry?.description || "").replace(/\s+/g, " ").trim();
      // The description is not optional: a trait that changes without a visible
      // reason is exactly the thing this platform promises never to show.
      if (description.length < 12) continue;

      seenTraits.add(trait);
      changedTraits.push({ trait, change, description: description.slice(0, 240) });
      if (changedTraits.length >= MAX_TRAITS_PER_AVATAR) break;
    }

    if (changedTraits.length > 0) {
      result.push({ avatarId: hero.id, name: hero.name, changedTraits });
    }
  }

  return result;
}

export async function runDevelopmentStage(input: DevelopmentStageInput): Promise<DevelopmentStageResult> {
  if (input.heroes.length === 0 || input.pages.length === 0) return { developments: [] };

  try {
    const call = await callSupport({
      system: buildSystemPrompt(),
      user: buildUserPrompt(input),
      maxTokens: 900,
      json: true,
      temperature: 0.2,
    });
    return { developments: sanitize(parseJsonObject<any>(call.text), input.heroes), call };
  } catch (err) {
    console.warn("[storybook/developments] stage failed, continuing without developments:", err);
    return { developments: [] };
  }
}
