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
import type { IllustrationPlan, IllustrationShot, StoryElement, StoryPlan, StorybookPage } from "./types";

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
    const face = entity.role === "hero" ? " a smooth child's face with no moustache, no beard and no facial hair," : "";
    return `${entity.name} is a fully human ${entity.appearance ? `character (${entity.appearance})` : "character"} with${face} ordinary human ears, human skin and hair, no wings, no fur, no tail, no animal features, exactly two arms and two hands with five fingers each. ${entity.name} wears only ${entity.name}'s own clothes and accessories.`;
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
  if (onStage.some((entity) => entity.role === "hero" && entity.isHuman)) {
    base.push("moustache on a child, beard on a child, facial hair on a child, adult features on a child");
  }
  for (const entity of onStage) for (const feature of entity.forbidden.slice(0, 4)) base.push(clean(feature, 60));
  base.push(...signatureNegatives(onStage));
  const pack = CANONICAL_NEGATIVE_PACK.filter((term) => /swap|transfer|merged|two characters in one body/.test(term)).slice(0, 12);
  const strip = usesSprite ? COLLAGE_STRIP_NEGATIVES.slice(0, 14) : [];
  return [...base, ...pack, ...strip].join(", ");
}

const SIGNATURE_FEATURES = /\b(witch hat|pointed hat|top hat|hat|crown|tiara|cape|cloak|wings?|horns?|tail|beard|moustache|mustache|antlers|halo)\b/gi;

/**
 * Story fix-0929-b: the witch's pointed hat landed on the children, the
 * dragon's wings on Mina. The signature features of every other figure on the
 * page are forbidden on the heroes by name of the feature.
 */
export function signatureNegatives(onStage: VisualEntity[]): string[] {
  if (!onStage.some((entity) => entity.role === "hero" && entity.isHuman)) return [];
  const heroText = onStage.filter((entity) => entity.role === "hero").map((entity) => entity.appearance.toLowerCase()).join(" ");
  const features = new Set<string>();
  for (const entity of onStage) {
    if (entity.role === "hero" || entity.kind !== "character") continue;
    for (const match of entity.appearance.matchAll(SIGNATURE_FEATURES)) {
      const feature = match[1].toLowerCase().replace(/s$/, "");
      // A hero who wears a hat of their own keeps it.
      if (!heroText.includes(feature)) features.add(feature);
    }
    if (!entity.isHuman && /dragon|bird|bat|fairy|griffin|owl|butterfly|bee/i.test(entity.species)) features.add("wing");
  }
  return [...features].slice(0, 6).map((feature) => `child with ${feature === "wing" ? "wings" : `a ${feature}`}`);
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
  elements?: StoryElement[];
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
  input: { scene: string; onStage: VisualEntity[]; spriteOrder: VisualEntity[]; elements?: StoryElement[] },
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
  // Story 422a3ba3: a wish hat walking on long legs was painted as a cap the
  // boy wore on four pages. A recurring magic thing gets one fixed look.
  for (const element of input.elements || []) {
    lines.push(`Story element, drawn exactly once and exactly like this: ${clean(element.name, 60)} — ${clean(element.look, appearanceChars)}. It is its own separate figure or thing, never part of a character's body, and never wears a named character's clothes or face.`);
  }
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
    "- At most 3 FIGURES per picture in total, counting named characters AND figure story elements (a troll, a giant, a goose). If more are in the scene, pick the ones the moment needs and leave the others off-panel. List onStage in order of importance. Use only the ids given.",
    "- Say exactly WHO does WHAT and where each one is (left / right / foreground / on the ladder …). Never swap roles: if the text says Adrian climbs, Adrian is the one climbing.",
    "- Unnamed extras (a flock of geese, a crowd) only when the page needs them, fully described.",
    "- Any creature, animal, talking object or special thing that is NOT in the list above and appears on more than one page (also an ordinary goose, dog or broom): define it ONCE in storyElements with a fixed, drawable look (shape, size, colours, how it moves) and list its name in 'elements' on every picture where it appears. It is its own figure: a hat with legs is never worn by anyone, a talking cup is never just a cup on a table. Set figure:true for anything alive (a troll, a giant, a goose). Its look is concrete (species, skin or fur colour, clothes WITH colours) and clearly different from every listed character — never their clothes, hair or colours.",
    "- A coloured mark, line or stripe in the story (a red water mark, a blue ribbon) colours only that small thing — water, sky and ground keep their natural colours.",
    "- Every object fits the story's world: in a fairy-tale or fantasy world everything is old-fashioned (wood, stone, clay, copper, wicker) — no modern appliances, stainless steel, plastic, electric ovens, sinks with taps or cars.",
    "- Each picture happens exactly at this page's place from the text: an outdoor scene at a stream is never moved into a kitchen.",
    "- Only the listed characters plus extras the page needs. Never extra children in the background — they look like copies of the heroes.",
    "- Features belong to their owner: one character's moustache, crown, hat or cape is never drawn on anyone else.",
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
        storyElements: [{ name: "name of a recurring figure or thing, or leave the list empty", look: "fixed English look", figure: true }],
        cover: { scene: "…", onStage: ["id"], artifactVisible: false, elements: [] },
        pages: input.pages.map((page) => ({ page: page.order, scene: "…", onStage: ["id"], artifactVisible: false, elements: [] })),
      },
      null,
      1
    )
  );
  return lines.join("\n");
}

