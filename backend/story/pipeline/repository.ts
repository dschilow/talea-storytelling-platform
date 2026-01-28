import { storyDB } from "../db";
import type { CastSet, IntegrationPlan, SceneDirective, ImageSpec, StoryVariantPlan } from "./types";

export async function upsertStoryInstance(input: {
  id: string;
  category: string;
  taleId: string | null;
  language: string;
  ageMin: number;
  ageMax: number;
  lengthHint?: string;
  emotionProfile?: any;
  variantSeed: number;
  variantChoices: any;
  requestHash: string;
  status: string;
  error?: string | null;
}): Promise<void> {
  await storyDB.exec`
    INSERT INTO story_instances (
      id, created_at, category, tale_id, language, age_min, age_max, length_hint, emotion_profile,
      variant_seed, variant_choices, request_hash, status, error, updated_at
    ) VALUES (
      ${input.id}, NOW(), ${input.category}, ${input.taleId}, ${input.language}, ${input.ageMin}, ${input.ageMax},
      ${input.lengthHint ?? null}, ${JSON.stringify(input.emotionProfile ?? {})},
      ${input.variantSeed}, ${JSON.stringify(input.variantChoices ?? {})}, ${input.requestHash},
      ${input.status}, ${input.error ?? null}, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      category = EXCLUDED.category,
      tale_id = EXCLUDED.tale_id,
      language = EXCLUDED.language,
      age_min = EXCLUDED.age_min,
      age_max = EXCLUDED.age_max,
      length_hint = EXCLUDED.length_hint,
      emotion_profile = EXCLUDED.emotion_profile,
      variant_seed = EXCLUDED.variant_seed,
      variant_choices = EXCLUDED.variant_choices,
      request_hash = EXCLUDED.request_hash,
      status = EXCLUDED.status,
      error = EXCLUDED.error,
      updated_at = NOW()
  `;
}

