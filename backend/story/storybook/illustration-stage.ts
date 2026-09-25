/**
 * Storybook Pipeline — Stage 7: illustration direction.
 *
 * One support call turns the FINAL text into one shot per page plus the cover:
 * a single frozen moment of action, a camera choice, and the exact characters
 * on stage (at most three). Everything that must never vary — style, identity
 * lines, anatomy locks, the reference-sprite contract, negatives — is appended
 * deterministically, so a model can never drop it.
 *
 * Why the anatomy locks exist: a sprite that holds a child next to a fox or a
 * dragon invites the diffusion model to blend them (animal ears on the child,
 * a third hand from a neighbour's paw). Each page therefore gets a sprite of
 * ONLY the characters actually drawn on it, and every human on stage gets an
 * explicit "fully human, two hands, five fingers" line.
 */

import { CANONICAL_NEGATIVE_PACK, COLLAGE_STRIP_NEGATIVES } from "../dev-mode-image-guards";
import type { StoryBrief } from "./context";
import { parseJsonObject, type LlmCallResult, type StorybookLlm } from "./llm";
import type { IllustrationPlan, IllustrationShot, StoryPlan, StorybookPage } from "./types";

export const STORYBOOK_IMAGE_STYLE = [
  "Children's picture-book illustration, hand-painted gouache and coloured-pencil texture, warm vivid palette.",
  "Expressive characters with clear silhouettes and readable body language, lively motion, dynamic composition with foreground, middle ground and background,",
  "storytelling details in the environment, soft natural light. One continuous full-bleed scene. No text anywhere.",
].join(" ");

/** Entities that can be drawn, keyed by id: heroes, cast and (as an object) the artifact. */
export interface VisualEntity {
  id: string;
  name: string;
  kind: "character" | "artifact";
  /** Heroes keep their place when an identity sheet has to shrink. */
  role?: "hero" | "cast" | "artifact";
  /** "human", "animal", "magical creature", "dragon", … */
  species: string;
  isHuman: boolean;
  /** English appearance line — the identity lock. */
  appearance: string;
  forbidden: string[];
  referenceUrl?: string;
}

