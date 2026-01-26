// Artifact Pool Management API
// Endpoints for managing the artifact pool

import { api, APIError } from "encore.dev/api";
import { storyDB } from "./db";
import type { ArtifactCategory, ArtifactRarity, ArtifactTemplate } from "./types";
import { runwareGenerateImage } from "../ai/image-generation";
import {
  maybeUploadImageUrlToBucket,
  normalizeImageUrlForStorage,
  resolveImageUrlForClient,
} from "../helpers/bucket-storage";

let imageColumnEnsured = false;

async function ensureImageUrlColumn(): Promise<void> {
  if (imageColumnEnsured) {
    return;
  }

  try {
    await storyDB.exec`
      ALTER TABLE artifact_pool
      ADD COLUMN IF NOT EXISTS image_url TEXT
    `;
  } catch (err) {
    console.error("[ArtifactPool] Failed ensuring image_url column:", err);
  } finally {
    imageColumnEnsured = true;
  }
}

function rowToArtifactTemplate(row: any): ArtifactTemplate {
  return {
    id: row.id,
    name: {
      de: row.name_de,
      en: row.name_en,
    },
    description: {
      de: row.description_de,
      en: row.description_en,
    },
    category: row.category as ArtifactCategory,
    rarity: row.rarity as ArtifactRarity,
    storyRole: row.story_role,
    discoveryScenarios: row.discovery_scenarios || [],
    usageScenarios: row.usage_scenarios || [],
    emoji: row.emoji || undefined,
    visualKeywords: row.visual_keywords || [],
    imageUrl: row.image_url || undefined,
    genreAffinity: {
      adventure: parseFloat(row.genre_adventure) || 0.5,
      fantasy: parseFloat(row.genre_fantasy) || 0.5,
      mystery: parseFloat(row.genre_mystery) || 0.5,
      nature: parseFloat(row.genre_nature) || 0.5,
      friendship: parseFloat(row.genre_friendship) || 0.5,
      courage: parseFloat(row.genre_courage) || 0.5,
      learning: parseFloat(row.genre_learning) || 0.5,
    },
    recentUsageCount: row.recent_usage_count || 0,
    totalUsageCount: row.total_usage_count || 0,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    lastUsedInStoryId: row.last_used_in_story_id || undefined,
    isActive: row.is_active ?? true,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

async function resolveArtifactForClient(artifact: ArtifactTemplate): Promise<ArtifactTemplate> {
  const resolvedImageUrl = await resolveImageUrlForClient(artifact.imageUrl);
  return {
    ...artifact,
    imageUrl: resolvedImageUrl ?? artifact.imageUrl,
  };
}

async function fetchAllArtifacts(): Promise<ArtifactTemplate[]> {
  await ensureImageUrlColumn();

  const rows = await storyDB.queryAll<{
    id: string;
    name_de: string;
    name_en: string;
    description_de: string;
    description_en: string;
    category: string;
    rarity: string;
    story_role: string;
    discovery_scenarios: string[];
    usage_scenarios: string[];
    emoji: string | null;
    visual_keywords: string[];
    image_url: string | null;
    genre_adventure: string;
    genre_fantasy: string;
    genre_mystery: string;
    genre_nature: string;
    genre_friendship: string;
    genre_courage: string;
    genre_learning: string;
    recent_usage_count: number;
    total_usage_count: number;
    last_used_at: Date | null;
    last_used_in_story_id: string | null;
    created_at: Date;
    updated_at: Date;
    is_active: boolean;
  }>`
    SELECT * FROM artifact_pool ORDER BY name_de
  `;

  return rows.map(rowToArtifactTemplate);
}

// ===== GET ALL ARTIFACTS =====
export const listArtifacts = api(
  { expose: true, method: "GET", path: "/story/artifact-pool", auth: true },
  async (): Promise<{ artifacts: ArtifactTemplate[] }> => {
    console.log("[ArtifactPool] Listing all artifacts");
    const artifacts = await fetchAllArtifacts();
    const resolvedArtifacts = await Promise.all(artifacts.map(resolveArtifactForClient));
    console.log(`[ArtifactPool] Found ${artifacts.length} artifacts`);
    return { artifacts: resolvedArtifacts };
  }
);

// ===== GET ARTIFACT BY ID =====
interface GetArtifactRequest {
  id: string;
}

export const getArtifact = api<GetArtifactRequest, ArtifactTemplate>(
  { expose: true, method: "GET", path: "/story/artifact-pool/:id", auth: true },
  async (req): Promise<ArtifactTemplate> => {
    console.log("[ArtifactPool] Getting artifact:", req.id);
    await ensureImageUrlColumn();

    const row = await storyDB.queryRow<{
      id: string;
      name_de: string;
      name_en: string;
      description_de: string;
      description_en: string;
      category: string;
      rarity: string;
      story_role: string;
      discovery_scenarios: string[];
      usage_scenarios: string[];
      emoji: string | null;
      visual_keywords: string[];
      image_url: string | null;
      genre_adventure: string;
      genre_fantasy: string;
      genre_mystery: string;
      genre_nature: string;
      genre_friendship: string;
      genre_courage: string;
      genre_learning: string;
      recent_usage_count: number;
      total_usage_count: number;
      last_used_at: Date | null;
      last_used_in_story_id: string | null;
      created_at: Date;
      updated_at: Date;
      is_active: boolean;
    }>`
      SELECT * FROM artifact_pool WHERE id = ${req.id}
    `;

    if (!row) {
      throw APIError.notFound("Artifact not found");
    }

    return await resolveArtifactForClient(rowToArtifactTemplate(row));
  }
);

// ===== ADD ARTIFACT TO POOL =====
interface AddArtifactRequest {
  artifact: Omit<ArtifactTemplate, "id" | "createdAt" | "updatedAt" | "recentUsageCount" | "totalUsageCount" | "lastUsedAt" | "lastUsedInStoryId">;
}

export const addArtifact = api<AddArtifactRequest, ArtifactTemplate>(
  { expose: true, method: "POST", path: "/story/artifact-pool", auth: true },
  async (req): Promise<ArtifactTemplate> => {
    const id = crypto.randomUUID();
    const now = new Date();

    console.log("[ArtifactPool] Adding new artifact:", req.artifact.name?.de || req.artifact.name?.en);

    await ensureImageUrlColumn();

    const normalizedImageUrl = req.artifact.imageUrl
      ? await normalizeImageUrlForStorage(req.artifact.imageUrl)
      : undefined;
    const uploadedImage = normalizedImageUrl
      ? await maybeUploadImageUrlToBucket(normalizedImageUrl, {
          prefix: "images/artifacts",
          filenameHint: `artifact-${id}`,
          uploadMode: "data",
        })
      : null;
    const finalImageUrl = uploadedImage?.url ?? normalizedImageUrl;

    await storyDB.exec`
      INSERT INTO artifact_pool (
        id, name_de, name_en, description_de, description_en,
        category, rarity, story_role,
        discovery_scenarios, usage_scenarios,
        emoji, visual_keywords, image_url,
        genre_adventure, genre_fantasy, genre_mystery, genre_nature,
        genre_friendship, genre_courage, genre_learning,
        recent_usage_count, total_usage_count, last_used_at, last_used_in_story_id,
        is_active, created_at, updated_at
      ) VALUES (
        ${id},
        ${req.artifact.name.de},
        ${req.artifact.name.en},
        ${req.artifact.description.de},
        ${req.artifact.description.en},
        ${req.artifact.category},
        ${req.artifact.rarity},
        ${req.artifact.storyRole},
        ${req.artifact.discoveryScenarios},
        ${req.artifact.usageScenarios},
        ${req.artifact.emoji || null},
        ${req.artifact.visualKeywords},
        ${finalImageUrl || null},
        ${req.artifact.genreAffinity.adventure},
        ${req.artifact.genreAffinity.fantasy},
        ${req.artifact.genreAffinity.mystery},
        ${req.artifact.genreAffinity.nature},
        ${req.artifact.genreAffinity.friendship},
        ${req.artifact.genreAffinity.courage},
        ${req.artifact.genreAffinity.learning},
        0,
        0,
        ${null},
        ${null},
        ${req.artifact.isActive ?? true},
        ${now},
        ${now}
      )
    `;

    console.log("[ArtifactPool] Artifact added:", id);

    const resolvedImageUrl = await resolveImageUrlForClient(finalImageUrl);

    return {
      id,
      ...req.artifact,
      imageUrl: resolvedImageUrl ?? finalImageUrl,
      recentUsageCount: 0,
      totalUsageCount: 0,
      lastUsedAt: undefined,
      lastUsedInStoryId: undefined,
      createdAt: now,
      updatedAt: now,
    };
  }
);

// ===== UPDATE ARTIFACT =====
interface UpdateArtifactRequest {
  id: string;
  updates: Partial<Omit<ArtifactTemplate, "id" | "createdAt" | "updatedAt">>;
}

export const updateArtifact = api<UpdateArtifactRequest, ArtifactTemplate>(
  { expose: true, method: "PUT", path: "/story/artifact-pool/:id", auth: true },
  async (req): Promise<ArtifactTemplate> => {
    console.log("[ArtifactPool] Updating artifact:", req.id);

    await ensureImageUrlColumn();

    const now = new Date();

    if (req.updates.name) {
      await storyDB.exec`
        UPDATE artifact_pool SET name_de = ${req.updates.name.de}, name_en = ${req.updates.name.en}, updated_at = ${now}
        WHERE id = ${req.id}
      `;
    }
    if (req.updates.description) {
      await storyDB.exec`
        UPDATE artifact_pool SET description_de = ${req.updates.description.de}, description_en = ${req.updates.description.en}, updated_at = ${now}
        WHERE id = ${req.id}
      `;
    }
    if (req.updates.category !== undefined) {
      await storyDB.exec`UPDATE artifact_pool SET category = ${req.updates.category}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.rarity !== undefined) {
      await storyDB.exec`UPDATE artifact_pool SET rarity = ${req.updates.rarity}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.storyRole !== undefined) {
      await storyDB.exec`UPDATE artifact_pool SET story_role = ${req.updates.storyRole}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.discoveryScenarios !== undefined) {
      await storyDB.exec`
        UPDATE artifact_pool SET discovery_scenarios = ${req.updates.discoveryScenarios}, updated_at = ${now}
        WHERE id = ${req.id}
      `;
    }
    if (req.updates.usageScenarios !== undefined) {
      await storyDB.exec`
        UPDATE artifact_pool SET usage_scenarios = ${req.updates.usageScenarios}, updated_at = ${now}
        WHERE id = ${req.id}
      `;
    }
    if (req.updates.emoji !== undefined) {
      await storyDB.exec`UPDATE artifact_pool SET emoji = ${req.updates.emoji}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.visualKeywords !== undefined) {
      await storyDB.exec`
        UPDATE artifact_pool SET visual_keywords = ${req.updates.visualKeywords}, updated_at = ${now}
        WHERE id = ${req.id}
      `;
    }
    if (req.updates.imageUrl !== undefined) {
      const normalizedImageUrl = req.updates.imageUrl
        ? await normalizeImageUrlForStorage(req.updates.imageUrl)
        : null;
      const uploadedImage = normalizedImageUrl
        ? await maybeUploadImageUrlToBucket(normalizedImageUrl, {
            prefix: "images/artifacts",
            filenameHint: `artifact-${req.id}`,
            uploadMode: "data",
          })
        : null;
      const finalImageUrl = uploadedImage?.url ?? normalizedImageUrl;

      await storyDB.exec`UPDATE artifact_pool SET image_url = ${finalImageUrl}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.genreAffinity) {
      await storyDB.exec`
        UPDATE artifact_pool
        SET genre_adventure = ${req.updates.genreAffinity.adventure},
            genre_fantasy = ${req.updates.genreAffinity.fantasy},
            genre_mystery = ${req.updates.genreAffinity.mystery},
            genre_nature = ${req.updates.genreAffinity.nature},
            genre_friendship = ${req.updates.genreAffinity.friendship},
            genre_courage = ${req.updates.genreAffinity.courage},
            genre_learning = ${req.updates.genreAffinity.learning},
            updated_at = ${now}
        WHERE id = ${req.id}
      `;
    }
    if (req.updates.isActive !== undefined) {
      await storyDB.exec`UPDATE artifact_pool SET is_active = ${req.updates.isActive}, updated_at = ${now} WHERE id = ${req.id}`;
    }

    console.log("[ArtifactPool] Artifact updated:", req.id);

    return getArtifact({ id: req.id });
  }
);

// ===== GENERATE ARTIFACT IMAGE =====
interface GenerateArtifactImageRequest {
  id: string;
  style?: "storybook" | "watercolor" | "concept";
}

interface GenerateArtifactImageResponse {
  artifactId: string;
  imageUrl: string;
  prompt: string;
  debugInfo?: Record<string, unknown>;
}

export const generateArtifactImage = api<GenerateArtifactImageRequest, GenerateArtifactImageResponse>(
  { expose: true, method: "POST", path: "/story/artifact-pool/:id/generate-image", auth: true },
  async (req): Promise<GenerateArtifactImageResponse> => {
    console.log("[ArtifactPool] Generating image for artifact:", req.id);

    const artifact = await getArtifact({ id: req.id });
    const prompt = buildArtifactImagePrompt(artifact, req.style);

    // OPTIMIZATION v4.0: Use runware:400@4 with optimized parameters
    const result = await runwareGenerateImage({
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,     // runware:400@4 uses fewer steps
      CFGScale: 4,
      outputFormat: "WEBP",
      negativePrompt: "text, watermark, characters, humans, hands, faces, low quality, blurry, distorted, deformed",
    });

    console.log("[ArtifactPool] Artifact image generation completed:", {
      id: req.id,
      hasUrl: Boolean(result.imageUrl),
      promptLength: prompt.length,
    });

    const resolvedImageUrl = await resolveImageUrlForClient(result.imageUrl);

    return {
      artifactId: req.id,
      imageUrl: resolvedImageUrl ?? result.imageUrl,
      prompt,
      debugInfo: result.debugInfo as unknown as Record<string, unknown>,
    };
  }
);

// ===== DELETE ARTIFACT (soft delete) =====
interface DeleteArtifactRequest {
  id: string;
}

export const deleteArtifact = api<DeleteArtifactRequest, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/story/artifact-pool/:id", auth: true },
  async (req): Promise<{ success: boolean }> => {
    console.log("[ArtifactPool] Soft deleting artifact:", req.id);

    await storyDB.exec`
      UPDATE artifact_pool
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.id}
    `;

    console.log("[ArtifactPool] Artifact deleted:", req.id);

    return { success: true };
  }
);

// ===== EXPORT ARTIFACTS =====
export const exportArtifacts = api(
  { expose: true, method: "GET", path: "/story/artifact-pool/export", auth: true },
  async (): Promise<{ artifacts: ArtifactTemplate[] }> => {
    console.log("[ArtifactPool] Exporting all artifacts");
    const artifacts = await fetchAllArtifacts();
    console.log(`[ArtifactPool] Export payload size: ${artifacts.length} artifacts`);
    return { artifacts };
  }
);

// ===== BATCH REGENERATE ALL ARTIFACT IMAGES =====
interface BatchRegenerateImagesResponse {
  success: boolean;
  total: number;
  generated: number;
  failed: number;
  results: Array<{
    artifactId: string;
    artifactName: string;
    success: boolean;
    imageUrl?: string;
    error?: string;
  }>;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await handler(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export const batchRegenerateArtifactImages = api<{}, BatchRegenerateImagesResponse>(
  { expose: true, method: "POST", path: "/story/artifact-pool/batch-regenerate-images", auth: true },
  async (): Promise<BatchRegenerateImagesResponse> => {
    console.log("[ArtifactPool] Starting batch regeneration of all artifact images");

    const artifacts = await fetchAllArtifacts();
    const activeArtifacts = artifacts.filter(a => a.isActive);

    console.log(`[ArtifactPool] Found ${activeArtifacts.length} active artifacts to regenerate`);

    const rawLimit = Number(process.env.IMAGE_BATCH_CONCURRENCY || "3");
    const concurrency = Math.max(1, Math.min(rawLimit, 6));
    console.log(`[ArtifactPool] Using parallel generation (concurrency=${concurrency})`);

    const results = await runWithConcurrency(
      activeArtifacts,
      concurrency,
      async (artifact): Promise<BatchRegenerateImagesResponse['results'][number]> => {
        try {
          console.log(`[ArtifactPool] Generating image for: ${artifact.name.de}`);

          const prompt = buildArtifactImagePrompt(artifact, "storybook");
          const result = await runwareGenerateImage({
            prompt,
            width: 1024,
            height: 1024,
            steps: 4,
            CFGScale: 4,
            outputFormat: "WEBP",
            negativePrompt: "text, watermark, characters, humans, hands, faces, low quality, blurry, distorted, deformed",
          });

          if (result.imageUrl) {
            await storyDB.exec`
              UPDATE artifact_pool
              SET image_url = ${result.imageUrl}, updated_at = ${new Date()}
              WHERE id = ${artifact.id}
            `;

            console.log(`[ArtifactPool] Generated image for ${artifact.name.de}`);
            return {
              artifactId: artifact.id,
              artifactName: artifact.name.de || artifact.name.en,
              success: true,
              imageUrl: result.imageUrl,
            };
          }

          console.warn(`[ArtifactPool] No image URL for ${artifact.name.de}`);
          return {
            artifactId: artifact.id,
            artifactName: artifact.name.de || artifact.name.en,
            success: false,
            error: "No image URL returned",
          };
        } catch (error) {
          console.error(`[ArtifactPool] Failed to generate image for ${artifact.name.de}:`, error);
          return {
            artifactId: artifact.id,
            artifactName: artifact.name.de || artifact.name.en,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    );

    const generated = results.filter(r => r.success).length;
    const failed = results.length - generated;

    console.log(`[ArtifactPool] Batch regeneration completed: ${generated} generated, ${failed} failed`);

    return {
      success: failed === 0,
      total: activeArtifacts.length,
      generated,
      failed,
      results,
    };
  }
);

// ===== IMPORT ARTIFACTS =====
interface ImportArtifactsRequest {
  artifacts: ArtifactTemplate[];
}

export const importArtifacts = api<ImportArtifactsRequest, { success: boolean; imported: number }>(
  { expose: true, method: "POST", path: "/story/artifact-pool/import", auth: true },
  async (req): Promise<{ success: boolean; imported: number }> => {
    console.log("[ArtifactPool] Importing artifacts");

    if (!Array.isArray(req.artifacts) || req.artifacts.length === 0) {
      throw APIError.invalidArgument("Import requires at least one artifact");
    }

    await ensureImageUrlColumn();

    const now = new Date();
    const sanitized = req.artifacts.map((artifact, index) => sanitizeArtifact(artifact, index, now));

    try {
      await storyDB.exec`BEGIN`;
      await storyDB.exec`DELETE FROM artifact_pool`;

      for (const artifact of sanitized) {
        await storyDB.exec`
          INSERT INTO artifact_pool (
            id, name_de, name_en, description_de, description_en,
            category, rarity, story_role,
            discovery_scenarios, usage_scenarios,
            emoji, visual_keywords, image_url,
            genre_adventure, genre_fantasy, genre_mystery, genre_nature,
            genre_friendship, genre_courage, genre_learning,
            recent_usage_count, total_usage_count, last_used_at, last_used_in_story_id,
            is_active, created_at, updated_at
          ) VALUES (
            ${artifact.id},
            ${artifact.name.de},
            ${artifact.name.en},
            ${artifact.description.de},
            ${artifact.description.en},
            ${artifact.category},
            ${artifact.rarity},
            ${artifact.storyRole},
            ${artifact.discoveryScenarios},
            ${artifact.usageScenarios},
            ${artifact.emoji || null},
            ${artifact.visualKeywords},
            ${artifact.imageUrl || null},
            ${artifact.genreAffinity.adventure},
            ${artifact.genreAffinity.fantasy},
            ${artifact.genreAffinity.mystery},
            ${artifact.genreAffinity.nature},
            ${artifact.genreAffinity.friendship},
            ${artifact.genreAffinity.courage},
            ${artifact.genreAffinity.learning},
            ${artifact.recentUsageCount},
            ${artifact.totalUsageCount},
            ${artifact.lastUsedAt || null},
            ${artifact.lastUsedInStoryId || null},
            ${artifact.isActive},
            ${artifact.createdAt},
            ${artifact.updatedAt}
          )
        `;
      }

      await storyDB.exec`COMMIT`;
      console.log(`[ArtifactPool] Import completed. Inserted ${sanitized.length} artifacts`);

      return { success: true, imported: sanitized.length };
    } catch (error) {
      console.error("[ArtifactPool] Import failed, rolling back:", error);
      await storyDB.exec`ROLLBACK`;
      throw APIError.internal(`Artifact import failed: ${(error as Error).message}`);
    }
  }
);

function buildArtifactImagePrompt(
  artifact: ArtifactTemplate,
  style: GenerateArtifactImageRequest["style"]
): string {
  const name = artifact.name?.en || artifact.name?.de || "magical artifact";
  const keywords = artifact.visualKeywords?.length ? artifact.visualKeywords.join(", ") : name;

  const sections = [
    "storybook illustration of a magical artifact, isolated on a soft background",
    keywords,
    artifact.category ? `Category ${artifact.category}` : "",
    artifact.rarity ? `${artifact.rarity} rarity` : "",
    artifact.storyRole ? `Story role ${artifact.storyRole}` : "",
    style ? resolveArtifactStyle(style) : resolveArtifactStyle("storybook"),
    "centered composition, no text, no watermark"
  ];

  return clampPromptLength(
    sections
      .map((section) => sanitizeSegment(section))
      .filter(Boolean)
      .join(". ")
  );
}

function sanitizeSegment(input: string | undefined | null): string {
  if (!input) {
    return "";
  }
  return String(input)
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveArtifactStyle(style: GenerateArtifactImageRequest["style"] | undefined): string {
  switch (style) {
    case "concept":
      return "Style whimsical concept art, crisp linework, soft lighting, high detail";
    case "watercolor":
      return "Style traditional watercolor painting, textured paper, gentle gradients";
    case "storybook":
    default:
      return "Style cozy European picture book, rich color, playful shapes";
  }
}

function clampPromptLength(prompt: string, max = 900): string {
  if (prompt.length <= max) {
    return prompt;
  }
  const truncated = prompt.slice(0, max);
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > max * 0.6) {
    return truncated.slice(0, lastPeriod + 1).trim();
  }
  return truncated.trim();
}

function normalizeCategory(value: unknown): ArtifactCategory {
  const normalized = String(value || "").trim().toLowerCase();
  const valid: ArtifactCategory[] = [
    "weapon",
    "clothing",
    "magic",
    "book",
    "tool",
    "tech",
    "nature",
    "potion",
    "jewelry",
    "armor",
    "map",
  ];
  return (valid.includes(normalized as ArtifactCategory) ? normalized : "magic") as ArtifactCategory;
}

function normalizeRarity(value: unknown): ArtifactRarity {
  const normalized = String(value || "").trim().toLowerCase();
  const valid: ArtifactRarity[] = ["common", "uncommon", "rare", "legendary"];
  return (valid.includes(normalized as ArtifactRarity) ? normalized : "common") as ArtifactRarity;
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!value || !Array.isArray(value)) {
    return fallback;
  }
  const strings = value
    .map((item) => String(item).trim())
    .filter((str) => str.length > 0);
  return strings.length > 0 ? strings : fallback;
}

function toAffinityNumber(value: unknown, fallback = 0.5): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, parsed));
}

function sanitizeArtifact(artifact: ArtifactTemplate, index: number, now: Date): ArtifactTemplate {
  const id = typeof artifact.id === "string" && artifact.id.trim().length > 0
    ? artifact.id.trim()
    : `artifact_${crypto.randomUUID()}`;

  const nameDe = String(artifact.name?.de || artifact.name?.en || `Artefakt ${index + 1}`).trim();
  const nameEn = String(artifact.name?.en || artifact.name?.de || `Artifact ${index + 1}`).trim();
  const descriptionDe = String(artifact.description?.de || artifact.description?.en || "Magisches Artefakt.").trim();
  const descriptionEn = String(artifact.description?.en || artifact.description?.de || "Magical artifact.").trim();

  const createdAt = artifact.createdAt ? new Date(artifact.createdAt) : now;
  const updatedAt = artifact.updatedAt ? new Date(artifact.updatedAt) : now;
  const lastUsedAt = artifact.lastUsedAt ? new Date(artifact.lastUsedAt) : null;

  return {
    id,
    name: { de: nameDe, en: nameEn },
    description: { de: descriptionDe, en: descriptionEn },
    category: normalizeCategory(artifact.category),
    rarity: normalizeRarity(artifact.rarity),
    storyRole: String(artifact.storyRole || "Hilft in der Geschichte").trim(),
    discoveryScenarios: toStringArray(artifact.discoveryScenarios),
    usageScenarios: toStringArray(artifact.usageScenarios),
    emoji: artifact.emoji ? String(artifact.emoji).trim() : undefined,
    visualKeywords: toStringArray(artifact.visualKeywords),
    imageUrl: artifact.imageUrl ? String(artifact.imageUrl).trim() : undefined,
    genreAffinity: {
      adventure: toAffinityNumber(artifact.genreAffinity?.adventure, 0.5),
      fantasy: toAffinityNumber(artifact.genreAffinity?.fantasy, 0.5),
      mystery: toAffinityNumber(artifact.genreAffinity?.mystery, 0.5),
      nature: toAffinityNumber(artifact.genreAffinity?.nature, 0.5),
      friendship: toAffinityNumber(artifact.genreAffinity?.friendship, 0.5),
      courage: toAffinityNumber(artifact.genreAffinity?.courage, 0.5),
      learning: toAffinityNumber(artifact.genreAffinity?.learning, 0.5),
    },
    recentUsageCount: Number.isFinite(artifact.recentUsageCount) ? artifact.recentUsageCount : 0,
    totalUsageCount: Number.isFinite(artifact.totalUsageCount) ? artifact.totalUsageCount : 0,
    lastUsedAt: lastUsedAt || undefined,
    lastUsedInStoryId: artifact.lastUsedInStoryId ? String(artifact.lastUsedInStoryId) : undefined,
    isActive: artifact.isActive ?? true,
    createdAt,
    updatedAt,
  };
}
