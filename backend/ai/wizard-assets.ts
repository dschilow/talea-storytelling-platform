import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { runwareGenerateImage } from "./image-generation";
import {
  bucketObjectExists,
  resolveObjectKeyUrlForClient,
  resolveObjectUrlForClient,
  uploadBufferToBucketKey,
} from "../helpers/bucket-storage";
import {
  WIZARD_ASSET_NEGATIVE,
  WIZARD_ASSET_SPECS,
  WizardAssetSpec,
  buildWizardAssetPrompt,
  wizardAssetKey,
} from "./wizard-asset-specs";

/**
 * Wizard Assets service
 * ---------------------
 * Generates and serves the pre-rendered Talea-styled illustrations used by the
 * avatar wizard in place of standard emoji/icons.
 *
 * - POST /ai/generate-wizard-assets (admin) — generates missing (or all) assets
 *   via the same Runware/Flux pipeline used for story images, stores them under
 *   stable bucket keys, and returns the manifest. Run once (or after prompt
 *   tweaks with force=true).
 * - GET  /ai/wizard-assets (public) — returns the manifest of assets that
 *   currently exist so the frontend can render images with graceful fallback.
 */

interface WizardAssetEntry {
  group: string;
  id: string;
  key: string;
  url: string;
}

interface WizardAssetManifest {
  /** Keyed by "<group>/<id>" for O(1) frontend lookup. */
  assets: Record<string, WizardAssetEntry>;
  count: number;
}

interface GenerateWizardAssetsRequest {
  /** Regenerate every asset even if it already exists. Default false. */
  force?: boolean;
  /** Only (re)generate a specific group, e.g. "hairColor". Default: all. */
  group?: string;
}

interface GenerateWizardAssetsResponse {
  generated: string[];
  skipped: string[];
  failed: { id: string; reason: string }[];
  manifest: WizardAssetManifest;
}

function specsFor(group?: string): WizardAssetSpec[] {
  if (!group) return WIZARD_ASSET_SPECS;
  return WIZARD_ASSET_SPECS.filter((spec) => spec.group === group);
}

function manifestKey(spec: Pick<WizardAssetSpec, "group" | "id">): string {
  return `${spec.group}/${spec.id}`;
}

async function imageUrlToBuffer(
  imageUrl: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  // Inline base64 payload — decode directly.
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
  }

  // runwareGenerateImage may have already uploaded the result to our bucket and
  // returned a `bucket://…` reference — that is NOT directly fetchable, so
  // resolve it to a real HTTP(S) URL (public or signed) first.
  let fetchUrl = imageUrl;
  if (!/^https?:\/\//i.test(imageUrl)) {
    const resolved = await resolveObjectUrlForClient(imageUrl);
    if (!resolved || !/^https?:\/\//i.test(resolved)) {
      console.warn("[wizard-assets] Could not resolve image URL for fetch:", imageUrl.slice(0, 24));
      return null;
    }
    fetchUrl = resolved;
  }

  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      console.warn(`[wizard-assets] Image fetch returned HTTP ${res.status}`);
      return null;
    }
    const contentType = res.headers.get("content-type") || "image/webp";
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return null;
    return { contentType, buffer: Buffer.from(arrayBuffer) };
  } catch (error) {
    console.warn("[wizard-assets] Image fetch failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Reads the current manifest: which assets exist in the bucket right now.
 * Public so the wizard can consume it without auth.
 */
export const getWizardAssets = api<void, WizardAssetManifest>(
  { expose: true, method: "GET", path: "/ai/wizard-assets", auth: false },
  async () => {
    const entries = await Promise.all(
      WIZARD_ASSET_SPECS.map(async (spec) => {
        const key = wizardAssetKey(spec.group, spec.id);
        const exists = await bucketObjectExists(key);
        if (!exists) return null;
        const url = await resolveObjectKeyUrlForClient(key);
        if (!url) return null;
        return { group: spec.group, id: spec.id, key, url } as WizardAssetEntry;
      })
    );

    const assets: Record<string, WizardAssetEntry> = {};
    for (const entry of entries) {
      if (entry) assets[`${entry.group}/${entry.id}`] = entry;
    }
    return { assets, count: Object.keys(assets).length };
  }
);

/**
 * Generates the wizard illustrations. Admin-only + metered image pipeline.
 * Idempotent: existing assets are skipped unless force=true.
 */
export const generateWizardAssets = api<GenerateWizardAssetsRequest, GenerateWizardAssetsResponse>(
  { expose: true, method: "POST", path: "/ai/generate-wizard-assets", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "admin") {
      throw APIError.permissionDenied("Only admins can generate wizard assets.");
    }

    const specs = specsFor(req.group);
    if (specs.length === 0) {
      throw APIError.invalidArgument(`No wizard assets found for group "${req.group}".`);
    }

    const generated: string[] = [];
    const skipped: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    // Generate sequentially to stay gentle on the image provider rate limits.
    for (const spec of specs) {
      const key = wizardAssetKey(spec.group, spec.id);
      const manifestId = manifestKey(spec);

      try {
        if (!req.force && (await bucketObjectExists(key))) {
          skipped.push(manifestId);
          continue;
        }

        const result = await runwareGenerateImage({
          prompt: buildWizardAssetPrompt(spec),
          negativePrompt: WIZARD_ASSET_NEGATIVE,
          width: 512,
          height: 512,
          outputFormat: "WEBP",
          logContext: { stage: `wizard-asset:${manifestId}` },
        });

        if (!result.imageUrl) {
          failed.push({ id: manifestId, reason: result.debugInfo?.errorMessage || "empty image" });
          continue;
        }

        const payload = await imageUrlToBuffer(result.imageUrl);
        if (!payload) {
          failed.push({ id: manifestId, reason: "could not read generated image payload" });
          continue;
        }

        const uploaded = await uploadBufferToBucketKey(payload.buffer, payload.contentType, key);
        if (!uploaded) {
          failed.push({ id: manifestId, reason: "bucket upload failed (bucket disabled?)" });
          continue;
        }

        generated.push(manifestId);
      } catch (error) {
        failed.push({ id: manifestId, reason: error instanceof Error ? error.message : "unknown error" });
      }
    }

    // Build a fresh manifest so the caller immediately sees the result.
    const manifestEntries = await Promise.all(
      WIZARD_ASSET_SPECS.map(async (spec) => {
        const key = wizardAssetKey(spec.group, spec.id);
        if (!(await bucketObjectExists(key))) return null;
        const url = await resolveObjectKeyUrlForClient(key);
        if (!url) return null;
        return { group: spec.group, id: spec.id, key, url } as WizardAssetEntry;
      })
    );
    const assets: Record<string, WizardAssetEntry> = {};
    for (const entry of manifestEntries) {
      if (entry) assets[`${entry.group}/${entry.id}`] = entry;
    }

    return {
      generated,
      skipped,
      failed,
      manifest: { assets, count: Object.keys(assets).length },
    };
  }
);