function clean(value: unknown, max = 300): string {
  return String(value ?? "").replace(/[{}[\]"]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function looksEnglish(text: string): boolean {
  if (!text) return false;
  if (/[äöüß]/i.test(text)) return false;
  return !/\b(und|mit|der|die|das|ein|eine|einem|trägt|haar|augen|mantel|kleid)\b/i.test(text);
}

const HUMAN_SPECIES = /^(human|mensch|person|child|kind|boy|girl|junge|mädchen|man|woman|mann|frau)$/i;

export function speciesFromProfile(visualProfile: any, fallbackSpecies?: string | null): { species: string; isHuman: boolean } {
  const raw = clean(visualProfile?.characterType || visualProfile?.speciesCategory || visualProfile?.species || fallbackSpecies || "human", 60).toLowerCase();
  const species = raw === "any" || raw === "" ? "character" : raw.replace(/_/g, " ");
  return { species, isHuman: HUMAN_SPECIES.test(species) };
}

/** English appearance for an avatar, assembled from its visual profile fields. */
export function heroAppearance(visualProfile: any, fallback = ""): string {
  if (!visualProfile || typeof visualProfile !== "object") return clean(fallback, 240);
  const parts: string[] = [];
  const push = (value: unknown) => {
    const text = clean(value, 120);
    if (text && !["null", "undefined", "object Object"].includes(text)) parts.push(text);
  };
  push(visualProfile.ageDescription || visualProfile.ageApprox);
  push(visualProfile.gender && visualProfile.gender !== "unknown" ? visualProfile.gender : "");
  push(visualProfile.characterType && !HUMAN_SPECIES.test(String(visualProfile.characterType)) ? visualProfile.characterType : "");
  const hair = [visualProfile.hair?.color, visualProfile.hair?.length, visualProfile.hair?.type, visualProfile.hair?.style].filter(Boolean).join(" ");
  push(hair ? `${hair} hair` : "");
  push(visualProfile.eyes?.color ? `${visualProfile.eyes.color} eyes` : "");
  push(visualProfile.skin?.tone ? `${visualProfile.skin.tone} skin` : "");
  push(visualProfile.clothingCanonical?.outfit || [visualProfile.clothingCanonical?.top, visualProfile.clothingCanonical?.bottom].filter(Boolean).join(", "));
  if (Array.isArray(visualProfile.accessories)) visualProfile.accessories.slice(0, 3).forEach(push);
  if (Array.isArray(visualProfile.consistentDescriptors)) visualProfile.consistentDescriptors.slice(0, 5).forEach(push);
  const joined = [...new Set(parts)].join(", ");
  return clean(joined || fallback, 280);
}

/** English appearance for a pool character: its English image prompt beats the German description. */
export function castAppearance(visualProfile: any, physicalDescription?: string): string {
  const prompt = clean(visualProfile?.imagePrompt, 400)
    .replace(/^portrait of\s+/i, "")
    .replace(/storybook illustration style.*$/i, "")
    .replace(/\b(background|floating in zero gravity|cosmic background)[^.,]*/gi, "")
    .trim();
  if (prompt && looksEnglish(prompt)) return clean(prompt, 260);
  const description = clean(visualProfile?.description || physicalDescription, 260);
  return description;
}

export function anatomyLock(entity: VisualEntity): string {
  if (entity.kind === "artifact") return `${entity.name} is an object: ${entity.appearance}.`;
  if (entity.isHuman) {
    return `${entity.name} is a fully human ${entity.appearance ? `character (${entity.appearance})` : "character"} with ordinary human ears, human skin and hair, no fur, no tail, no animal features, exactly two arms and two hands with five fingers each.`;
  }
  return `${entity.name} is a ${entity.species} (${entity.appearance || "as in the reference"}) and keeps its own anatomy, colours and outfit exactly as in its reference.`;
}

export function negativePromptFor(onStage: VisualEntity[], usesSprite: boolean): string {
  const base = [
    "text, letters, words, numbers, signage, caption, speech bubble, watermark, logo",
    "extra arms, extra hands, three hands, extra fingers, six fingers, fused fingers, missing fingers, deformed hands, extra legs, two heads, duplicated body parts, floating limbs",
    "duplicate character, same character twice, cloned face, unlisted character",
    "photorealistic, 3d render, cgi, harsh horror lighting, gore, blood, weapon pointed at someone",
  ];
  if (onStage.some((entity) => entity.kind === "character" && entity.isHuman)) {
    base.push("animal ears on a human, cat ears, fox ears, bunny ears, tail on a human, fur on human skin, horns on a human, human-animal hybrid, merged characters");
  }
  for (const entity of onStage) for (const feature of entity.forbidden.slice(0, 4)) base.push(clean(feature, 60));
  const pack = CANONICAL_NEGATIVE_PACK.filter((term) => /swap|transfer|merged|two characters in one body/.test(term)).slice(0, 12);
  const strip = usesSprite ? COLLAGE_STRIP_NEGATIVES.slice(0, 14) : [];
  return [...base, ...pack, ...strip].join(", ");
}

/**
 * The final Runware prompt. Order matters: the scene first (the model weights
 * the beginning most), then style, then the locks and the sprite contract.
 */
/** Runware accepts up to 3000 characters; the locks at the end must survive. */
export const MAX_IMAGE_PROMPT_CHARS = 2900;

export function assembleImagePrompt(input: {
  scene: string;
  onStage: VisualEntity[];
  spriteOrder: VisualEntity[];
}): string {
  const full = buildImagePrompt(input, 280);
  if (full.length <= MAX_IMAGE_PROMPT_CHARS) return full;
  // Tighten the appearance lines first (the reference image carries the look),
  // then the scene; never cut the anatomy locks or the sheet contract.
  const tight = buildImagePrompt(input, 90);
  if (tight.length <= MAX_IMAGE_PROMPT_CHARS) return tight;
  return buildImagePrompt({ ...input, scene: clean(input.scene, Math.max(200, 900 - (tight.length - MAX_IMAGE_PROMPT_CHARS))) }, 90);
}

function buildImagePrompt(
  input: { scene: string; onStage: VisualEntity[]; spriteOrder: VisualEntity[] },
  appearanceChars: number
): string {
  const shorten = (entity: VisualEntity): VisualEntity => ({ ...entity, appearance: clean(entity.appearance, appearanceChars) });
  input = { ...input, onStage: input.onStage.map(shorten) };
  const lines: string[] = [clean(input.scene, 900), STORYBOOK_IMAGE_STYLE];
  const characters = input.onStage.filter((entity) => entity.kind === "character");
  if (characters.length > 0) {
    lines.push(`Exactly ${characters.length} named character${characters.length === 1 ? "" : "s"} in the scene, each appearing once: ${characters.map((entity) => entity.name).join(", ")}.`);
  } else {
    lines.push("No named characters in this scene.");
  }
  for (const entity of input.onStage) lines.push(anatomyLock(entity));
  if (input.spriteOrder.length > 1) {
    const order = input.spriteOrder.map((entity, index) => `${index + 1}: ${entity.name}`).join("; ");
    lines.push(`The attached reference is a technical identity sheet, not part of the artwork. Left to right it shows ${order}. Use it only for faces, species, colours and outfits; keep every identity separate; never draw the sheet, its white background, frames or a lineup.`);
  } else if (input.spriteOrder.length === 1) {
    lines.push(`The attached reference shows ${input.spriteOrder[0].name}. Use it only for identity; ignore its pose and background.`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Director call
// ---------------------------------------------------------------------------

export function buildDirectorSystemPrompt(): string {
  return [
    "You are the art director of an award-winning children's picture book. You turn each page of the finished text into ONE illustration brief.",
    "",
    "Every page picture must be a frozen moment of ACTION from that page — the funniest or most dramatic instant, never a summary:",
    "- Characters DO something physical and react to each other: running, tumbling, pulling, hiding, reaching, ducking, laughing, gasping. Faces and bodies show the emotion.",
    "- Never a lineup, never characters standing side by side looking at the viewer, never posing.",
    "- Choose a camera for each page and vary it from page to page: wide establishing shot, medium action shot, low angle looking up, high angle looking down, over-the-shoulder, close-up on a reaction or an object.",
    "- Show the place concretely: time of day, weather, light, and the props exactly in their CURRENT state on this page (broken, wet, tied up, glowing ...).",
    "- At most 3 named characters per picture; if more are in the scene, pick the 3 that matter and let the others be off-panel. Use only the ids given.",
    "- Say exactly WHO does WHAT and where each one is (left / right / foreground / on the ladder …). Never swap roles: if the text says Adrian climbs, Adrian is the one climbing.",
    "- Unnamed extras (a flock of geese, a crowd) only when the page needs them, fully described.",
    "- No text, letters, signs, labels or speech bubbles in any picture.",
    "- English only, 45-80 words per scene. Describe only what the eye sees.",
    "- The cover shows the heroes in an inviting, dynamic moment with the story's central element, with calm sky or background at the top (for the title, which is added later — do not draw it).",
    "",
    "Answer with a valid JSON object only.",
  ].join("\n");
}

export function buildDirectorUserPrompt(input: {
  title: string;
  pages: StorybookPage[];
  plan: StoryPlan;
  entities: VisualEntity[];
  maxPerImage: number;
}): string {
  const lines: string[] = [];
  lines.push(`BOOK: ${input.title}`);
  lines.push("");
  lines.push("CHARACTERS AND OBJECTS YOU MAY DRAW (use the ids):");
  for (const entity of input.entities) {
    lines.push(`- id ${entity.id}: ${entity.name} — ${entity.kind === "artifact" ? "magic object" : entity.species}; looks: ${entity.appearance || "see reference"}`);
  }
  lines.push("");
  lines.push("PAGES (final text; the planner's suggested picture in brackets):");
  for (const page of input.pages) {
    const planned = input.plan.pages.find((entry) => entry.page === page.order);
    lines.push(`PAGE ${page.order}${planned?.place ? ` — place: ${planned.place}` : ""}`);
    lines.push(page.content.replace(/\s+/g, " ").slice(0, 1400));
    if (planned?.picture) lines.push(`[suggested picture: ${planned.picture}]`);
    lines.push("");
  }
  const artifact = input.entities.find((entity) => entity.kind === "artifact");
  lines.push(`Return JSON. onStage lists at most ${input.maxPerImage} character ids (never the object id). artifactVisible is true only when ${artifact ? `the object "${artifact.name}"` : "a catalogue object"} is actually visible.`);
  lines.push(
    JSON.stringify(
      {
        cover: { scene: "…", onStage: ["id"], artifactVisible: false },
        pages: input.pages.map((page) => ({ page: page.order, scene: "…", onStage: ["id"], artifactVisible: false })),
      },
      null,
      1
    )
  );
  return lines.join("\n");
}

function sanitizeShot(raw: any, page: number, entities: VisualEntity[], maxPerImage: number): IllustrationShot | null {
  const scene = clean(raw?.scene, 900);
  if (!scene) return null;
  const characterIds = new Set(entities.filter((entity) => entity.kind === "character").map((entity) => entity.id));
  const onStage = (Array.isArray(raw?.onStage) ? raw.onStage : [])
    .map((id: unknown) => String(id ?? "").trim())
    .filter((id: string) => characterIds.has(id))
    .filter((id: string, index: number, all: string[]) => all.indexOf(id) === index)
    .slice(0, maxPerImage);
  return { page, scene, onStage, artifactVisible: Boolean(raw?.artifactVisible) && entities.some((entity) => entity.kind === "artifact") };
}

/** Deterministic shot when the director call fails: the planner's picture, the planner's cast. */
export function fallbackShot(page: number, plan: StoryPlan, entities: VisualEntity[], maxPerImage: number): IllustrationShot {
  const characterIds = new Set(entities.filter((entity) => entity.kind === "character").map((entity) => entity.id));
  if (page === 0) {
    const heroes = plan.heroes.map((hero) => hero.id).filter((id) => characterIds.has(id)).slice(0, maxPerImage);
    return { page: 0, scene: `${plan.heroes.map((hero) => hero.name).join(" and ")} in an exciting moment of the story "${plan.title}": ${plan.pages[0]?.picture || plan.logline}`, onStage: heroes, artifactVisible: false };
  }
  const planned = plan.pages.find((entry) => entry.page === page);
  return {
    page,
    scene: planned?.picture || planned?.action || plan.logline,
    onStage: (planned?.onPage || []).filter((id) => characterIds.has(id)).slice(0, maxPerImage),
    artifactVisible: false,
  };
}

export function sanitizeIllustrationPlan(raw: any, pageCount: number, plan: StoryPlan, entities: VisualEntity[], maxPerImage: number): IllustrationPlan {
  const cover = sanitizeShot(raw?.cover, 0, entities, maxPerImage) || fallbackShot(0, plan, entities, maxPerImage);
  const byPage = new Map<number, any>();
  for (const entry of Array.isArray(raw?.pages) ? raw.pages : []) {
    const page = Math.round(Number(entry?.page));
    if (Number.isFinite(page)) byPage.set(page, entry);
  }
  const pages: IllustrationShot[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    pages.push(sanitizeShot(byPage.get(page), page, entities, maxPerImage) || fallbackShot(page, plan, entities, maxPerImage));
  }
  return { cover, pages };
}

export interface DirectorStageResult {
  illustrations: IllustrationPlan;
  call?: LlmCallResult;
}

export async function runDirectorStage(
  llm: StorybookLlm,
  input: { brief: StoryBrief; title: string; pages: StorybookPage[]; plan: StoryPlan; entities: VisualEntity[] },
  model: string
): Promise<DirectorStageResult> {
  const maxPerImage = input.brief.budget.maxCharactersPerImage;
  try {
    const call = await llm({
      stage: "illustration-direction",
      role: "support",
      model,
      system: buildDirectorSystemPrompt(),
      user: buildDirectorUserPrompt({ ...input, maxPerImage }),
      json: true,
      maxTokens: 10000,
      effort: "low",
      temperature: 0.6,
    });
    return { illustrations: sanitizeIllustrationPlan(parseJsonObject<any>(call.text), input.pages.length, input.plan, input.entities, maxPerImage), call };
  } catch (err) {
    console.warn("[storybook/illustration] director failed, using planner pictures:", (err as Error)?.message || err);
    return { illustrations: sanitizeIllustrationPlan(null, input.pages.length, input.plan, input.entities, maxPerImage) };
  }
}