function sanitizeElements(raw: unknown): StoryElement[] {
  return (Array.isArray(raw) ? raw : [])
    .map((entry: any) => ({ name: clean(entry?.name, 60), look: clean(entry?.look, 260), ...(entry?.figure === true ? { figure: true } : {}) }))
    .filter((entry) => entry.name && entry.look && !/^name of a recurring/i.test(entry.name))
    .slice(0, 4);
}

function sanitizeShot(raw: any, page: number, entities: VisualEntity[], maxPerImage: number, elementNames: Set<string> = new Set(), figureNames: Set<string> = new Set()): IllustrationShot | null {
  const scene = clean(raw?.scene, 900);
  if (!scene) return null;
  const characterIds = new Set(entities.filter((entity) => entity.kind === "character").map((entity) => entity.id));
  const onStage = (Array.isArray(raw?.onStage) ? raw.onStage : [])
    .map((id: unknown) => String(id ?? "").trim())
    .filter((id: string) => characterIds.has(id))
    .filter((id: string, index: number, all: string[]) => all.indexOf(id) === index)
    .slice(0, maxPerImage);
  const elements = (Array.isArray(raw?.elements) ? raw.elements : [])
    .map((name: unknown) => clean(name, 60))
    .filter((name: string) => elementNames.has(name));
  // Runs fix2-0929: three named characters plus a troll and a lamb on every
  // page — the troll took Amir's jacket, the giant fused with the turtle.
  // Figures without a reference crowd out the named ones, never the other way.
  const figures = elements.filter((name: string) => figureNames.has(name)).length;
  onStage.splice(Math.max(1, maxPerImage - figures));
  return { page, scene, onStage, artifactVisible: Boolean(raw?.artifactVisible) && entities.some((entity) => entity.kind === "artifact"), elements };
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
  const storyElements = sanitizeElements(raw?.storyElements);
  const elementNames = new Set(storyElements.map((element) => element.name));
  const figureNames = new Set(storyElements.filter((element) => element.figure).map((element) => element.name));
  const drafted = sanitizeShot(raw?.cover, 0, entities, maxPerImage, elementNames, figureNames) || fallbackShot(0, plan, entities, maxPerImage);
  // The cover always shows every hero (story 2db50859: Adrian was left off).
  const heroIds = entities.filter((entity) => entity.role === "hero").map((entity) => entity.id);
  const cover = { ...drafted, onStage: [...heroIds, ...drafted.onStage.filter((id) => !heroIds.includes(id))].slice(0, Math.max(maxPerImage, heroIds.length)) };
  const byPage = new Map<number, any>();
  for (const entry of Array.isArray(raw?.pages) ? raw.pages : []) {
    const page = Math.round(Number(entry?.page));
    if (Number.isFinite(page)) byPage.set(page, entry);
  }
  const pages: IllustrationShot[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    pages.push(sanitizeShot(byPage.get(page), page, entities, maxPerImage, elementNames, figureNames) || fallbackShot(page, plan, entities, maxPerImage));
  }
  return { cover, pages, storyElements };
}

/**
 * Pool characters often carry only a vague text look ("young maid with simple
 * dress"), so the image model filled the gaps differently on every page —
 * story 2db50859 drew Magd Elsa blonde on the cover and brunette on page 3.
 * One cheap vision call reads the fixed look off the reference portraits.
 */
export async function describeReferenceLooks(
  llm: StorybookLlm,
  entities: VisualEntity[],
  model: string
): Promise<{ entities: VisualEntity[]; call?: LlmCallResult }> {
  const targets = entities.filter((entity) => entity.kind === "character" && entity.role !== "hero" && entity.referenceUrl);
  if (targets.length === 0) return { entities };
  try {
    const call = await llm({
      stage: "reference-looks",
      role: "support",
      model,
      system: "You describe character reference portraits for an illustrator. Answer with JSON only.",
      user: [
        ...targets.map((entity, index) => `Attachment ${index + 1} shows ${entity.name} (${entity.species}).`),
        "For each character write ONE English line, at most 30 words, of what stays the same in every picture: apparent age, hair colour and hairstyle (or fur/feather colours), skin tone, each clothing piece with its colour, at most two accessories. Only what is visible, no mood, no background.",
        JSON.stringify({ looks: Object.fromEntries(targets.map((entity) => [entity.name, "…"])) }),
      ].join("\n"),
      json: true,
      maxTokens: 2000,
      effort: "low",
      imageInputs: targets.map((entity) => entity.referenceUrl!),
      timeoutMs: 60_000,
    });
    const looks = parseJsonObject<any>(call.text)?.looks || {};
    return {
      call,
      entities: entities.map((entity) => {
        const look = targets.includes(entity) ? clean(looks[entity.name], 220) : "";
        return look && look !== "…" ? { ...entity, appearance: clean(`${look}. ${entity.appearance}`, 400) } : entity;
      }),
    };
  } catch (err) {
    console.warn("[storybook/illustration] reference looks failed:", (err as Error)?.message || err);
    return { entities };
  }
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
