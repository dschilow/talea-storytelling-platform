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
import { mentions } from "./checks";
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
  /** Stable original asset URL/id, before generating expiring signed URLs. */
  referenceKey?: string;
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
const HUMAN_WORD = /\b(human|mensch|person|child|kid|kind|boy|girl|junge|mädchen|man|woman|mann|frau)\b/i;
const CREATURE_WORD = /\b(animal|tier|dragon|drache|fox|fuchs|bear|bär|cat|katze|dog|hund|bird|vogel|owl|eule|frog|frosch|tortoise|turtle|schildkröte|mouse|maus|rabbit|hase|creature|wesen|robot|roboter|goblin|kobold|troll|monster|unicorn|einhorn|fairy|fee|elf|dwarf|zwerg)\b/i;

/**
 * Pool and avatar profiles say "human child astronomer" or "human child", not
 * just "human" — the exact match treated such children as creatures, and their
 * pictures lost the human-anatomy and child-face lines (A/B 2026-09-29).
 */
export function speciesFromProfile(visualProfile: any, fallbackSpecies?: string | null): { species: string; isHuman: boolean } {
  const raw = clean(visualProfile?.characterType || visualProfile?.speciesCategory || visualProfile?.species || fallbackSpecies || "human", 60).toLowerCase();
  const species = raw === "any" || raw === "" ? "character" : raw.replace(/_/g, " ");
  const isHuman = HUMAN_SPECIES.test(species) || (HUMAN_WORD.test(species) && !CREATURE_WORD.test(species));
  return { species: isHuman ? "human" : species, isHuman };
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

/** Cut at a word or comma boundary instead of mid-word ("Europ"). */
function clip(value: unknown, max: number): string {
  const text = clean(value, 2000);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf("; "), cut.lastIndexOf(". "));
  return (boundary > max * 0.5 ? cut.slice(0, boundary) : cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max)).trim();
}

/**
 * Pool prompts were written for a portrait ("Portrait of Theo Zeitsam, old
 * tortoise …, European storybook illustration, no text."). Only the look stays.
 */
