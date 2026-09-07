/**
 * Storybook Pipeline — illustrations.
 *
 * One support call produces every prompt (cover + all pages) at once, then the
 * Runware calls run in parallel. The old engine paid for a prompt call plus a
 * vision-QA loop plus retries per chapter; this does the same job for about a
 * tenth of a cent because the plan already knows what each page shows.
 *
 * Character consistency comes from the same mechanism the rest of the platform
 * uses: a sprite collage of the canonical reference images, with an explicit
 * per-slot identity contract in the prompt.
 */

import { ai } from "~encore/clients";
import { mapWithConcurrency } from "../../helpers/asyncPool";
import { resolveImageUrlForClient } from "../../helpers/bucket-storage";
import { buildSceneIllustrationPrompt, createIdentityReferenceCache, EMPTY_IDENTITY_REFERENCE, type IdentityReference } from "../image-reference-sprite";
import { callSupport, parseJsonObject, type LlmCallResult } from "./llm";
import { acceptedGeneratedImageUrl } from "../../helpers/imageResultGuard";
import type { KidLogicCard, StorybookCastMember, StorybookHero, StorybookPage } from "./types";

const STORYBOOK_IMAGE_MODEL = "runware:400@4";

const NEGATIVE_PROMPT = [
  "text, letters, words, watermark, signature, caption, speech bubble",
  "extra limbs, extra fingers, deformed hands, fused fingers, disfigured face",
  "multiple heads, duplicated characters, cloned faces",
  "photorealistic, 3d render, cgi, hyperrealistic skin",
  "dark, gloomy, scary, horror, gore, blood, weapons",
  "collage, grid, panel borders, split screen, picture frame",
  "nsfw, suggestive",
].join(", ");

const STYLE_SUFFIX = [
  "Children's picture-book illustration, warm and friendly.",
  "Soft watercolor and colored-pencil texture, clean confident linework, rounded shapes.",
  "Bright cheerful palette, gentle daylight, cosy atmosphere.",
  "Full-bleed single scene, no borders, no text anywhere in the image.",
].join(" ");

export interface StorybookImageInput {
  storyId?: string;
  title: string;
  card: KidLogicCard;
  pages: StorybookPage[];
  heroes: StorybookHero[];
  cast: StorybookCastMember[];
  /** Skip everything when the story did not clear its hard gates. */
  enabled: boolean;
}

export interface StorybookImageResult {
  coverImageUrl?: string;
  pageImages: Map<number, { imageUrl?: string; prompt: string }>;
  imagesGenerated: number;
  imageCalls: number;
  imageCostUSD: number;
  promptCall?: LlmCallResult;
}

interface ReferenceEntry {
  name: string;
  resolvedUrl: string;
  appearance: string;
}