export async function updateStoryInstanceStatus(id: string, status: string, error?: string | null): Promise<void> {
  await storyDB.exec`
    UPDATE story_instances
    SET status = ${status}, error = ${error ?? null}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function loadCastSet(id: string): Promise<CastSet | null> {
  const row = await storyDB.queryRow<{ cast_set: any }>`
    SELECT cast_set FROM story_cast_sets WHERE story_instance_id = ${id}
  `;
  return row?.cast_set ? parseJsonValue<CastSet>(row.cast_set) : null;
}

export async function saveCastSet(id: string, cast: CastSet): Promise<void> {
  await storyDB.exec`
    INSERT INTO story_cast_sets (story_instance_id, cast_set)
    VALUES (${id}, ${JSON.stringify(cast)})
    ON CONFLICT (story_instance_id) DO UPDATE SET
      cast_set = EXCLUDED.cast_set
  `;
}

export async function loadIntegrationPlan(id: string): Promise<IntegrationPlan | null> {
  const row = await storyDB.queryRow<{ integration_plan: any }>`
    SELECT integration_plan FROM story_integration_plans WHERE story_instance_id = ${id}
  `;
  return row?.integration_plan ? parseJsonValue<IntegrationPlan>(row.integration_plan) : null;
}

export async function saveIntegrationPlan(id: string, plan: IntegrationPlan): Promise<void> {
  await storyDB.exec`
    INSERT INTO story_integration_plans (story_instance_id, integration_plan)
    VALUES (${id}, ${JSON.stringify(plan)})
    ON CONFLICT (story_instance_id) DO UPDATE SET
      integration_plan = EXCLUDED.integration_plan
  `;
}

export async function loadSceneDirectives(id: string): Promise<SceneDirective[]> {
  const rows = await storyDB.queryAll<{ directive: any }>`
    SELECT directive FROM story_scene_directives
    WHERE story_instance_id = ${id}
    ORDER BY chapter
  `;
  return rows
    .map(row => parseJsonValue<SceneDirective>(row.directive))
    .filter(Boolean) as SceneDirective[];
}

export async function saveSceneDirectives(id: string, directives: SceneDirective[]): Promise<void> {
  for (const directive of directives) {
    await storyDB.exec`
      INSERT INTO story_scene_directives (story_instance_id, chapter, directive)
      VALUES (${id}, ${directive.chapter}, ${JSON.stringify(directive)})
      ON CONFLICT (story_instance_id, chapter) DO UPDATE SET
        directive = EXCLUDED.directive
    `;
  }
}

export async function loadStoryText(id: string): Promise<Array<{ chapter: number; title: string | null; text: string }> > {
  const rows = await storyDB.queryAll<{ chapter: number; title: string | null; text: string }>`
    SELECT chapter, title, text FROM story_text_chapters
    WHERE story_instance_id = ${id}
    ORDER BY chapter
  `;
  return rows;
}

export async function saveStoryText(id: string, chapters: Array<{ chapter: number; title?: string; text: string }>): Promise<void> {
  for (const chapter of chapters) {
    await storyDB.exec`
      INSERT INTO story_text_chapters (story_instance_id, chapter, title, text)
      VALUES (${id}, ${chapter.chapter}, ${chapter.title ?? null}, ${chapter.text})
      ON CONFLICT (story_instance_id, chapter) DO UPDATE SET
        title = EXCLUDED.title,
        text = EXCLUDED.text
    `;
  }
}

export async function loadImageSpecs(id: string): Promise<ImageSpec[]> {
  const rows = await storyDB.queryAll<{ image_spec: any }>`
    SELECT image_spec FROM story_image_specs
    WHERE story_instance_id = ${id}
    ORDER BY chapter
  `;
  return rows
    .map(row => parseJsonValue<ImageSpec>(row.image_spec))
    .filter(Boolean) as ImageSpec[];
}

export async function saveImageSpecs(id: string, specs: ImageSpec[]): Promise<void> {
  for (const spec of specs) {
    await storyDB.exec`
      INSERT INTO story_image_specs (story_instance_id, chapter, image_spec)
      VALUES (${id}, ${spec.chapter}, ${JSON.stringify(spec)})
      ON CONFLICT (story_instance_id, chapter) DO UPDATE SET
        image_spec = EXCLUDED.image_spec
    `;
  }
}

export async function saveStoryImages(
  id: string,
  images: Array<{ chapter: number; imageUrl?: string; provider?: string; meta?: any; prompt?: string }>
): Promise<void> {
  for (const image of images) {
    const meta = image.meta ?? (image.prompt ? { prompt: image.prompt } : {});
    await storyDB.exec`
      INSERT INTO story_images (story_instance_id, chapter, image_url, provider, meta)
      VALUES (${id}, ${image.chapter}, ${image.imageUrl ?? null}, ${image.provider ?? null}, ${JSON.stringify(meta ?? {})})
      ON CONFLICT (story_instance_id, chapter) DO UPDATE SET
        image_url = EXCLUDED.image_url,
        provider = EXCLUDED.provider,
        meta = EXCLUDED.meta
    `;
  }
}

export async function loadStoryImages(id: string): Promise<Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }>> {
  const rows = await storyDB.queryAll<{ chapter: number; image_url: string | null; provider: string | null; meta: any }>`
    SELECT chapter, image_url, provider, meta FROM story_images
    WHERE story_instance_id = ${id}
    ORDER BY chapter
  `;
  return rows.map(row => ({
    chapter: row.chapter,
    imageUrl: row.image_url ?? undefined,
    provider: row.provider ?? undefined,
    prompt: row.meta ? safePrompt(row.meta) : "",
  }));
}

export async function saveValidationReport(id: string, report: any): Promise<void> {
  await storyDB.exec`
    INSERT INTO story_validations (story_instance_id, validation_report)
    VALUES (${id}, ${JSON.stringify(report)})
    ON CONFLICT (story_instance_id) DO UPDATE SET
      validation_report = EXCLUDED.validation_report
  `;
}

function safePrompt(meta: any): string {
  if (!meta) return "";
  if (typeof meta === "object") {
    return meta?.prompt || "";
  }
  try {
    const parsed = JSON.parse(meta);
    return parsed?.prompt || "";
  } catch {
    return "";
  }
}

function parseJsonValue<T>(value: any): T | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return null;
}