function stripPortraitBoilerplate(text: string): string {
  return text
    .replace(/^portrait of\s+/i, "")
    .replace(/[,.]?\s*(european |watercolou?r |whimsical |classic )?(storybook|children'?s book|picture[- ]book) illustration( style)?.*$/i, "")
    .replace(/[,.]?\s*no text\.?\s*$/i, "")
    .replace(/\b(background|floating in zero gravity|cosmic background)[^.,]*/gi, "")
    .replace(/\s*,\s*,/g, ",")
    .trim()
    .replace(/[,.]$/, "");
}

/** English appearance for a pool character: its English image prompt beats the German description. */
export function castAppearance(visualProfile: any, physicalDescription?: string): string {
  const prompt = stripPortraitBoilerplate(clean(visualProfile?.imagePrompt, 400));
  if (prompt && looksEnglish(prompt)) return clean(prompt, 260);
  const description = clean(visualProfile?.description || physicalDescription, 260);
  return description;
}

export function negativePromptFor(onStage: VisualEntity[], usesSprite: boolean, historical = false): string {
  const base = [
    "text, letters, words, numbers, signage, caption, speech bubble, watermark, logo, artist signature, scribbled handwriting",
    "extra arms, extra hands, three hands, extra fingers, six fingers, fused fingers, missing fingers, deformed hands, extra legs, two heads, duplicated body parts, floating limbs",
    "duplicate character, same character twice, cloned face, unlisted character",
    "photorealistic, 3d render, cgi, harsh horror lighting, gore, blood, weapon pointed at someone",
  ];
  if (historical) base.push("washing machine, refrigerator, electric lamp, modern appliance, plastic");
  if (onStage.some((entity) => entity.kind === "character" && entity.isHuman)) {
    base.push("animal ears on a human, cat ears, fox ears, bunny ears, tail on a human, fur on human skin, horns on a human, human-animal hybrid, merged characters, child with an animal body");
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

/** Whole words: "tail" is not in "pigtails". */
function heroWears(heroText: string, feature: string): boolean {
  return new RegExp(`\\b${feature}s?\\b`, "i").test(heroText);
}

const SIGNATURE_FEATURES = /\b(witch hat|pointed hat|top hat|hat|bonnet|headband|apron|crown|tiara|cape|cloak|wings?|horns?|tail|shell|beard|moustache|mustache|antlers|halo)\b/gi;

/**
 * Story fix-0929-b: the witch's pointed hat landed on the children, the
 * dragon's wings on Mina; story 31a7a59d: the tortoise's shell on Adrian.
 * The signature features of every other figure on the page are forbidden on
 * the heroes by name of the feature.
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
      if (!heroWears(heroText, feature)) features.add(feature);
      // Run fix6-0929: the witch's pointed hat came back as a felt hat on Amir.
      if (/hat$/.test(feature) && !/\bhat\b/.test(heroText)) features.add("hat");
    }
    if (!entity.isHuman && /dragon|bird|bat|fairy|griffin|owl|butterfly|bee/i.test(entity.species)) features.add("wing");
  }
  return [...features].slice(0, 8).map((feature) => `child with ${feature === "wing" ? "wings" : `${/^[aeiou]/.test(feature) ? "an" : "a"} ${feature}`}`);
}

/**
 * FLUX.2 [klein] is guidance-distilled: A/B 2026-09-29 gave the same pictures at
 * CFG 1 and CFG 4, so the negative prompt barely acts. What must not travel
 * from one figure to another is said positively: "Only Hexe Griselda has a
 * witch hat; only Drache Fauchi has wings and a tail."
 */
const BODY_FEATURES = new Set(["wing", "tail", "shell", "horn", "antler"]);

export function ownershipLine(onStage: VisualEntity[]): string {
  if (!onStage.some((entity) => entity.role === "hero" && entity.isHuman)) return "";
  const heroText = onStage.filter((entity) => entity.role === "hero").map((entity) => entity.appearance.toLowerCase()).join(" ");
  const claims: string[] = [];
  for (const entity of onStage) {
    if (entity.role === "hero" || entity.kind !== "character") continue;
    const features = new Set<string>();
    for (const match of entity.appearance.matchAll(SIGNATURE_FEATURES)) {
      const feature = match[1].toLowerCase().replace(/s$/, "");
      if (!heroWears(heroText, feature)) features.add(feature);
    }
    if (!entity.isHuman && /dragon|bird|bat|fairy|griffin|owl|butterfly|bee/i.test(entity.species)) features.add("wing");
    // Body parts only. Naming clothing ("only Griselda has a witch hat") put
    // MORE witch hats and a green-skinned witch into the pictures (A/B G,
    // 2026-09-29) — clothing stays in the negative prompt.
    const list = [...features].filter((feature) => BODY_FEATURES.has(feature));
    if (list.length === 0) continue;
    const words = list.slice(0, 3).map((feature) => (feature === "wing" ? "wings" : `${/^[aeiou]/.test(feature) ? "an" : "a"} ${feature}`));
    claims.push(`only ${entity.name} has ${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0]}`);
  }
  if (claims.length === 0) return "";
  const sentence = claims.join("; ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/**
 * The final Runware prompt for FLUX.2 [klein] 9B (runware:400@2, 4 steps).
 *
 * Story 31a7a59d (2026-09-29): prompts of 3.000–3.500 characters, the sheet
 * contract and the redraw correction at the very end, and negations in the
 * positive prompt ("no beard", "Theo has the troll's orange beard" quoted from
 * the checker) — the tortoise's shell landed on Adrian three times. Now:
 *   scene → style → correction → who is who (with the sheet slot) → humans → objects → sheet,
 * only positive phrasing (negations live in the negative prompt), ≤ 1.900 chars.
 * Story 5b1b8b7a: with the style line last, the merchant came out as a dark
 * oil painting (the style of his pool portrait) — the style now comes second.
 */
export const MAX_IMAGE_PROMPT_CHARS = 1900;

export const STORYBOOK_IMAGE_STYLE_SHORT =
  "Soft watercolour and coloured-pencil picture-book illustration, warm light palette, one gentle style for every figure, expressive faces, lively motion, one full-bleed scene.";

export function assembleImagePrompt(input: {
  scene: string;
  onStage: VisualEntity[];
  spriteOrder: VisualEntity[];
  elements?: StoryElement[];
  correction?: string;
}): string {
  // Story A/B 2026-09-29: a 150-character cut took the witch's hat off her
  // look ("… black robe and pointed black hat"). Identity lines keep their
  // length; the scene gives way first.
  for (const [lookChars, sceneChars] of [[210, 650], [210, 480], [210, 380], [160, 360], [120, 320]] as const) {
    const prompt = buildImagePrompt(input, lookChars, sceneChars);
    if (prompt.length <= MAX_IMAGE_PROMPT_CHARS) return prompt;
  }
  return buildImagePrompt({ ...input, correction: undefined }, 100, 300).slice(0, MAX_IMAGE_PROMPT_CHARS);
}

function ordinal(index: number): string {
  return ["first", "second", "third", "fourth", "fifth"][index] || `${index + 1}th`;
}

function buildImagePrompt(
  input: { scene: string; onStage: VisualEntity[]; spriteOrder: VisualEntity[]; elements?: StoryElement[]; correction?: string },
  lookChars: number,
  sceneChars: number
): string {
  const characters = input.onStage.filter((entity) => entity.kind === "character");
  const objects = input.onStage.filter((entity) => entity.kind === "artifact");
  const figureElements = (input.elements || []).filter((element) => element.figure);
  const thingElements = (input.elements || []).filter((element) => !element.figure);
  const slotOf = (entity: VisualEntity) => input.spriteOrder.findIndex((sheet) => sheet.id === entity.id);

  const lines: string[] = [clip(input.scene, sceneChars), STORYBOOK_IMAGE_STYLE_SHORT];
  if (input.correction) lines.push(clip(input.correction, 320));

  const figures = [
    ...characters.map((entity) => {
      const kind = entity.isHuman ? (entity.role === "hero" ? "child" : "person") : entity.species;
      const slot = slotOf(entity);
      const where = slot >= 0 && input.spriteOrder.length > 1 ? `, ${ordinal(slot)} on the identity sheet` : "";
      return `${entity.name} (${kind}${entity.appearance ? `: ${clip(entity.appearance, lookChars)}` : ""}${where})`;
    }),
    // Story 422a3ba3 / runs fix2-0929: a recurring figure without a reference gets one fixed look.
    ...figureElements.map((element) => `${clean(element.name, 60)} (${clip(element.look, lookChars + 40)})`),
  ];
  if (figures.length > 0) {
    lines.push(`Exactly ${figures.length} figure${figures.length === 1 ? "" : "s"}, each drawn once as its own separate body: ${figures.join("; ")}.`);
  } else {
    lines.push("A scene without people.");
  }
  if (figureElements.length) lines.push("Each creature keeps its own described anatomy, limbs and covering, with a separate clear silhouette.");

  const humans = characters.filter((entity) => entity.isHuman);
  if (humans.length > 0) {
    const children = humans.filter((entity) => entity.role === "hero").map((entity) => entity.name);
    lines.push(`${humans.map((entity) => entity.name).join(" and ")} ${humans.length === 1 ? "is an ordinary human" : "are ordinary humans"} with natural faces and two five-fingered hands${children.length ? `; ${children.join(" and ")} ${children.length === 1 ? "has a smooth child's face" : "have smooth children's faces"}` : ""}. Everyone wears only their own clothes.`);
  }
  const owned = ownershipLine(characters);
  if (owned) lines.push(owned);

  for (const entity of objects) lines.push(`${entity.name}, an object: ${clip(entity.appearance, lookChars)}.`);
  for (const element of thingElements) lines.push(`${clean(element.name, 60)}, drawn exactly like this: ${clip(element.look, lookChars)}; a separate thing that nobody wears.`);

  if (input.spriteOrder.length > 1) {
    lines.push(`The attached image is only an identity sheet, not part of the picture: left to right ${input.spriteOrder.map((entity) => entity.name).join(", ")}. Take each figure's face, hair or fur, colours and outfit from its own place on the sheet — the identities, not the sheet's painting style — and draw one single scene.`);
  } else if (input.spriteOrder.length === 1) {
    lines.push(`The attached image shows ${input.spriteOrder[0].name}; use it only for ${input.spriteOrder[0].name}'s identity and outfit, in a new pose and in this book's painting style.`);
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
    "- Page 1 establishes the setting and introduces the heroes calmly BEFORE the disruption. Show its opening moment, not a frantic montage of everything on that page.",
    "- Exactly one instant, one pose per figure. Prefer separated silhouettes and clearly visible hands; avoid tangles of hands, sacks and bodies. Give each important prop ONE owner and a fixed position. Never combine before and after.",
    "- Repeated places and props keep their layout, material, scale and colour throughout the book (a waterwheel stays a wheel, never a boat).",
    "- Characters DO something physical and react to each other: running, tumbling, pulling, hiding, reaching, ducking, laughing, gasping. Faces and bodies show the emotion.",
    "- Never a lineup, never characters standing side by side looking at the viewer, never posing.",
    "- Choose a camera for each page and vary it from page to page: wide establishing shot, medium action shot, low angle looking up, high angle looking down, over-the-shoulder, close-up on a reaction or an object.",
    "- Show the place concretely: time of day, weather, light, and the props exactly in their CURRENT state on this page (broken, wet, tied up, glowing ...).",
    "- At most 3 FIGURES per picture in total, counting named characters AND figure story elements (a troll, a giant, a goose). If more are in the scene, pick the ones the moment needs and leave the others off-panel. List onStage in order of importance. Use only the ids given.",
    "- Say exactly WHO does WHAT and where each one is (left / right / foreground / on the ladder …). Use each visible character's exact name in scene AND its id in onStage. Never mention off-panel people in the scene. Never swap roles: if the text says Adrian climbs, Adrian is the one climbing.",
    "- Unnamed extras (a flock of geese, a crowd) only when the page needs them, fully described.",
    "- Any creature, animal, talking object or special thing that is NOT in the list above and appears on more than one page (also an ordinary goose, dog or broom): define it ONCE in storyElements with a fixed, drawable look (shape, size, colours, how it moves) and list its name in 'elements' on every picture where it appears. It is its own figure: a hat with legs is never worn by anyone, a talking cup is never just a cup on a table. Set figure:true for anything alive (a troll, a giant, a goose). Its look is concrete (species, skin or fur colour, clothes WITH colours) and clearly different from every listed character — never their clothes, hair or colours.",
    "- A coloured mark, line or stripe in the story (a red water mark, a blue ribbon) colours only that small thing — water, sky and ground keep their natural colours.",
    "- Every object fits the story's world: in a fairy-tale or fantasy world everything is old-fashioned (wood, stone, clay, copper, wicker) — no modern appliances, stainless steel, plastic, electric ovens, sinks with taps or cars.",
    // Story fc06c0d1: "the castle laundry" became two front-loading washing
    // machines. The image model draws the word, so name the old things instead.
    "- In a historical/fairy-tale world describe old furnishings rather than a bare room word: wooden washtubs, washboard, hand-cranked mangle; stone hearth and copper pot. In modern or science-fiction settings honour that world's technology instead.",
    "- Each picture happens exactly at this page's place from the text: an outdoor scene at a stream is never moved into a kitchen.",
    "- Only the listed characters plus extras the page needs. Never extra children in the background — they look like copies of the heroes.",
    "- Features belong to their owner: one character's moustache, crown, hat or cape is never drawn on anyone else.",
    "- No text, letters, labels or speech bubbles in any picture. Books, pages, letters and notes show simple pictures (a painted bear, berries), never writing — a painted scribble reads as nonsense. A sign may carry ONE short word only when the text names it, written in the scene in capitals and quotes (a sign reading \"BEEREN\").",
    "- English only, 45-80 words per scene. Describe only what the eye sees.",
    "- For a difficult shot (3 figures or overlapping limbs/props), also provide simpleScene: the SAME instant, actors and place in a simpler separated composition, at most 35 words. Otherwise omit it. focus is 'detail' ONLY for a deliberate close-up without any character.",
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
  world?: string;
}): string {
  const lines: string[] = [];
  lines.push(`BOOK: ${input.title}`);
  if (input.world) lines.push(`WORLD REQUESTED BY FAMILY: ${input.world}`);
  lines.push("");
  lines.push("CHARACTERS AND OBJECTS YOU MAY DRAW (use the ids):");
  for (const [index, entity] of input.entities.entries()) {
    lines.push(`- id e${index + 1}: ${entity.name} — ${entity.kind === "artifact" ? "magic object" : entity.species}; looks: ${entity.appearance || "see reference"}`);
  }
  lines.push("");
  lines.push("PAGES (final text; the planner's suggested picture in brackets):");
  for (const page of input.pages) {
    const planned = input.plan.pages.find((entry) => entry.page === page.order);
    lines.push(`PAGE ${page.order}${planned?.place ? ` — place: ${planned.place}` : ""}`);
    lines.push(page.content.replace(/\s+/g, " "));
    if (planned?.picture) lines.push(`[suggested picture: ${planned.picture}]`);
    lines.push("");
  }
  const artifact = input.entities.find((entity) => entity.kind === "artifact");
  lines.push(`Return JSON. onStage lists at most ${input.maxPerImage} character ids (never the object id). artifactVisible is true only when ${artifact ? `the object "${artifact.name}"` : "a catalogue object"} is actually visible.`);
  lines.push(
    JSON.stringify(
      {
        storyElements: [{ name: "name of a recurring figure or thing, or leave the list empty", look: "fixed English look", figure: true }],
        cover: { scene: "…", onStage: ["e1"], artifactVisible: false, elements: [] },
        pages: input.pages.map((page) => ({ page: page.order, scene: "…", onStage: ["e1"], artifactVisible: false, elements: [], focus: "scene" })),
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
  const characters = entities.filter((entity) => entity.kind === "character");
  const errors: string[] = [];
  const resolve = (value: unknown): string | undefined => {
    const key = String(value ?? "").trim();
    const entity = characters.find((entry) => entry.id === key) || entities.find((entry, index) => `e${index + 1}` === key.toLowerCase() && entry.kind === "character") || characters.find((entry) => entry.name.toLocaleLowerCase() === key.toLocaleLowerCase());
    if (!entity) errors.push(`Unknown character id: ${key}`);
    return entity?.id;
  };
  const onStage = [...new Set<string>((Array.isArray(raw?.onStage) ? raw.onStage : []).map(resolve).filter((id: unknown): id is string => typeof id === "string"))];
  // Recover an omitted manifest entry from an unambiguous exact name in the scene.
  for (const entity of characters) if (mentions(scene, entity.name) && !onStage.includes(entity.id)) {
    const ambiguous = characters.some((other) => other.id !== entity.id && mentions(other.name, entity.name));
    if (!ambiguous) onStage.push(entity.id);
  }
  const elements = [...new Set<string>((Array.isArray(raw?.elements) ? raw.elements : [])
    .map((name: unknown) => clean(name, 60))
    .filter((name: string) => elementNames.has(name)))];
  for (const name of elementNames) if (mentions(scene, name) && !elements.includes(name)) elements.push(name);
  if (onStage.length + elements.filter((name) => figureNames.has(name)).length > maxPerImage) errors.push(`Composition exceeds ${maxPerImage} figures; recompose instead of dropping identities.`);
  if (!onStage.length && !elements.some((name) => figureNames.has(name)) && raw?.focus !== "detail") errors.push("Empty character manifest; explicitly choose a detail shot or identify the visible figures.");
  return { page, scene, onStage, artifactVisible: Boolean(raw?.artifactVisible) && entities.some((entity) => entity.kind === "artifact"), elements,
    focus: raw?.focus === "detail" ? "detail" : "scene", simpleScene: clean(raw?.simpleScene, 420) || undefined,
    ...(errors.length ? { planningErrors: errors } : {}),
  };
}

/** Deterministic shot when the director call fails: the planner's picture, the planner's cast. */
export function fallbackShot(page: number, plan: StoryPlan, entities: VisualEntity[], maxPerImage: number): IllustrationShot {
  const characterIds = new Set(entities.filter((entity) => entity.kind === "character").map((entity) => entity.id));
  if (page === 0) {
    const heroes = plan.heroes.map((hero) => hero.id).filter((id) => characterIds.has(id)).slice(0, maxPerImage);
    return { page: 0, scene: `${plan.heroes.map((hero) => hero.name).join(" and ")} in an exciting moment of the story "${plan.title}": ${plan.pages[0]?.picture || plan.logline}`, onStage: heroes, artifactVisible: false, planningErrors: ["Missing director cover; compose from the final manuscript."] };
  }
  const planned = plan.pages.find((entry) => entry.page === page);
  return {
    page,
    scene: planned?.picture || planned?.action || plan.logline,
    onStage: (planned?.onPage || []).filter((id) => characterIds.has(id)).slice(0, maxPerImage),
    artifactVisible: false,
    planningErrors: ["Missing director page; compose from the final manuscript."],
  };
}

export function sanitizeIllustrationPlan(raw: any, pageCount: number, plan: StoryPlan, entities: VisualEntity[], maxPerImage: number): IllustrationPlan {
  const storyElements = sanitizeElements(raw?.storyElements);
  const elementNames = new Set(storyElements.map((element) => element.name));
  const figureNames = new Set(storyElements.filter((element) => element.figure).map((element) => element.name));
  const drafted = sanitizeShot(raw?.cover, 0, entities, maxPerImage, elementNames, figureNames) || fallbackShot(0, plan, entities, maxPerImage);
  // The cover always shows every hero (story 2db50859: Adrian was left off).
  const heroIds = entities.filter((entity) => entity.role === "hero").map((entity) => entity.id);
  const cover = { ...drafted, onStage: [...heroIds, ...drafted.onStage.filter((id) => !heroIds.includes(id))] };
  if (cover.onStage.length + (cover.elements || []).filter((name) => figureNames.has(name)).length > Math.max(maxPerImage, heroIds.length)) {
    cover.planningErrors = [...(cover.planningErrors || []), "Cover must keep every hero and simplify the other figures."];
  }
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
const referenceLookCache = new Map<string, { look: string; expires: number }>();
const REFERENCE_LOOK_TTL = 24 * 60 * 60 * 1000;

export async function describeReferenceLooks(
  llm: StorybookLlm,
  entities: VisualEntity[],
  model: string
): Promise<{ entities: VisualEntity[]; call?: LlmCallResult }> {
  // Heroes too: story 5b1b8b7a gave Alexander four different shirts in seven
  // pictures — the avatar profile had no outfit, the sheet alone did not hold it.
  const keyFor = (entity: VisualEntity) => JSON.stringify(["look-v2", model, entity.id, entity.referenceKey || entity.referenceUrl, entity.species, entity.appearance]);
  const now = Date.now();
  for (const [key, value] of referenceLookCache) if (value.expires <= now) referenceLookCache.delete(key);
  const withCachedLooks = entities.map((entity) => {
    const cached = referenceLookCache.get(keyFor(entity));
    return cached ? { ...entity, appearance: cached.look } : entity;
  });
  const targets = entities.filter((entity) => entity.kind === "character" && entity.referenceUrl && !referenceLookCache.has(keyFor(entity)));
  if (targets.length === 0) return { entities: withCachedLooks };
  try {
    const call = await llm({
      stage: "reference-looks",
      role: "support",
      model,
      system: "You describe character reference portraits for an illustrator. Answer with JSON only.",
      user: [
        ...targets.map((entity, index) => `Attachment ${index + 1} shows e${index + 1}: ${entity.name} (${entity.species}).`),
        // Distinctive item first, so no budget cut can drop it (A/B 2026-09-29:
        // variant H — fewest defects in both stories).
        "For each character write ONE English line, at most 25 words, of what stays the same in every picture. Start with the most distinctive thing (a pointed witch hat, wings, a crown, a shell, a star-patterned jacket), then apparent age, skin tone, hair colour and style (or fur/feather colours), the main clothing pieces with colours. Only what is visible, no mood, no background.",
        JSON.stringify({ looks: Object.fromEntries(targets.map((entity, index) => [`e${index + 1}`, "…"])) }),
      ].join("\n"),
      json: true,
      maxTokens: 2000,
      effort: "low",
      imageInputs: targets.map((entity) => entity.referenceUrl!),
      timeoutMs: 60_000,
    });
    const looks = parseJsonObject<any>(call.text)?.looks || {};
    for (const [index, entity] of targets.entries()) {
      const look = clean(looks[`e${index + 1}`] || looks[entity.name], 220);
      if (look.length < 15 || look === "…") continue;
      referenceLookCache.set(keyFor(entity), { look, expires: now + REFERENCE_LOOK_TTL });
      while (referenceLookCache.size > 512) referenceLookCache.delete(referenceLookCache.keys().next().value!);
    }
    return {
      call,
      entities: entities.map((entity) => {
        const look = referenceLookCache.get(keyFor(entity))?.look;
        // The look read off the portrait replaces the pool prompt (story 31a7a59d
        // carried both: 300 characters of duplicates per figure).
        return look && look !== "…" ? { ...entity, appearance: look } : entity;
      }),
    };
  } catch (err) {
    console.warn("[storybook/illustration] reference looks failed:", (err as Error)?.message || err);
    return { entities: withCachedLooks };
  }
}

export interface DirectorStageResult {
  illustrations: IllustrationPlan;
  call?: LlmCallResult;
  repairCall?: LlmCallResult;
}

export async function runDirectorStage(
  llm: StorybookLlm,
  input: { brief: StoryBrief; title: string; pages: StorybookPage[]; plan: StoryPlan; entities: VisualEntity[] },
  model: string
): Promise<DirectorStageResult> {
  const maxPerImage = input.brief.budget.maxCharactersPerImage;
  const result: DirectorStageResult = { illustrations: sanitizeIllustrationPlan(null, input.pages.length, input.plan, input.entities, maxPerImage) };
  try {
    const call = await llm({
      stage: "illustration-direction",
      role: "support",
      model,
      system: buildDirectorSystemPrompt(),
      user: buildDirectorUserPrompt({ ...input, maxPerImage, world: `${input.brief.config.genre || ""}; ${input.brief.config.setting || ""}` }),
      json: true,
      maxTokens: 1500 + input.pages.length * 500,
      effort: "low",
      temperature: 0.6,
    });
    result.call = call;
    result.illustrations = sanitizeIllustrationPlan(parseJsonObject<any>(call.text), input.pages.length, input.plan, input.entities, maxPerImage);
  } catch (err) {
    console.warn("[storybook/illustration] director failed, using planner pictures:", (err as Error)?.message || err);
  }
  const invalid = [result.illustrations.cover, ...result.illustrations.pages].filter((shot) => shot.planningErrors?.length);
  if (!invalid.length) return result;
  try {
    // One batch repair before images: cheaper than repeatedly rendering an invalid cast.
    const repair = await llm({
      stage: "illustration-plan-repair", role: "support", model, json: true, effort: "low",
      maxTokens: 1000 + invalid.length * 500,
      system: buildDirectorSystemPrompt(),
      user: [
        buildDirectorUserPrompt({ ...input, pages: input.pages.filter((page) => invalid.some((shot) => shot.page === page.order || shot.page === 0 && page.order === 1)), maxPerImage, world: `${input.brief.config.genre || ""}; ${input.brief.config.setting || ""}` }),
        `Keep these fixed story elements: ${JSON.stringify(result.illustrations.storyElements || [])}`,
        `Repair ONLY these shots. Retain the story action but simplify crowded scenes. Every visible named figure must have its id, every visible recurring element its name. Cover keeps all heroes.\n${JSON.stringify(invalid)}`,
      ].join("\n"),
    });
    result.repairCall = repair;
    const raw = parseJsonObject<any>(repair.text);
    if (raw) {
      const candidate = sanitizeIllustrationPlan({
        ...raw,
        storyElements: result.illustrations.storyElements?.length ? result.illustrations.storyElements : raw.storyElements,
      }, input.pages.length, input.plan, input.entities, maxPerImage);
      if (invalid.some((shot) => shot.page === 0) && !candidate.cover.planningErrors?.length) result.illustrations.cover = candidate.cover;
      result.illustrations.pages = result.illustrations.pages.map((shot) => {
        const fixed = candidate.pages.find((page) => page.page === shot.page);
        return shot.planningErrors?.length && fixed && !fixed.planningErrors?.length ? fixed : shot;
      });
      result.illustrations.storyElements = candidate.storyElements;
    }
  } catch (err) {
    console.warn("[storybook/illustration] shot repair unavailable:", (err as Error)?.message || err);
  }
  return result;
}
