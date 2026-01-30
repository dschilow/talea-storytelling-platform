import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { maybeUploadImageUrlToBucket } from "../helpers/bucket-storage";

const runwareApiKey = secret("RunwareApiKey");

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string; // Explicit negative prompts to avoid unwanted features
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  CFGScale?: number;
  seed?: number;
  outputFormat?: "WEBP" | "PNG" | "JPEG";
  /** OPTIMIZATION v3.0: Reference images for IP-Adapter character consistency */
  referenceImages?: string[];
  /** IP-Adapter weight (0.0-1.0) - higher = more similar to reference */
  ipAdapterWeight?: number;
}

export interface DebugInfo {
  requestSent: any;
  responseReceived: any;
  processingTime: number;
  success: boolean;
  errorMessage: string;
  contentType: string;
  extractedFromPath: string;
  responseStatus: number;
  referencesCount: number;
}

export interface ImageGenerationResponse {
  imageUrl: string;
  seed: number;
  debugInfo: DebugInfo;
}

export interface BatchImageInput {
  // All fields required for Encore schemas; callers should pass defaults where needed.
  prompt: string;
  negativePrompt?: string; // NEW: Explicit negative prompts to avoid unwanted features
  model: string;
  width: number;
  height: number;
  steps: number;
  CFGScale?: number;
  seed: number;
  referenceImages: string[];
  outputFormat: "WEBP" | "PNG" | "JPEG";
}

export interface BatchImageOutput {
  imageUrl: string;
  seed: number;
  debugInfo: DebugInfo;
}

export interface BatchGenerationRequest {
  images: BatchImageInput[];
}

export interface BatchGenerationResponse {
  images: BatchImageOutput[];
  debug: {
    processingTime: number;
    ok: boolean;
    status: number;
    errorMessage: string;
  };
}

