/**
 * Szenen, Stile und Prompt-Varianten des Benchmarks.
 *
 * Die Variante "current" ist der heutige Produktions-Prompt (assembleImagePrompt) — damit sind alle Messungen
 * mit dem Live-Betrieb vergleichbar. Die anderen ändern genau eine Sache.
 */
import {
  assembleImagePrompt,
  bindNamesToLooks,
  negativePromptFor,
  ownershipLine,
  STORYBOOK_IMAGE_STYLE_SHORT,
  type VisualEntity,
} from "../../../backend/story/storybook/illustration-stage";
import type { BuiltRefs } from "./refs";
import type { Figure } from "./roster";

export interface Scene {
  id: string;
  label: string;
  /** Wer im Bild ist (Namensanfang aus dem Roster). */
  cast: string[];
  text: string;
}

export const SCENES: Scene[] = [
  { id: "s1-solo", label: "1 Figur, Nahaufnahme", cast: ["Alexander"],
    text: "Close-up from slightly below: Alexander crouches at the edge of a forest stream and holds up a glowing blue pebble, his other hand pointing at it, golden afternoon light falling through the leaves." },
  { id: "s2-brothers", label: "2 ähnliche Kinder", cast: ["Alexander", "Adrian"],
    text: "Wide shot of a wobbly rope bridge over a misty canyon: Alexander walks ahead with his arms stretched out for balance, Adrian follows close behind and clings to the rope, both laughing." },
  { id: "s3-child-fox", label: "Kind + Tier", cast: ["Alexander", "Bo"],
    text: "Medium shot at a round wooden table in a cosy library: Alexander and Bo lean over an unrolled treasure map, Bo points a paw at a mark on it, Alexander holds a magnifying glass." },
  { id: "s4-three-humans", label: "3 Figuren, Mensch+Kinder", cast: ["Herr Seitenflug", "Alexander", "Adrian"],
    text: "Medium shot in a village reading room: Herr Seitenflug lets a small paper boat float above an open book on the table, Alexander and Adrian watch it with wide eyes from either side of the table." },
  { id: "s5-creatures", label: "3 Figuren, Fabelwesen", cast: ["Drache Fauchi", "Wolke Wuschel", "Adrian"],
    text: "Evening at a mossy cave entrance: Fauchi puffs a tiny flame into the air, Wuschel floats beside him and drops a few raindrops, Adrian crouches between them and holds out his hands to catch the drops." },
  // Varianten von s5 (Adrian wird mit Referenz oft doppelt gezeichnet): andere Formulierung / andere Reihenfolge auf dem Blatt
  { id: "s5b-creatures-infront", label: "s5 ohne „between them“", cast: ["Drache Fauchi", "Wolke Wuschel", "Adrian"],
    text: "Evening at a mossy cave entrance: Fauchi puffs a tiny flame into the air and Wuschel floats beside him, dropping a few raindrops. In front of them Adrian crouches and holds out his hands to catch the drops." },
  { id: "s5c-creatures-hero-first", label: "s5, Held zuerst auf dem Blatt", cast: ["Adrian", "Drache Fauchi", "Wolke Wuschel"],
    text: "Evening at a mossy cave entrance: Fauchi puffs a tiny flame into the air, Wuschel floats beside him and drops a few raindrops, Adrian crouches between them and holds out his hands to catch the drops." },
  { id: "s5d-creatures-both", label: "s5 neu formuliert + Held zuerst", cast: ["Adrian", "Drache Fauchi", "Wolke Wuschel"],
    text: "Evening at a mossy cave entrance: Fauchi puffs a tiny flame into the air and Wuschel floats beside him, dropping a few raindrops. In front of them Adrian crouches and holds out his hands to catch the drops." },
  { id: "s6-four", label: "4 Figuren", cast: ["Händler Gustav", "Alexander", "Adrian", "Wolke Wuschel"],
    text: "Wide shot of a sunny village market: Gustav shows a patterned scarf to Alexander and Adrian across his stall, while Wuschel floats above the stall and rains a little on a basket of apples." },
  { id: "s7-witch", label: "Kind + Hexe (Hut-Übertrag)", cast: ["Hexe Griselda", "Alexander"],
    text: "Medium shot in a smoky herb cottage: Griselda stirs a bubbling cauldron with a long wooden spoon while Alexander watches from a stool and holds his nose, laughing." },
];

export interface Style {
  key: string;
  text: string;
}

