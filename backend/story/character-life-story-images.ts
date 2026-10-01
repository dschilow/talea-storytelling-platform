/**
 * Picture planning for the "Talea Origins" character stories.
 *
 * Encore-free so it can be unit-tested. The generic Dev-engine illustrator is
 * built for casts of two or three children: it states "EXACTLY 1 named
 * character … no other people, creatures or background characters" and
 * "POSITION LOCK: one visible character, centered", gives every page the same
 * one-word setting and attaches the hero's portrait as the only reference. For a
 * story with ONE hero that produced five portraits of the same figure in the
 * same place, doing nothing (user, 2026-10-01).
 *
 * Here one director call reads the WHOLE story and writes a shot list: a
 * different place, light and camera for every picture, the hero caught
 * mid-action, and the opponents or companions the moment really has. The
 * prompt that reaches the image model is short and purely positive, built the
 * way the Bilderbuch pipeline's prompts are (scene → style → who is who →
 * what the reference is for).
 */

import type { LifeStoryMood } from "./character-life-story-prompt";

/** FLUX.2 [klein] 9B: follows a scene description far better than the 4B checkpoint (storybook A/B: 14/16 vs 7/16 clean pictures). */
export const LIFE_STORY_IMAGE_MODEL = "runware:400@2";

/** The generic cast pack minus its "no extra character / unlisted creature" entries: opponents are part of these pictures. */
export const LIFE_STORY_IMAGE_NEGATIVE = [
  "text", "readable typography", "letters", "words", "captions", "speech bubbles", "signage", "labels", "logos", "watermarks",
  "collage", "grid", "panels", "split screen", "picture frame", "colored borders", "reference strip", "portrait strip",
  "same figure twice", "twin copy of the hero", "merged bodies", "fused body parts", "extra limbs", "extra arms", "extra legs",
  "distorted anatomy", "bad anatomy", "malformed hands", "extra fingers", "floating limbs", "cropped head",
  "static pose", "posing at the camera", "passport photo", "plain background",
].join(", ");

export interface LifeStoryFigure {
  id: string;
  look: string;
}

export interface LifeStoryShot {
  camera: string;
  location: string;
  light: string;
  action: string;
  emotion: string;
  /** Ids of recurring figures (opponents, companions) in this picture, at most two. */
  with: string[];
  details: string;
}

export interface LifeStoryShotList {
  figures: LifeStoryFigure[];
  cover: LifeStoryShot;
  chapters: Array<LifeStoryShot & { order: number }>;
}

export interface ShotListInput {
  heroName: string;
  /** English look of the hero; empty when only the reference image knows it. */
  heroLook: string;
  mood: LifeStoryMood;
  title: string;
  /** `intro` marks the character introduction: the hero in the everyday place, in the middle of the signature habit. */
  chapters: Array<{ order: number; title: string; content: string; kind?: "intro" }>;
}

const MOOD_GUIDE: Record<LifeStoryMood, string> = {
  spooky: "pleasantly spooky: twilight and moonlight, mist, lantern and candle glow, long shadows, uncanny shapes — eerie but never gory; the funny moments still get a funny picture",
  comic: "loud comedy: exaggerated expressions, chaos, things flying, absurd situations, bright saturated light",
  adventure: "fast adventure with a wink: big landscapes, speed, danger and humour, vivid light",
};

const STYLE: Record<LifeStoryMood, string> = {
  spooky: "Soft watercolour and coloured-pencil picture-book illustration, moody twilight palette of deep blues and violets with warm lantern glow, long soft shadows, gentle storybook eeriness, expressive faces, one full-bleed scene with foreground, middle ground and background.",
  comic: "Soft watercolour and coloured-pencil picture-book illustration, bright saturated colours, exaggerated comic expressions, lively motion, one full-bleed scene with foreground, middle ground and background.",
  adventure: "Soft watercolour and coloured-pencil picture-book illustration, vivid adventurous palette, dramatic light, expressive faces, lively motion, one full-bleed scene with foreground, middle ground and background.",
};

