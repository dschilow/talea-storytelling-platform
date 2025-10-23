import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";

const runwareApiKey = secret("RunwareApiKey");

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  CFGScale?: number;
  seed?: number;
  outputFormat?: "WEBP" | "PNG" | "JPEG";
  negativePrompt?: string;
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
  model: string;
  width: number;
  height: number;
  steps: number;
  CFGScale?: number;
  seed: number;
  referenceImages: string[];
  outputFormat: "WEBP" | "PNG" | "JPEG";
  negativePrompt?: string;
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

// Internal helper that actually calls Runware and returns the parsed image.
// Use this helper for intra-service calls to avoid HTTP overhead.
export async function runwareGenerateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const startTime = Date.now();
  const debugInfo: DebugInfo = {
    requestSent: null,
    responseReceived: null,
    processingTime: 0,
    success: false,
    errorMessage: "",
    contentType: "",
    extractedFromPath: "",
    responseStatus: 0,
    referencesCount: 0, // Keine Referenzbilder mehr
  };

  const requestBody = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    outputType: "base64Data",
    outputFormat: req.outputFormat || "WEBP",
    outputQuality: 95,
    
    model: req.model || "runware:101@1",
    positivePrompt: enhancePromptForRunware(req.prompt),
    negativePrompt: req.negativePrompt || getDefaultNegativePrompt(),
    
    width: normalizeToMultiple64(req.width || 512),
    height: normalizeToMultiple64(req.height || 512),
    
    numberResults: 1,
    // OPTIMIZED (v1.0): Conservative defaults for identity stability
    // CFG 10-11 for strong prompt adherence, Steps 30-36 for quality
    steps: req.steps || 34,
    CFGScale: req.CFGScale || 10.5,
    scheduler: "DDIM",
    seed: req.seed ?? Math.floor(Math.random() * 2147483647),
    
    // Erweiterte Qualitätsparameter
    checkNSFW: false,
    includeCost: true,
    acceleratorOptions: {
      teaCache: true,
      teaCacheDistance: 0.3
    }
  };

  try {
    console.log(`🎨 Generating image without reference images`);
    debugInfo.requestSent = { ...requestBody };
    console.log("📤 Runware request (sanitized):", JSON.stringify(debugInfo.requestSent, null, 2));

    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${runwareApiKey()}`,
      },
      body: JSON.stringify([requestBody]),
    });

    debugInfo.responseStatus = res.status;
    const responseText = await res.text();

    let data: any;
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

    if (!res.ok) {
      debugInfo.errorMessage = `HTTP ${res.status}: ${responseText}`;
      debugInfo.processingTime = Date.now() - startTime;
      console.error("❌ Runware API error:", debugInfo.errorMessage);
      return {
        imageUrl: generatePlaceholderImage(req.prompt),
        seed: requestBody.seed,
        debugInfo,
      };
    }

    debugInfo.responseReceived = data;
    debugInfo.processingTime = Date.now() - startTime;

    const extracted = extractRunwareImage(data);
    if (!extracted) {
      debugInfo.errorMessage = "No image data found in Runware response";
      console.warn("⚠️ Runware: could not extract image from response");
      return {
        imageUrl: generatePlaceholderImage(req.prompt),
        seed: requestBody.seed,
        debugInfo,
      };
    }

    const { b64, contentType, seed, fromPath } = extracted;
    debugInfo.contentType = contentType || "";
    debugInfo.extractedFromPath = fromPath || "";

    const imageUrl = b64.startsWith("data:") ? b64 : `data:${contentType};base64,${b64}`;

    debugInfo.success = true;
    console.log("✅ Runware image generated:", {
      contentType,
      fromPath,
      urlPreview: imageUrl.substring(0, 80) + "...",
      length: imageUrl.length,
      processingTime: debugInfo.processingTime
    });

    return {
      imageUrl,
      seed: seed ?? requestBody.seed,
      debugInfo,
    };
  } catch (err: any) {
    console.error("❌ Runware call failed:", err);
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
export async function runwareGenerateImagesBatch(req: BatchGenerationRequest): Promise<BatchGenerationResponse> {
  const start = Date.now();
  const tasks = (req.images || []).map((img) => {
    const refImagesBase64 = (img.referenceImages ?? [])
      .map(stripDataUrl)
      .filter((s): s is string => !!s && s.length > 0)
      .slice(0, 3);

    return {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      outputType: "base64Data",
      outputFormat: img.outputFormat || "WEBP",
      outputQuality: 90,
      model: img.model || "runware:101@1",
      positivePrompt: enhancePromptForRunware(img.prompt),
      negativePrompt: img.negativePrompt || getDefaultNegativePrompt(),
      width: normalizeToMultiple64(img.width || 512),
      height: normalizeToMultiple64(img.height || 512),
      numberResults: 1,
      // OPTIMIZED (v1.0): Conservative defaults for batch generation
      steps: img.steps || 34,
      CFGScale: img.CFGScale || 10.5,
      scheduler: "DDIM",
      seed: img.seed ?? Math.floor(Math.random() * 2147483647),
      ...(refImagesBase64.length > 0 && {
        ipAdapters: [{ model: "runware:105@1", guideImage: refImagesBase64[0], weight: 0.85 }],
        referenceImages: refImagesBase64,
        conditioning: "reference",
        conditioningWeight: 0.8
      }),
      acceleratorOptions: { teaCache: true, teaCacheDistance: 0.5 },
      checkNSFW: false,
      includeCost: true
    };
  });

  try {
    if (tasks.length === 0) {
      return { images: [], debug: { processingTime: 0, ok: true, status: 200, errorMessage: "" } };
    }

    console.log(`🎨 Generating ${tasks.length} images in batch`);
    const sanitized = tasks.map((t) => ({
      ...t,
      ipAdapters: t.ipAdapters ? `[IP-Adapter enabled]` : undefined,
      referenceImages: Array.isArray(t.referenceImages) ? `[${t.referenceImages.length} refs]` : undefined,
    }));
    console.log("📤 Runware batch request (sanitized):", JSON.stringify(sanitized, null, 2));

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
      console.error("❌ Runware batch API error:", responseText);
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

    console.log("📥 Runware batch response received:", Array.isArray(data) ? `array(${data.length})` : typeof data);

    let perTask: any[] = [];
    if (Array.isArray(data)) perTask = data;
    else if (data && Array.isArray(data.data)) perTask = data.data;
    else if (data && Array.isArray(data.results)) perTask = data.results;
    else perTask = req.images.map(() => data);

    const outputs: BatchImageOutput[] = req.images.map((img, idx) => {
      const item = perTask[idx] ?? perTask[0] ?? data;
      const extracted = extractRunwareImage(item);
      if (!extracted) {
        console.warn(`⚠️ No image data found for batch item ${idx}`);
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
      const { b64, contentType, seed, fromPath } = extracted;
      const imageUrl = b64.startsWith("data:") ? b64 : `data:${contentType};base64,${b64}`;
      
      console.log(`✅ Batch image ${idx} generated successfully`);
      
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
    });

    console.log(`✅ Batch generation completed: ${outputs.filter(o => o.debugInfo.success).length}/${outputs.length} successful`);

    return {
      images: outputs,
      debug: { processingTime, ok: true, status: 200, errorMessage: "" },
    };
  } catch (err: any) {
    const processingTime = Date.now() - start;
    console.error("❌ Runware batch call failed:", err);
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

// Verbessere den Prompt für Runware mit spezifischen Optimierungen
function enhancePromptForRunware(prompt: string): string {
  // Prüfe, ob bereits erweitert
  if (prompt.includes("enhanced for runware")) {
    return prompt;
  }

  // Strukturiere den Prompt für bessere Runware-Ergebnisse
  const enhancedPrompt = restructurePromptForRunware(prompt);
  return `${enhancedPrompt} enhanced for runware`;
}

// Strukturiere Prompts für bessere Runware-Ergebnisse
function restructurePromptForRunware(prompt: string): string {
  // Extrahiere wichtige Elemente
  const isPortrait = prompt.toLowerCase().includes("portrait");
  const isFullBody = prompt.toLowerCase().includes("ganzkörper") || prompt.toLowerCase().includes("full body");
  const isScene = prompt.toLowerCase().includes("scene") || prompt.toLowerCase().includes("szene");
  
  // Basis-Qualitäts-Tags
  const qualityTags = [
    "masterpiece",
    "best quality", 
    "ultra detailed",
    "8k resolution",
    "professional digital art"
  ];
  
  // Style-spezifische Tags
  const styleTags = [
    "Disney Pixar style",
    "3D rendered",
    "smooth lighting",
    "vibrant colors",
    "child-friendly",
    "clean composition"
  ];
  
  // Negative Prompt Ergänzungen
  const negativeElements = [
    "blurry",
    "low quality", 
    "distorted",
    "scary",
    "adult content",
    "realistic photography",
    "amateur art"
  ];
  
  // Strukturiere den Prompt neu
  let structuredPrompt = prompt;
  
  // Füge Qualitäts-Tags am Anfang hinzu
  structuredPrompt = `${qualityTags.join(", ")}, ${structuredPrompt}`;
  
  // Füge Style-Tags hinzu
  structuredPrompt = `${structuredPrompt}, ${styleTags.join(", ")}`;
  
  // Spezifische Verbesserungen basierend auf Prompt-Typ
  if (isPortrait) {
    structuredPrompt += ", perfect facial features, expressive eyes, detailed hair texture";
  }
  
  if (isFullBody) {
    structuredPrompt += ", full body shot, proper proportions, dynamic pose";
  }
  
  if (isScene) {
    structuredPrompt += ", detailed background, atmospheric lighting, rich environment";
  }
  
  return structuredPrompt;
}

// Standard Negative Prompt für bessere Qualität
function getDefaultNegativePrompt(): string {
  return [
    // Qualitätsprobleme
    "blurry", "low quality", "poor quality", "bad quality",
    "pixelated", "jpeg artifacts", "compression artifacts",
    "amateur art", "sketch", "unfinished",
    
    // Anatomie-Probleme
    "bad anatomy", "wrong anatomy", "distorted faces", "deformed faces",
    "extra limbs", "missing limbs", "malformed hands", "extra fingers",
    "bad proportions", "asymmetric features",
    
    // Stil-Probleme
    "realistic photography", "photorealistic", "live action", "real person",
    "black and white", "monochrome", "sepia",
    
    // Unerwünschte Inhalte
    "adult content", "mature content", "scary", "horror", "dark themes",
    "violence", "weapons", "blood", "disturbing",
    
    // Text und Wasserzeichen
    "text", "words", "letters", "watermark", "signature", "logo",
    "copyright", "username", "artist name",
    
    // Technische Probleme
    "cropped", "cut off", "out of frame", "duplicate", "multiple heads",
    "floating objects", "disconnected parts",
    
    // Konsistenz-Probleme
    "inconsistent character", "wrong hair color", "wrong eye color",
    "different appearance", "style inconsistency",
    
    // Hintergrund-Probleme
    "cluttered background", "distracting background", "busy composition"
  ].join(", ");
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
function extractRunwareImage(data: any): { b64: string; contentType: string; seed?: number; fromPath: string } | null {
  console.log("🔍 Extracting image from Runware response...");
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
  } catch (e) {
    console.warn("⚠️ extractRunwareImage error:", e);
  }

  console.log("❌ No base64 image data found in response");
  return null;
}

function stripDataUrl(s: string): string | null {
  try {
    if (!s) return null;
    const idx = s.indexOf("base64,");
    if (idx === -1) {
      if (/^[0-9a-zA-Z+/=]+$/.test(s)) return s;
      return null;
    }
    return s.slice(idx + "base64,".length);
  } catch {
    return null;
  }
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