/** `watercolor` = STORYBOOK_IMAGE_STYLE_SHORT, der heutige Bilderbuch-Stil. */
export const STYLES: Style[] = [
  { key: "watercolor", text: STORYBOOK_IMAGE_STYLE_SHORT },
  { key: "gouache", text: "Hand-painted gouache picture-book illustration with visible brush texture, rich saturated colours, bold clear shapes, expressive faces, lively motion, one full-bleed scene." },
  { key: "flat-ink", text: "Modern European picture-book illustration: confident ink outlines, flat colour fills with a soft paper grain, simple readable shapes, a limited harmonious palette, expressive faces, one full-bleed scene." },
  { key: "cutpaper", text: "Layered cut-paper collage picture-book illustration: handmade paper textures, soft shadows between the layers, simple bold shapes, warm palette, expressive faces, one full-bleed scene." },
  { key: "soft3d", text: "Soft stylised 3D animated-film look: rounded clay-like forms, gentle subsurface light, warm cinematic colours, expressive faces, shallow depth of field, one full-bleed scene." },
  { key: "pencil-wash", text: "Loose coloured-pencil line with light watercolour washes on cream paper, airy sketchbook picture-book illustration, expressive faces, lively motion, one full-bleed scene." },
];

export const PROMPT_VARIANTS = ["current", "compact", "nolooks", "layout"] as const;
export type PromptVariant = (typeof PROMPT_VARIANTS)[number];

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

/** Ein Blatt mit mehreren Figuren wird zu „image 1, image 2 …“, sobald jede Figur ihr eigenes Bild hat. */
function toImageIndexPrompt(prompt: string, order: Figure[]): string {
  let text = prompt;
  order.forEach((_figure, index) => {
    text = text.replace(new RegExp(`, ${ORDINALS[index]} on the identity sheet`), `, image ${index + 1}`);
  });
  return text.replace(
    /The attached image is only an identity sheet[^\n]*/,
    `The attached reference images, in order: ${order.map((figure, index) => `image ${index + 1} is ${figure.name}`).join(", ")}. Take each figure's face, hair or fur, colours and outfit from its own image — the identity, not the painting style — and draw one single scene that contains all of them.`,
  );
}

function referenceLine(refs: BuiltRefs): string {
  const names = refs.order.map((figure) => figure.name);
  if (refs.mode === "single") return `The attached image shows ${names[0]}: keep ${names[0]}'s face, hair and outfit, in a new pose and in this book's painting style.`;
  if (refs.mode === "sheet") return `The attached image is an identity sheet, not part of the picture: left to right ${names.join(", ")}. Keep each figure's face, hair or fur and outfit; draw one single scene.`;
  if (refs.mode === "multi") return `${names.map((name, index) => `Image ${index + 1} is ${name}`).join(", ")}. Keep each figure's face, hair or fur and outfit exactly as in its own image; draw one single scene with all of them.`;
  return "";
}

function compactPrompt(scene: string, onStage: Figure[], refs: BuiltRefs, style: string): string {
  const characters = onStage.filter((figure) => figure.kind === "character");
  const bound = bindNamesToLooks(scene, characters);
  const withLooks = refs.mode === "none";
  const list = characters.map((figure) => (withLooks ? `${figure.name}: ${figure.appearance.slice(0, 170)}` : `${figure.name} (${figure.tag})`)).join("; ");
  const humans = characters.filter((figure) => figure.isHuman);
  const lines = [
    bound,
    style,
    `Exactly ${characters.length} figure${characters.length === 1 ? "" : "s"}, each drawn once: ${list}.`,
    humans.length ? `${humans.map((figure) => figure.name).join(" and ")} ${humans.length === 1 ? "is an ordinary human" : "are ordinary humans"} with natural faces and two five-fingered hands.` : "",
    ownershipLine(characters),
    referenceLine(refs),
  ];
  return lines.filter(Boolean).join("\n");
}

export interface BuiltPrompt {
  prompt: string;
  negative: string;
}

export function buildPrompt(variant: PromptVariant, ctx: { scene: Scene; onStage: Figure[]; refs: BuiltRefs; style: Style }): BuiltPrompt {
  const { scene, onStage, refs, style } = ctx;
  const negative = negativePromptFor(onStage as VisualEntity[], refs.mode === "sheet");
  if (variant === "compact") return { prompt: compactPrompt(scene.text, onStage, refs, style.text), negative };

  const entities: VisualEntity[] = variant === "nolooks" ? onStage.map((figure) => ({ ...figure, appearance: "" })) : onStage;
  let prompt = assembleImagePrompt({ scene: scene.text, onStage: entities, spriteOrder: refs.order });
  if (refs.mode === "multi") prompt = toImageIndexPrompt(prompt, refs.order);
  prompt = prompt.replace(STORYBOOK_IMAGE_STYLE_SHORT, style.text);
  // layout: Figuren in der Reihenfolge des Blatts von links nach rechts anordnen — jede Figur bekommt einen festen Platz.
  if (variant === "layout" && refs.order.length > 1) prompt += `
Compose the picture with the figures arranged from left to right in this order: ${refs.order.map((figure) => figure.name).join(", ")}.`;
  return { prompt, negative };
}