/** Flattens a visual profile into a short English-ish appearance line. */
function appearanceFrom(visualProfile: any, fallback?: string): string {
  if (!visualProfile || typeof visualProfile !== "object") return String(fallback || "").slice(0, 200);
  const parts: string[] = [];
  const push = (value: unknown) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text && !["null", "undefined", "[object Object]"].includes(text)) parts.push(text);
  };

  push(visualProfile.characterType || visualProfile.species || visualProfile.speciesCategory);
  push(visualProfile.ageDescription || visualProfile.ageApprox);
  push([visualProfile.hair?.color, visualProfile.hair?.length, visualProfile.hair?.style].filter(Boolean).join(" "));
  push([visualProfile.eyes?.color, visualProfile.eyes?.shape].filter(Boolean).join(" "));
  push(visualProfile.skin?.tone);
  push(visualProfile.outfit || visualProfile.clothingCanonical?.outfit);
  if (Array.isArray(visualProfile.accessories)) visualProfile.accessories.slice(0, 3).forEach(push);
  if (Array.isArray(visualProfile.consistentDescriptors)) visualProfile.consistentDescriptors.slice(0, 6).forEach(push);

  const joined = parts.join(", ").replace(/[{}[\]"]/g, " ").replace(/\s{2,}/g, " ").trim();
  return (joined || String(fallback || "")).slice(0, 240);
}

async function buildReferences(input: StorybookImageInput): Promise<ReferenceEntry[]> {
  const candidates: Array<{ name: string; imageUrl?: string; appearance: string }> = [];

  for (const hero of input.heroes) {
    candidates.push({
      name: hero.name,
      imageUrl: hero.imageUrl,
      appearance: appearanceFrom(hero.visualProfile, hero.description),
    });
  }
  for (const member of input.cast) {
    candidates.push({
      name: member.name,
      imageUrl: member.imageUrl,
      appearance: appearanceFrom(member.visualProfile, member.physicalDescription || member.whoTheyAre),
    });
  }

  const resolved: ReferenceEntry[] = [];
  // The provider sees one sprite, so its reference-image limit must not cut
  // selected avatars or supporting characters out of the sprite itself.
  for (const candidate of candidates) {
    if (!candidate.imageUrl) continue;
    try {
      const url = await resolveImageUrlForClient(candidate.imageUrl);
      if (url) resolved.push({ name: candidate.name, resolvedUrl: url, appearance: candidate.appearance });
    } catch (err) {
      console.warn("[storybook/images] could not resolve reference image for", candidate.name, err);
    }
  }
  return resolved;
}

function buildPromptSystem(): string {
  return [
    "You write image prompts for a children's picture book illustrator.",
    "",
    "Rules:",
    "- English only.",
    "- One prompt per page, 30-55 words, describing ONE readable moment.",
    "- Name every character who is on stage, using the exact names given.",
    "- Say what they DO and where they are. Concrete nouns, no abstractions.",
    "- Never describe text, signs, labels or speech bubbles.",
    "- Never mention the story's magic as an explanation; describe only what the eye sees.",
    "",
    "Answer with a valid JSON object only.",
  ].join("\n");
}

function buildPromptUser(input: StorybookImageInput, references: ReferenceEntry[]): string {
  const lines: string[] = [];
  lines.push(`STORY TITLE: ${input.title}`);
  lines.push("");
  lines.push("CHARACTERS (use these exact names, keep their look consistent):");
  for (const hero of input.heroes) {
    lines.push(`- ${hero.name}: ${appearanceFrom(hero.visualProfile, hero.description) || "a child"}`);
  }
  for (const member of input.cast) {
    lines.push(`- ${member.name}: ${appearanceFrom(member.visualProfile, member.physicalDescription) || member.whoTheyAre}`);
  }
  lines.push("");
  lines.push(`KEY OBJECT that must be visible whenever it makes sense: ${input.card.ankerObjekt}`);
  lines.push("");
  lines.push("PAGES (what happens):");
  for (const page of input.pages) {
    const beat = input.card.seiten?.find((entry) => entry.nr === page.order)?.was || "";
    const excerpt = page.content.replace(/\s+/g, " ").slice(0, 320);
    lines.push(`- Page ${page.order}: ${beat}`);
    lines.push(`  text: ${excerpt}`);
  }
  lines.push("");
  if (references.length > 0) {
    lines.push(`Reference images exist for: ${references.map((entry) => entry.name).join(", ")}.`);
    lines.push("");
  }
  lines.push("Return JSON:");
  lines.push(
    JSON.stringify(
      {
        cover: "one prompt for the cover: the hero(es) with the key object, inviting, no text",
        pages: input.pages.map((page) => ({ nr: page.order, prompt: "…", characters: ["Name"] })),
      },
      null,
      1
    )
  );
  return lines.join("\n");
}

function fallbackPrompt(input: StorybookImageInput, order: number | "cover"): string {
  const names = [...input.heroes.map((h) => h.name), ...input.cast.map((c) => c.name)].slice(0, 3).join(" and ");
  if (order === "cover") {
    return `${names} together with ${input.card.ankerObjekt}, looking straight ahead, warm and inviting.`;
  }
  const beat = input.card.seiten?.find((entry) => entry.nr === order)?.was || input.card.kurzbeschreibung;
  return `${names} in the middle of the action: ${beat}`;
}

export async function generateStorybookImages(input: StorybookImageInput): Promise<StorybookImageResult> {
  const empty: StorybookImageResult = {
    pageImages: new Map(),
    imagesGenerated: 0,
    imageCalls: 0,
    imageCostUSD: 0,
  };
  if (!input.enabled || input.pages.length === 0) return empty;

  // 1) references + collage ------------------------------------------------
  let references: ReferenceEntry[] = [];
  try {
    references = await buildReferences(input);
  } catch (err) {
    console.warn("[storybook/images] reference build failed:", err);
  }

  let identityReference: IdentityReference = EMPTY_IDENTITY_REFERENCE;
  try {
    identityReference = await createIdentityReferenceCache()(references.map(entry => ({ imageUrl: entry.resolvedUrl, displayName: entry.name })));
  } catch {
    // Do not replace a failed sprite with multiple paid reference images or
    // pretend the resulting identity-free illustrations are consistent.
    console.warn("[storybook/images] reference sprite unavailable; skipped paid illustration calls");
    return empty;
  }

  // 2) all prompts in one support call -------------------------------------
  let prompts: { cover?: string; pages: Map<number, string> } = { pages: new Map() };
  const pageCharacters = new Map<number, string[]>();
  const allNames = [...input.heroes.map(h => h.name), ...input.cast.map(c => c.name)];
  let promptCall: LlmCallResult | undefined;
  try {
    promptCall = await callSupport({
      system: buildPromptSystem(),
      user: buildPromptUser(input, references),
      maxTokens: 900,
      json: true,
      temperature: 0.5,
    });
    const parsed = parseJsonObject<{ cover?: string; pages?: Array<{ nr: number; prompt: string; characters?: string[] }> }>(promptCall.text);
    if (parsed) {
      prompts.cover = String(parsed.cover || "").trim() || undefined;
      for (const entry of parsed.pages || []) {
        const nr = Number(entry?.nr);
        const prompt = String(entry?.prompt || "").trim();
        if (Number.isFinite(nr) && prompt) {
          prompts.pages.set(nr, prompt);
          if (Array.isArray(entry.characters) && entry.characters.every(name => allNames.includes(name))) pageCharacters.set(nr, [...new Set(entry.characters)]);
        }
      }
    }
  } catch (err) {
    console.warn("[storybook/images] prompt generation failed, using deterministic fallbacks:", err);
  }

  // 3) generate -------------------------------------------------------------
  type Job = { kind: "cover" | "page"; order?: number; scene: string; visibleNames: string[] };
  const jobs: Job[] = [
    { kind: "cover", scene: prompts.cover || fallbackPrompt(input, "cover"), visibleNames: input.heroes.map(h => h.name) },
    ...input.pages.map((page) => ({
      kind: "page" as const,
      order: page.order,
      scene: prompts.pages.get(page.order) || fallbackPrompt(input, page.order),
      visibleNames: pageCharacters.get(page.order) || allNames.slice(0, 3),
    })),
  ];

  let imageCalls = 0;
  let imageCostUSD = 0;

  const providerCost = (result: any): number => {
    const response = result?.debugInfo?.responseReceived;
    const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    return Number(
      rows.reduce((sum: number, row: any) => {
        const cost = Number(row?.cost || 0);
        return sum + (Number.isFinite(cost) && cost > 0 ? cost : 0);
      }, 0).toFixed(6)
    );
  };

  const results = await mapWithConcurrency(jobs, 3, async (job) => {
    const fullPrompt = buildSceneIllustrationPrompt(job.scene, STYLE_SUFFIX, identityReference, job.visibleNames);
    try {
      imageCalls += 1;
      const image = await ai.generateImage({
        prompt: fullPrompt,
        model: STORYBOOK_IMAGE_MODEL,
        negativePrompt: NEGATIVE_PROMPT,
        width: 1024,
        height: 1024,
        steps: 4,
        CFGScale: 4,
        outputFormat: "JPEG",
        referenceImages: identityReference.urls.length > 0 ? identityReference.urls : undefined,
        logContext: {
          storyId: input.storyId,
          stage: job.kind === "cover" ? "storybook-image-cover" : "storybook-image-page",
          chapter: job.order,
        },
      });
      const url = acceptedGeneratedImageUrl(image);
      imageCostUSD = Number((imageCostUSD + providerCost(image)).toFixed(6));
      return { job, imageUrl: url || undefined, prompt: fullPrompt };
    } catch (err) {
      console.warn(`[storybook/images] generation failed for ${job.kind}${job.order ?? ""}:`, (err as Error)?.message || err);
      return { job, imageUrl: undefined as string | undefined, prompt: fullPrompt };
    }
  });

  const pageImages = new Map<number, { imageUrl?: string; prompt: string }>();
  let coverImageUrl: string | undefined;
  let imagesGenerated = 0;

  for (const result of results) {
    if (result.job.kind === "cover") {
      coverImageUrl = result.imageUrl;
      if (result.imageUrl) imagesGenerated += 1;
      continue;
    }
    if (typeof result.job.order === "number") {
      pageImages.set(result.job.order, { imageUrl: result.imageUrl, prompt: result.prompt });
      if (result.imageUrl) imagesGenerated += 1;
    }
  }

  return { coverImageUrl, pageImages, imagesGenerated, imageCalls, imageCostUSD, promptCall };
}
