import { createHash } from "node:crypto";
import { manuscriptHash } from "./engine";
import { roundUSD, validCost } from "./budget";
import { acceptedGeneratedImageUrl } from "../../helpers/imageResultGuard";
import type { BookBrief, BookResult } from "./types";

export const BOOK_IMAGE_MODEL = "runware:400@4";
export interface ImageJob { page: number; taskId: string; prompt: string; references: string[] }
export interface ImageOutput { url?: string; costUSD?: number; attempted?: boolean }
export interface ImageReceipt extends ImageJob { url?: string; costUSD?: number; attempted: boolean; status: "generated" | "unavailable" }
export type ImageProvider = (job: ImageJob) => Promise<ImageOutput>;
export function imageAccounting(images: ImageReceipt[], estimatePerUnknownAttemptUSD = 0.00151) {
  const attempted = images.filter(i => i.attempted);
  const unknown = attempted.filter(i => !validCost(i.costUSD)).length;
  const providerCostUSD = roundUSD(attempted.reduce((sum, i) => sum + (validCost(i.costUSD) ? i.costUSD : 0), 0));
  const estimatedCostUSD = roundUSD(unknown * estimatePerUnknownAttemptUSD);
  return { providerCostUSD, estimatedCostUSD, totalCostUSD: roundUSD(providerCostUSD + estimatedCostUSD), complete: unknown === 0, attempts: attempted.length };
}

/** Artwork is derived from the exact approved text version; no image prompt LLM.
 * Direct per-scene references remove the collage input implicated in the audit.
 * Only a subsequent visual review can establish whether frames are absent.
 */
export async function illustrateBook(result: BookResult, brief: BookBrief, provider: ImageProvider, resolveUrl: (url: string) => Promise<string | undefined>): Promise<ImageReceipt[]> {
  if (result.status !== "accepted" || !result.manuscript || !result.review || result.manuscriptHash !== manuscriptHash(result.manuscript)) return [];
  const people = new Map([...brief.heroes, ...brief.candidates].map(p => [p.id, p]));
  const artifact = brief.artifacts.find(a => a.id === result.plan?.artifactId);
  const urlCache = new Map<string, Promise<string | undefined>>();
  const reference = (url: string) => {
    if (!urlCache.has(url)) urlCache.set(url, resolveUrl(url).catch(() => undefined));
    return urlCache.get(url)!;
  };
  const receipts: ImageReceipt[] = [];
  // Two concurrent jobs, one attempt each. A timeout is not retried with a new
  // task ID: the provider may already have billed the original request.
  const pages = [...result.manuscript.pages];
  const worker = async () => {
    while (pages.length) {
      const page = pages.shift()!;
      const visible = page.illustration.castIds.map(id => people.get(id)).filter(p => p !== undefined);
      const references: string[] = [], identities: string[] = [];
      for (const person of visible) {
        const url = person.imageUrl ? await reference(person.imageUrl) : undefined;
        if (url && references.length < 4) { references.push(url); identities.push(`Reference ${references.length} is ${person.name}; use only this person's appearance.`); }
        identities.push(`${person.name}: ${person.appearance}`);
      }
      if (artifact && page.illustration.artifactVisible) {
        const url = artifact.imageUrl ? await reference(artifact.imageUrl) : undefined;
        if (url && references.length < 4) { references.push(url); identities.push(`Reference ${references.length} shows the object ${artifact.name}.`); }
        identities.push(`Object ${artifact.name}: ${artifact.appearance}. Its current state: follow the scene below.`);
      }
      const hex = createHash("sha256").update(`${brief.seed}:${result.manuscriptHash}:${page.order}`).digest("hex");
      const taskId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
      const job: ImageJob = {
        page: page.order, taskId, references,
        prompt: [
          "One coherent children's book illustration, watercolor and colored pencil, expressive clear silhouettes, warm natural light, consistent clothing and scale.",
          "Use reference images only for identity. Draw the people in the scene; do not reproduce a reference photograph, frame, border, portrait panel, collage, lettering or a character sheet.",
          ...identities, `Only these visible characters: ${visible.map(p => p.name).join(", ") || "none"}.`,
          page.illustration.scene,
          "Show one moment and one location. Preserve the state of the central object. Full-bleed composition, no written text.",
        ].join("\n"),
      };
      try {
        const image = await provider(job);
        receipts.push({ ...job, ...image, attempted: image.attempted ?? true, status: image.url ? "generated" : "unavailable" });
      } catch { receipts.push({ ...job, attempted: true, status: "unavailable" }); }
    }
  };
  await Promise.all([worker(), worker()]);
  return receipts.sort((a, b) => a.page - b.page);
}

export function runwareProvider(apiKey: string, fetcher: typeof fetch = fetch): ImageProvider {
  return async job => {
    if (!apiKey.trim()) return { attempted: false, costUSD: 0 };
    const response = await fetcher("https://api.runware.ai/v1", {
      method: "POST", signal: AbortSignal.timeout(120_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify([{
        taskType: "imageInference", taskUUID: job.taskId, model: BOOK_IMAGE_MODEL,
        positivePrompt: job.prompt, width: 1024, height: 1024, steps: 4, CFGScale: 4,
        numberResults: 1, outputType: ["URL"], outputFormat: "WEBP", includeCost: true,
        ...(job.references.length ? { inputs: { referenceImages: job.references } } : {}),
      }]),
    });
    if (!response.ok) throw new Error(`Runware HTTP ${response.status}`);
    const data: any = await response.json();
    const rows = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
    const item = rows.find((r: any) => r.taskUUID === job.taskId && r.taskType === "imageInference");
    const rawCost = item?.cost;
    const accepted = acceptedGeneratedImageUrl({ imageUrl: item?.imageURL, debugInfo: { success: item?.success, contentType: item?.contentType } });
    return {
      url: accepted && /^https?:\/\//i.test(accepted) && !/\.svg(?:[?#]|$)/i.test(accepted) ? accepted : undefined,
      costUSD: rawCost !== null && rawCost !== undefined && rawCost !== "" && Number.isFinite(Number(rawCost)) && Number(rawCost) >= 0 ? Number(rawCost) : undefined,
    };
  };
}