export function buildShotListMessages(input: ShotListInput, feedback: string[] = []): { system: string; user: string } {
  const system = [
    "You are the art director of a thrilling, funny children's picture book about ONE hero.",
    "You plan the cover and one picture per chapter as a SHOT LIST. Answer with strict JSON only — no commentary, no markdown fences.",
  ].join(" ");

  const chapterText = input.chapters
    .map((chapter) => `[${chapter.order}] ${chapter.title}${chapter.kind === "intro" ? " (INTRODUCTION of the hero: show HERO in the everyday place, caught mid-way through the signature habit or quirk — full of character and funny, still an action, not a portrait)" : ""}\n${chapter.content.replace(/\s+/g, " ").trim()}`)
    .join("\n\n");

  const user = [
    `HERO: ${input.heroName}${input.heroLook ? ` — ${input.heroLook}` : " — looks exactly like the attached reference image"}`,
    `MOOD: ${MOOD_GUIDE[input.mood]}`,
    `STORY TITLE: ${input.title}`,
    "",
    "THE STORY (German):",
    chapterText,
    "",
    "WHAT MAKES THESE PICTURES GOOD — follow every rule:",
    "1. A DIFFERENT PLACE in every picture. Read where each chapter really happens and name a concrete, specific location (not \"a forest\" but \"a rope bridge over a misty gorge\"). No two pictures share a place or backdrop; the cover is yet another place or a bold new view.",
    "2. A DIFFERENT LIGHT in every picture: time of day, weather and colour follow the story's mood (dawn mist, golden noon, storm, candlelight, moonlit night).",
    "3. A DIFFERENT CAMERA in every picture, never the same twice in a row: wide establishing shot where the place dominates and the hero is small; medium action shot; low angle looking up; high angle looking down; over-the-shoulder; close-up on face and hands. Use at least one wide shot, one low angle and one close-up.",
    "4. The hero is caught MID-ACTION in the peak moment of the chapter: running, climbing, ducking, hurling, grabbing, tumbling, sneaking, leaping. Never standing, posing, a portrait or looking at the viewer. Face and body show the feeling.",
    "5. Opponents and companions: draw the figures the peak moment really has (the ghost, the dragon, the rival, the angry crowd). Define each recurring figure ONCE in \"figures\" with a fixed look (species, size, colours, markings, clothing) so it looks the same in every picture, and refer to it by id. At most two figures per picture besides the hero, standing clearly apart from the hero with air between the bodies. If the story has such figures, at least three of the five chapters show one.",
    "6. One or two concrete details of motion and atmosphere (flying sparks, billowing cloak, swinging lantern, splashing water).",
    "7. ENGLISH only. Write the hero as HERO, never by name. No readable text, signs or writing anywhere, no narration, no moral.",
    ...(feedback.length ? ["", "YOUR LAST ATTEMPT HAD THESE PROBLEMS — fix every one:", ...feedback.map((issue) => `- ${issue}`)] : []),
    "",
    "JSON shape (each field at most 25 words):",
    "{\"figures\":[{\"id\":\"f1\",\"look\":\"...\"}],",
    " \"cover\":{\"camera\":\"...\",\"location\":\"...\",\"light\":\"...\",\"action\":\"HERO ...\",\"emotion\":\"...\",\"with\":[\"f1\"],\"details\":\"...\"},",
    ` "chapters":[${input.chapters.map((chapter) => `{"order":${chapter.order},"camera":"...","location":"...","light":"...","action":"HERO ...","emotion":"...","with":[],"details":"..."}`).join(",")}]}`,
  ].join("\n");

  return { system, user };
}