// Internal helper that actually calls Runware and returns the parsed image with retry logic
// Use this helper for intra-service calls to avoid HTTP overhead.
// OPTIMIZATION v4.0: Now supports MULTIPLE reference images for runware:400@4
// OPTIMIZATION v4.1: Added exponential backoff retry for 504 timeouts
export async function runwareGenerateImage(req: ImageGenerationRequest, retryCount = 0, maxRetries = 3): Promise<ImageGenerationResponse> {
  const startTime = Date.now();

  // Process reference images - runware:400@4 supports multiple reference images as URLs
  const refImages = (req.referenceImages ?? [])
    .filter((s): s is string => !!s && typeof s === 'string' && s.trim().length > 0);

  const hasReferences = refImages.length > 0;

     
  const debugInfo: DebugInfo = {
    requestSent: null,
    responseReceived: null,
    processingTime: 0,
    success: false,
    errorMessage: "",
    contentType: "",
    extractedFromPath: "",
    responseStatus: 0,
    referencesCount: refImages.length,
  };

  // Build request body for runware:400@4
  const requestBody: Record<string, any> = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    model: req.model || "runware:400@4",
    numberResults: 1,
    outputType: ["URL"],  // Use URL output for faster response
    outputFormat: req.outputFormat || "JPEG",
    width: normalizeToMultiple64(req.width ?? 1024),
    height: normalizeToMultiple64(req.height ?? 1024),
    steps: req.steps ?? 4,  // runware:400@4 uses fewer steps
    CFGScale: req.CFGScale ?? 4,
    includeCost: true,
    acceleration: "high",
    seed: req.seed ?? Math.floor(Math.random() * 2147483647),
    positivePrompt: enhancePromptForRunware(req.prompt),
    ...(req.negativePrompt && req.negativePrompt.trim() !== "" ? { negativePrompt: enhancePromptForRunware(req.negativePrompt) } : {}),
  };

  // OPTIMIZATION v4.0: Add reference images for character consistency
  // runware:400@4 uses inputs.referenceImages with direct URLs
  if (hasReferences) {
    requestBody.inputs = {
      referenceImages: refImages
    };
    console.log(`[Runware] Using ${refImages.length} reference images for character consistency`);
  }

  try {
    const retryInfo = retryCount > 0 ? ` (retry ${retryCount}/${maxRetries})` : '';
    console.log(`[Runware] Generating image ${hasReferences ? `WITH ${refImages.length}` : 'without'} reference images${retryInfo}`);
    
    // Sanitize request for logging (don't log full URLs)
    const sanitizedRequest = {
      ...requestBody,
      inputs: requestBody.inputs ? { referenceImages: `[${refImages.length} refs]` } : undefined,
    };
    debugInfo.requestSent = sanitizedRequest;
    console.log("[Runware] Request (sanitized):", JSON.stringify(sanitizedRequest, null, 2));

    // Extended timeout for complex image generation (3 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    let data: any;
    try {
      const res = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${runwareApiKey()}`,
        },
        body: JSON.stringify([requestBody]),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      debugInfo.responseStatus = res.status;
      const responseText = await res.text();

      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { error: "Failed to parse JSON response", response: responseText };
      }

      await publishWithTimeout(logTopic, {
        source: 'runware-single-image',
        timestamp: new Date(),
        request: requestBody,
        response: data,
      });

      // Handle 504 Gateway Timeout with retry logic
      if (res.status === 504 && retryCount < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
        console.warn(`[Runware] Got 504 timeout, retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return runwareGenerateImage(req, retryCount + 1, maxRetries);
      }

      if (!res.ok) {
        debugInfo.errorMessage = `HTTP ${res.status}: ${responseText}`;
        debugInfo.processingTime = Date.now() - startTime;
        console.error("[Runware] API error:", debugInfo.errorMessage);
        return {
          imageUrl: generatePlaceholderImage(req.prompt),
          seed: requestBody.seed,
          debugInfo,
        };
      }
    } catch (abortErr: any) {
      clearTimeout(timeoutId);
      if (abortErr.name === 'AbortError' && retryCount < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.warn(`[Runware] Request timeout, retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return runwareGenerateImage(req, retryCount + 1, maxRetries);
      }
      throw abortErr;
    }

    debugInfo.responseReceived = data;
    debugInfo.processingTime = Date.now() - startTime;

    const extracted = extractRunwareImage(data);
    if (!extracted) {
      debugInfo.errorMessage = "No image data found in Runware response";
      console.warn("[Runware] No image data extracted from response");
      return {
        imageUrl: generatePlaceholderImage(req.prompt),
        seed: requestBody.seed,
        debugInfo,
      };
    }

    const { b64, url, contentType, seed, fromPath } = extracted;
    debugInfo.contentType = contentType || "";
    debugInfo.extractedFromPath = fromPath || "";

    let imageUrl: string | undefined;
    if (url) {
      imageUrl = url;
    } else if (b64) {
      imageUrl = b64.startsWith("data:")
        ? b64
        : `data:${contentType};base64,${b64}`;
    }

    if (!imageUrl) {
      debugInfo.errorMessage = "Runware response did not include image payload";
      debugInfo.processingTime = Date.now() - startTime;
      console.warn("[Runware] Missing image payload");
      return {
        imageUrl: generatePlaceholderImage(req.prompt),
        seed: requestBody.seed,
        debugInfo,
      };
    }

    const uploaded = await maybeUploadImageUrlToBucket(imageUrl, {
      prefix: "images/runware",
      filenameHint: `runware-${requestBody.seed}`,
    });
    if (uploaded) {
      imageUrl = uploaded.url;
    }

    debugInfo.success = true;
    console.log("[Runware] Image generated:", {
      contentType,
      fromPath,
      urlPreview: imageUrl.substring(0, 120),
      processingTime: debugInfo.processingTime
    });

    return {
      imageUrl,
      seed: seed ?? requestBody.seed,
      debugInfo,
    };
  } catch (err: any) {
    console.error("[Runware] Call failed:", err);
    const dbg: DebugInfo = {
      ...debugInfo,
      errorMessage: err?.message || String(err),
      processingTime: Date.now() - startTime,
    };
    return {
      imageUrl: generatePlaceholderImage(req.prompt),
      seed: req.seed || 0,
      debugInfo: dbg,
    };
  }
}

// Batch helper to generate multiple images in a single Runware request.
// OPTIMIZATION v4.0: Now supports MULTIPLE reference images for runware:400@4
export async function runwareGenerateImagesBatch(req: BatchGenerationRequest): Promise<BatchGenerationResponse> {
  const start = Date.now();
  const tasks = (req.images || []).map((img) => {
    const refImages = (img.referenceImages ?? [])
      .filter((s): s is string => !!s && typeof s === 'string' && s.trim().length > 0);

    return {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      model: img.model || "runware:400@4",
      numberResults: 1,
      outputType: ["URL"],  // Use URL output for faster response
      outputFormat: img.outputFormat || "JPEG",
      positivePrompt: enhancePromptForRunware(img.prompt),
      ...(img.negativePrompt && img.negativePrompt.trim() !== "" ? { negativePrompt: enhancePromptForRunware(img.negativePrompt) } : {}),
      width: normalizeToMultiple64(img.width || 1024),
      height: normalizeToMultiple64(img.height || 1024),
      steps: img.steps ?? 4,  // runware:400@4 uses fewer steps
      CFGScale: img.CFGScale ?? 4,
      seed: img.seed ?? Math.floor(Math.random() * 2147483647),
      includeCost: true,
      acceleration: "high",
      // OPTIMIZATION v4.0: Add reference images for character consistency
      ...(refImages.length > 0 && {
        inputs: { referenceImages: refImages }
      }),
    };
  });

  try {
    if (tasks.length === 0) {
      return { images: [], debug: { processingTime: 0, ok: true, status: 200, errorMessage: "" } };
    }

    console.log(`[Runware] Generating ${tasks.length} images in batch`);
    const sanitized = tasks.map((t) => ({
      ...t,
      inputs: (t as any).inputs ? { referenceImages: `[${(t as any).inputs.referenceImages.length} refs]` } : undefined,
    }));
    console.log("[Runware] Batch request (sanitized):", JSON.stringify(sanitized, null, 2));

    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${runwareApiKey()}` },
      body: JSON.stringify(tasks),
    });

    const processingTime = Date.now() - start;
    const responseText = await res.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { error: "Failed to parse JSON response", response: responseText };
    }

    await publishWithTimeout(logTopic, {
      source: 'runware-batch-image',
      timestamp: new Date(),
      request: tasks,
      response: data,
    });

    if (!res.ok) {
      console.error("[Runware] Batch API error:", responseText);
      return {
        images: req.images.map((img, i) => ({
          imageUrl: generatePlaceholderImage(img.prompt),
          seed: img.seed ?? 0,
          debugInfo: {
            requestSent: sanitized[i],
            responseReceived: null,
            processingTime,
            success: false,
            errorMessage: `HTTP ${res.status}: ${responseText}`,
            contentType: "",
            extractedFromPath: "",
            responseStatus: res.status,
            referencesCount: img.referenceImages?.length ?? 0,
          },
        })),
        debug: { processingTime, ok: false, status: res.status, errorMessage: responseText },
      };
    }

    console.log("[Runware] Batch response received:", Array.isArray(data) ? `array(${data.length})` : typeof data);

    let perTask: any[] = [];
    if (Array.isArray(data)) perTask = data;
    else if (data && Array.isArray(data.data)) perTask = data.data;
    else if (data && Array.isArray(data.results)) perTask = data.results;
    else perTask = req.images.map(() => data);

    const outputs: BatchImageOutput[] = await Promise.all(req.images.map(async (img, idx) => {
      const item = perTask[idx] ?? perTask[0] ?? data;
      const extracted = extractRunwareImage(item);
      if (!extracted) {
        console.warn(`[Runware] No image data found for batch item ${idx}`);
        return {
          imageUrl: generatePlaceholderImage(img.prompt),
          seed: img.seed ?? 0,
          debugInfo: {
            requestSent: sanitized[idx],
            responseReceived: item,
            processingTime,
            success: false,
            errorMessage: "No image data found in Runware batch response item",
            contentType: "",
            extractedFromPath: "",
            responseStatus: 200,
            referencesCount: img.referenceImages?.length ?? 0,
          },
        };
      }
      const { b64, url, contentType, seed, fromPath } = extracted;
      let imageUrl: string | undefined;
      if (url) {
        imageUrl = url;
      } else if (b64) {
        imageUrl = b64.startsWith("data:")
          ? b64
          : `data:${contentType};base64,${b64}`;
      }
      if (!imageUrl) {
        console.warn(`[Runware] Missing image payload for batch item ${idx}`);
        return {
          imageUrl: generatePlaceholderImage(img.prompt),
          seed: img.seed ?? 0,
          debugInfo: {
            requestSent: sanitized[idx],
            responseReceived: item,
            processingTime,
            success: false,
            errorMessage: "No image payload in Runware batch response item",
            contentType: "",
            extractedFromPath: "",
            responseStatus: 200,
            referencesCount: img.referenceImages?.length ?? 0,
          },
        };
      }
      
      const uploaded = await maybeUploadImageUrlToBucket(imageUrl, {
        prefix: "images/runware",
        filenameHint: `runware-${tasks[idx]?.seed ?? img.seed ?? idx}`,
      });
      if (uploaded) {
        imageUrl = uploaded.url;
      }

      console.log(`[Runware] Batch image ${idx} generated successfully`);
      
      return {
        imageUrl,
        seed: seed ?? (tasks[idx]?.seed ?? img.seed ?? 0),
        debugInfo: {
          requestSent: sanitized[idx],
          responseReceived: item,
          processingTime,
          success: true,
          errorMessage: "",
          contentType: contentType || "",
          extractedFromPath: fromPath || "",
          responseStatus: 200,
          referencesCount: img.referenceImages?.length ?? 0,
        },
      };
    }));

    console.log(`[Runware] Batch summary: ${outputs.filter(o => o.debugInfo.success).length}/${outputs.length} successful`);

    return {
      images: outputs,
      debug: { processingTime, ok: true, status: 200, errorMessage: "" },
    };
  } catch (err: any) {
    const processingTime = Date.now() - start;
    console.error("[Runware] Batch call failed:", err);
    return {
      images: (req.images ?? []).map((img) => ({
        imageUrl: generatePlaceholderImage(img.prompt),
        seed: img.seed ?? 0,
        debugInfo: {
          requestSent: null,
          responseReceived: null,
          processingTime,
          success: false,
          errorMessage: err?.message || String(err),
          contentType: "",
          extractedFromPath: "",
          responseStatus: 0,
          referencesCount: img.referenceImages?.length ?? 0,
        },
      })),
      debug: { processingTime, ok: false, status: 0, errorMessage: err?.message || String(err) },
    };
  }
}