function clip(value: unknown, max: number): string {
  const text = String(value ?? "").replace(/\s+/g, " ").replace(/[{}\[\]"]/g, "").trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}` : text;
}

function readShot(raw: any, figureIds: Set<string>): LifeStoryShot | null {
  if (!raw || typeof raw !== "object") return null;
  const location = clip(raw.location, 160);
  const action = clip(raw.action, 200);
  if (!location || !action) return null;
  const withIds: string[] = Array.isArray(raw.with)
    ? [...new Set<string>(raw.with.map((id: unknown) => String(id)).filter((id: string) => figureIds.has(id)))].slice(0, 2)
    : [];
  return {
    camera: clip(raw.camera, 100),
    location,
    light: clip(raw.light, 100),
    action,
    emotion: clip(raw.emotion, 100),
    with: withIds,
    details: clip(raw.details, 160),
  };
}

/** Null when the answer is not usable at all (no JSON, no cover, a missing chapter). */
export function parseShotList(raw: string, orders: number[]): LifeStoryShotList | null {
  let parsed: any;
  try {
    const text = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const figures: LifeStoryFigure[] = (Array.isArray(parsed?.figures) ? parsed.figures : [])
    .map((figure: any) => ({ id: clip(figure?.id, 20), look: clip(figure?.look, 220) }))
    .filter((figure: LifeStoryFigure) => figure.id && figure.look)
    .slice(0, 4);
  const figureIds = new Set(figures.map((figure) => figure.id));
  const cover = readShot(parsed?.cover, figureIds);
  if (!cover) return null;
  const chapters: LifeStoryShotList["chapters"] = [];
  for (const order of orders) {
    const found = (Array.isArray(parsed?.chapters) ? parsed.chapters : []).find((chapter: any) => Number(chapter?.order) === order);
    const shot = readShot(found, figureIds);
    if (!shot) return null;
    chapters.push({ ...shot, order });
  }
  return { figures, cover, chapters };
}

const PLACE_STOPWORDS = new Set(["the", "a", "an", "of", "in", "on", "at", "with", "and", "to", "its", "over", "under", "inside", "outside", "near", "into", "from", "dark", "old", "small", "large", "big"]);

function placeWords(location: string): Set<string> {
  return new Set(
    location.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 2 && !PLACE_STOPWORDS.has(word))
  );
}

function cameraClass(camera: string): string {
  const text = camera.toLowerCase();
  if (/over[- ]the[- ]shoulder/.test(text)) return "shoulder";
  if (/close|detail|macro/.test(text)) return "close";
  if (/low/.test(text)) return "low";
  if (/high|bird|top[- ]down|overhead/.test(text)) return "high";
  if (/wide|establishing|panoram|long shot/.test(text)) return "wide";
  if (/medium|mid/.test(text)) return "medium";
  return text;
}

/** What a human art director would send back: shared places, repeated cameras, posing. */
export function shotListIssues(list: LifeStoryShotList): string[] {
  const issues: string[] = [];
  const shots: Array<{ label: string; shot: LifeStoryShot }> = [
    { label: "the cover", shot: list.cover },
    ...list.chapters.map((chapter) => ({ label: `chapter ${chapter.order}`, shot: chapter as LifeStoryShot })),
  ];
  for (let i = 0; i < shots.length; i += 1) {
    const a = placeWords(shots[i].shot.location);
    for (let j = i + 1; j < shots.length; j += 1) {
      const b = placeWords(shots[j].shot.location);
      const shared = [...a].filter((word) => b.has(word)).length;
      const smaller = Math.min(a.size, b.size);
      if (smaller > 0 && shared / smaller >= 0.6) {
        issues.push(`${shots[i].label} and ${shots[j].label} are in nearly the same place ("${shots[i].shot.location}" / "${shots[j].shot.location}"). Give them clearly different places.`);
      }
    }
  }
  for (let i = 1; i < list.chapters.length; i += 1) {
    if (list.chapters[i].camera && cameraClass(list.chapters[i].camera) === cameraClass(list.chapters[i - 1].camera)) {
      issues.push(`chapters ${list.chapters[i - 1].order} and ${list.chapters[i].order} use the same camera. Change one.`);
    }
  }
  for (const { label, shot } of shots) {
    if (/\b(stands?|standing|poses?|posing|portrait|looks? at (?:the )?(?:camera|viewer)|smiles? at (?:the )?(?:camera|viewer))\b/i.test(shot.action)) {
      issues.push(`${label}: the hero is standing or posing ("${shot.action}"). Show a physical action instead.`);
    }
  }
  if (list.figures.length > 0 && !list.chapters.some((chapter) => chapter.with.length > 0)) {
    issues.push("figures are defined but no chapter shows one. Put the opponents or companions into the pictures where they appear.");
  }
  return issues;
}

/** One director call, one corrective retry. Null leaves the caller to its fallback. */
export async function planLifeStoryShots(
  callModel: (messages: { system: string; user: string }) => Promise<string>,
  input: ShotListInput
): Promise<{ list: LifeStoryShotList; issues: string[]; attempts: number } | null> {
  const orders = input.chapters.map((chapter) => chapter.order);
  let best: { list: LifeStoryShotList; issues: string[] } | null = null;
  let feedback: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let raw = "";
    try {
      raw = await callModel(buildShotListMessages(input, feedback));
    } catch (error) {
      console.warn("[character-life-story] shot list call failed", { attempt, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    const list = parseShotList(raw, orders);
    if (!list) {
      feedback = ["The answer was not valid JSON in the requested shape, or a chapter was missing. Return the complete JSON object."];
      continue;
    }
    const issues = shotListIssues(list);
    if (!best || issues.length < best.issues.length) best = { list, issues };
    if (issues.length === 0) return { ...best, attempts: attempt };
    feedback = issues;
  }
  return best ? { ...best, attempts: 2 } : null;
}

const FALLBACK_CAMERAS = ["wide establishing shot", "medium action shot", "low angle looking up", "close-up on face and hands", "high angle looking down", "over-the-shoulder shot"];
const FALLBACK_LIGHTS = ["warm morning light", "golden afternoon sun", "stormy grey light", "lantern light at dusk", "cold moonlight", "bright noon sun"];

/** Only when the director failed twice: varied cameras and light, the chapter title as the place cue. */
export function fallbackShotList(chapters: Array<{ order: number; title: string }>): LifeStoryShotList {
  const shot = (index: number, title: string): LifeStoryShot => ({
    camera: FALLBACK_CAMERAS[index % FALLBACK_CAMERAS.length],
    location: `the place that fits the chapter title "${title.replace(/["“”„]/g, "")}"`,
    light: FALLBACK_LIGHTS[index % FALLBACK_LIGHTS.length],
    action: "HERO is caught in the middle of an energetic movement, leaning into it with the whole body",
    emotion: "a clear, strong feeling on the face",
    with: [],
    details: "a few concrete details of motion in the air",
  });
  return {
    figures: [],
    cover: shot(0, "the whole story"),
    chapters: chapters.map((chapter, index) => ({ ...shot(index + 1, chapter.title), order: chapter.order })),
  };
}

const MAX_PROMPT_CHARS = 1700;

/** The positive prompt for one picture (cover when `kind` is "cover"). */
export function composeShotPrompt(input: {
  shot: LifeStoryShot;
  figures: LifeStoryFigure[];
  heroName: string;
  heroLook: string;
  mood: LifeStoryMood;
  kind: "cover" | "chapter";
  hasReference: boolean;
}): string {
  const { shot, heroName, heroLook } = input;
  const hero = (text: string) => text.replace(/\bHERO\b/g, heroName);
  const others = shot.with
    .map((id) => input.figures.find((figure) => figure.id === id))
    .filter((figure): figure is LifeStoryFigure => Boolean(figure));
  const count = 1 + others.length;

  const scene = [
    `${input.kind === "cover" ? "A bold, iconic frontispiece: " : ""}${shot.camera ? `${shot.camera}. ` : ""}${shot.location}${shot.light ? `, ${shot.light}` : ""}.`,
    `${hero(shot.action)}${shot.emotion ? `, ${hero(shot.emotion)}` : ""}.`,
    others.length > 0 ? `Clearly apart from ${heroName}, with open air between the bodies: ${others.map((figure) => `${figure.look}`).join("; and ")}.` : "",
    shot.details ? `${hero(shot.details)}.` : "",
  ].filter(Boolean).join(" ");

  const who = `Exactly ${count} figure${count === 1 ? "" : "s"}, each drawn once as its own separate body: ${heroName}${heroLook ? ` (${heroLook})` : ""}${others.map((figure) => `; ${figure.look}`).join("")}.`;
  const reference = input.hasReference
    ? `The attached image shows ${heroName}; use it only for ${heroName}'s face, hair, colours and outfit, in a completely new pose, place and framing, in this book's painting style.`
    : "";

  const prompt = [scene, STYLE[input.mood], who, reference].filter(Boolean).join("\n");
  return prompt.length <= MAX_PROMPT_CHARS ? prompt : [scene.slice(0, MAX_PROMPT_CHARS - 600), STYLE[input.mood], who.slice(0, 380), reference].filter(Boolean).join("\n");
}