// Bereinigt den Prompt fuer Runware ohne zusaetzlichen Stil-Ballast
function enhancePromptForRunware(prompt: string): string {
  if (!prompt) {
    return "";
  }
  return prompt.replace(/\s+/g, " ").trim();
}
// Normalisiere Dimensionen auf Vielfache von 64 (Runware Requirement)
function normalizeToMultiple64(value: number): number {
  const rounded = Math.round(value / 64) * 64;
  return Math.max(128, Math.min(2048, rounded));
}

// Public API endpoint wrapper that calls the internal helper.
export const generateImage = api<ImageGenerationRequest, ImageGenerationResponse>(
  { expose: true, method: "POST", path: "/ai/generate-image" },
  async (req) => {
    return await runwareGenerateImage(req);
  }
);

// Public API endpoint for batch generation.
export const generateImagesBatch = api<BatchGenerationRequest, BatchGenerationResponse>(
  { expose: true, method: "POST", path: "/ai/generate-images-batch" },
  async (req) => {
    return await runwareGenerateImagesBatch(req);
  }
);

// Try to extract image base64 and mime type from many plausible Runware response shapes.
function extractRunwareImage(data: any): { b64?: string; url?: string; contentType: string; seed?: number; fromPath: string } | null {
  console.log("[Runware] Extracting image from response...");
  try {
    // Helper to determine content type
    const pickMime = (ct?: string | null, fmt?: string | null) => {
      if (ct && typeof ct === "string") return normalizeMime(ct);
      if (fmt && typeof fmt === "string") {
        const f = fmt.toUpperCase();
        if (f.includes("WEBP")) return "image/webp";
        if (f.includes("PNG")) return "image/png";
        if (f.includes("JPG") || f.includes("JPEG")) return "image/jpeg";
      }
      return "image/webp";
    };

    const normalizeMime = (ct: string) => {
      const low = ct.toLowerCase();
      if (low.includes("png")) return "image/png";
      if (low.includes("jpeg") || low.includes("jpg")) return "image/jpeg";
      if (low.includes("webp")) return "image/webp";
      return "image/webp";
    };

    const extractUrlFromStructure = (root: any): { url: string; contentType: string; seed?: number; fromPath: string } | null => {
      const stack: Array<{ value: any; path: string }> = [{ value: root, path: "data" }];
      const seen = new Set<any>();

      const pickUrl = (candidate?: any): string | undefined => {
        if (typeof candidate !== "string") {
          return undefined;
        }
        if (candidate.startsWith("http")) {
          return candidate;
        }
        if (candidate.startsWith("https")) {
          return candidate;
        }
        if (candidate.startsWith("data:")) {
          return candidate;
        }
        return undefined;
      };

      while (stack.length > 0) {
        const { value, path } = stack.pop()!;
        if (!value || typeof value !== "object") {
          continue;
        }
        if (seen.has(value)) {
          continue;
        }
        seen.add(value);

        const cast: any = value;
        const url =
          pickUrl(cast.imageUrl) ||
          pickUrl(cast.imageURL) ||
          pickUrl(cast.image_url) ||
          pickUrl(cast.url) ||
          pickUrl(cast.URL) ||
          (Array.isArray(cast.urls) ? cast.urls.map((entry: any) => pickUrl(entry)).find(Boolean) : undefined) ||
          pickUrl(cast.outputUrl) ||
          pickUrl(cast.outputURL) ||
          pickUrl(cast.signedUrl) ||
          pickUrl(cast.signedURL) ||
          pickUrl(cast.downloadUrl);

        if (url) {
          const contentType = pickMime(
            cast.contentType || cast.mimeType || cast.mimetype || null,
            cast.format || cast.outputFormat || null
          );
          const seed = typeof cast.seed === "number" ? cast.seed : undefined;
          return { url, contentType, seed, fromPath: path };
        }

        if (Array.isArray(cast.output)) {
          for (const [idx, item] of cast.output.entries()) {
            const nestedUrl = pickUrl(item?.imageUrl ?? item?.url ?? item?.signedUrl);
            if (nestedUrl) {
              const contentType = pickMime(
                item?.contentType || item?.mimeType || item?.mimetype || cast.contentType || null,
                item?.format || item?.outputFormat || cast.outputFormat || null
              );
              const seed =
                typeof item?.seed === "number"
                  ? item.seed
                  : typeof cast.seed === "number"
                    ? cast.seed
                    : undefined;
              return { url: nestedUrl, contentType, seed, fromPath: `${path}.output[${idx}]` };
            }
          }
        }

        if (typeof cast === "object") {
          for (const [key, val] of Object.entries(cast)) {
            if (typeof val === "string" && key.toLowerCase().includes("url")) {
              const nested = pickUrl(val);
              if (nested) {
                const contentType = pickMime(
                  cast.contentType || cast.mimeType || cast.mimetype || null,
                  cast.format || cast.outputFormat || null
                );
                const seed = typeof cast.seed === "number" ? cast.seed : undefined;
                return { url: nested, contentType, seed, fromPath: `${path}.${key}` };
              }
            }
          }
        }

        if (Array.isArray(value)) {
          value.forEach((child, index) => {
            if (child && typeof child === "object") {
              stack.push({ value: child, path: `${path}[${index}]` });
            }
          });
        } else {
          Object.entries(value).forEach(([key, child]) => {
            if (child && typeof child === "object") {
              stack.push({ value: child, path: `${path}.${key}` });
            }
          });
        }
      }

      return null;
    };

    // If the object has a direct data array like { data: [...] }
    if (data && typeof data === "object" && Array.isArray((data as any).data)) {
      for (const [idx, item] of (data as any).data.entries()) {
        const b64 =
          item?.imageBase64Data ||
          item?.imageBase64 ||
          item?.base64Data ||
          item?.base64 ||
          item?.b64 ||
          item?.b64_json ||
          item?.data;
        if (b64 && typeof b64 === "string") {
          const contentType = pickMime(item?.contentType || item?.mimeType || item?.mimetype || null, item?.format || item?.outputFormat || null);
          const seed = item?.seed;
          return { b64, contentType, seed, fromPath: `data.data[${idx}]` };
        }
      }
    }

    // If response is an array (batch or single)
    if (Array.isArray(data)) {
      for (const [idx, item] of data.entries()) {
        if (item && Array.isArray(item.results)) {
          for (const [rIdx, res] of item.results.entries()) {
            const b64 =
              res?.imageBase64Data ||
              res?.imageBase64 ||
              res?.base64Data ||
              res?.base64 ||
              res?.b64 ||
              res?.b64_json ||
              res?.data;
            if (b64 && typeof b64 === "string") {
              const contentType = pickMime(res?.contentType || res?.mimeType || res?.mimetype || null, res?.format || res?.outputFormat || null);
              const seed = res?.seed || item?.seed;
              return { b64, contentType, seed, fromPath: `data[${idx}].results[${rIdx}]` };
            }
            if (res?.images && Array.isArray(res.images) && res.images.length > 0) {
              const img = res.images[0];
              const b64i = img?.imageBase64Data || img?.imageBase64 || img?.base64Data || img?.base64 || img?.b64 || img?.b64_json || img?.data;
              if (b64i && typeof b64i === "string") {
                const contentType = pickMime(img?.contentType || img?.mimeType || null, img?.format || null);
                const seed = img?.seed || res?.seed || item?.seed;
                return { b64: b64i, contentType, seed, fromPath: `data[${idx}].results[${rIdx}].images[0]` };
              }
            }
          }
        }

        const b64Direct =
          item?.imageBase64Data ||
          item?.imageBase64 ||
          item?.base64Data ||
          item?.base64 ||
          item?.b64 ||
          item?.b64_json ||
          item?.data;
        if (b64Direct && typeof b64Direct === "string") {
          const contentType = pickMime(item?.contentType || item?.mimeType || null, item?.format || item?.outputFormat || null);
          const seed = item?.seed;
          return { b64: b64Direct, contentType, seed, fromPath: `data[${idx}]` };
        }

        if (Array.isArray(item?.images) && item.images.length > 0) {
          const img0 = item.images[0];
          const b64im =
            img0?.imageBase64Data ||
            img0?.imageBase64 ||
            img0?.base64Data ||
            img0?.base64 ||
            img0?.b64 ||
            img0?.b64_json ||
            img0?.data;
          if (b64im && typeof b64im === "string") {
            const contentType = pickMime(img0?.contentType || img0?.mimeType || null, img0?.format || null);
            const seed = img0?.seed || item?.seed;
            return { b64: b64im, contentType, seed, fromPath: `data[${idx}].images[0]` };
          }
        }

        if (Array.isArray(item?.output) && item.output.length > 0) {
          const out0 = item.output[0];
          const b64out =
            out0?.imageBase64Data ||
            out0?.imageBase64 ||
            out0?.base64Data ||
            out0?.base64 ||
            out0?.b64 ||
            out0?.b64_json ||
            out0?.data;
          if (b64out && typeof b64out === "string") {
            const contentType = pickMime(out0?.contentType || out0?.mimeType || null, out0?.format || null);
            const seed = out0?.seed || item?.seed;
            return { b64: b64out, contentType, seed, fromPath: `data[${idx}].output[0]` };
          }
        }
      }
    }

    // Object with results/images
    if (data && typeof data === "object") {
      if (Array.isArray((data as any).results)) {
        for (const [rIdx, res] of (data as any).results.entries()) {
          const b64 =
            res?.imageBase64Data ||
            res?.imageBase64 ||
            res?.base64Data ||
            res?.base64 ||
            res?.b64 ||
            res?.b64_json ||
            res?.data;
          if (b64 && typeof b64 === "string") {
            const contentType = pickMime(res?.contentType || res?.mimeType || null, res?.format || null);
            const seed = res?.seed || (data as any)?.seed;
            return { b64, contentType, seed, fromPath: `data.results[${rIdx}]` };
          }
        }
      }

      if (Array.isArray((data as any).images) && (data as any).images.length > 0) {
        const img0 = (data as any).images[0];
        const b64im =
          img0?.imageBase64Data ||
          img0?.imageBase64 ||
          img0?.base64Data ||
          img0?.base64 ||
          img0?.b64 ||
          img0?.b64_json ||
          img0?.data;
        if (b64im && typeof b64im === "string") {
          const contentType = pickMime(img0?.contentType || img0?.mimeType || null, img0?.format || null);
          const seed = img0?.seed || (data as any)?.seed;
          return { b64: b64im, contentType, seed, fromPath: "data.images[0]" };
        }
      }

      const b64Direct =
        (data as any)?.imageBase64Data ||
        (data as any)?.imageBase64 ||
        (data as any)?.base64Data ||
        (data as any)?.base64 ||
        (data as any)?.b64 ||
        (data as any)?.b64_json ||
        (data as any)?.data;
      if (b64Direct && typeof b64Direct === "string") {
        const contentType = pickMime((data as any)?.contentType || (data as any)?.mimeType || null, (data as any)?.format || null);
        const seed = (data as any)?.seed;
        return { b64: b64Direct, contentType, seed, fromPath: "data" };
      }
    }

    const urlFallback = extractUrlFromStructure(data);
    if (urlFallback) {
      return urlFallback;
    }
  } catch (e) {
    console.warn("[Runware] extractRunwareImage error:", e);
  }

  console.log("[Runware] No base64 image data found in response");
  return null;
}

function generatePlaceholderImage(prompt: string): string {
  const colors = ["#FF6B9D", "#4ECDC4", "#FFD93D", "#9F7AEA", "#48BB78", "#ED8936"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color}80;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#grad)"/>
      <text x="256" y="240" text-anchor="middle" font-family="Arial" font-size="24" fill="white" font-weight="bold">Avatales</text>
      <text x="256" y="280" text-anchor="middle" font-family="Arial" font-size="16" fill="white" opacity="0.9">Bild wird generiert...</text>
      <text x="256" y="320" text-anchor="middle" font-family="Arial" font-size="12" fill="white" opacity="0.7">${escapeXML(prompt).slice(0, 40)}</text>
    </svg>
  `;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function escapeXML(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

