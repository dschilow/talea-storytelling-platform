import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";

const runwareApiKey = secret("RunwareApiKey");

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  outputFormat?: "WEBP" | "PNG" | "JPEG";
}

export interface ImageGenerationResponse {
  imageUrl: string;
  seed: number;
  debugInfo?: {
    requestSent: any;
    responseReceived: any;
    processingTime: number;
    success: boolean;
    errorMessage?: string;
    contentType?: string;
    extractedFromPath?: string;
    responseStatus?: number;
  };
}

// Internal helper that actually calls Runware and returns the parsed image.
// Use this helper for intra-service calls to avoid HTTP overhead.
export async function runwareGenerateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const startTime = Date.now();
  const debugInfo: ImageGenerationResponse["debugInfo"] = {
    requestSent: null,
    responseReceived: null,
    processingTime: 0,
    success: false,
    contentType: undefined,
    extractedFromPath: undefined,
    responseStatus: undefined,
  };

  try {
    const requestBody = {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      model: req.model || "runware:100@1",
      positivePrompt: req.prompt,
      width: req.width || 512,
      height: req.height || 512,
      numberResults: 1,
      steps: req.steps || 20,
      seed: req.seed || Math.floor(Math.random() * 1000000),
      outputFormat: req.outputFormat || "WEBP",
      // According to docs, accepted values include "base64Data" for inline base64 payloads
      outputType: "base64Data",
    };

    debugInfo.requestSent = requestBody;
    console.log("Runware request:", JSON.stringify(requestBody));

    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${runwareApiKey()}`,
      },
      body: JSON.stringify([requestBody]),
    });

    debugInfo.responseStatus = res.status;
    if (!res.ok) {
      const errorText = await res.text();
      debugInfo.errorMessage = `HTTP ${res.status}: ${errorText}`;
      debugInfo.processingTime = Date.now() - startTime;
      console.error("Runware API error:", debugInfo.errorMessage);
      return {
        imageUrl: generatePlaceholderImage(req.prompt),
        seed: requestBody.seed,
        debugInfo,
      };
    }

    // Parse JSON response
    const data = await res.json();
    debugInfo.responseReceived = data;
    debugInfo.processingTime = Date.now() - startTime;

    // Extract the base64 image and content type from various possible response shapes.
    const extracted = extractRunwareImage(data);
    if (!extracted) {
      debugInfo.errorMessage = "No image data found in Runware response";
      console.warn("Runware: could not extract image from response");
      return {
        imageUrl: generatePlaceholderImage(req.prompt),
        seed: requestBody.seed,
        debugInfo,
      };
    }

    const { b64, contentType, seed, fromPath } = extracted;
    debugInfo.contentType = contentType;
    debugInfo.extractedFromPath = fromPath;

    // If the b64 already looks like a data URL, use as-is; otherwise wrap.
    const imageUrl = b64.startsWith("data:") ? b64 : `data:${contentType};base64,${b64}`;

    debugInfo.success = true;
    console.log("Runware image extracted:", {
      contentType,
      fromPath,
      urlPreview: imageUrl.substring(0, 80) + "...",
      length: imageUrl.length,
    });

    return {
      imageUrl,
      seed: seed ?? requestBody.seed,
      debugInfo,
    };
  } catch (err: any) {
    console.error("Runware call failed:", err);
    const debug = {
      ...debugInfo,
      errorMessage: err?.message || String(err),
      processingTime: Date.now() - startTime,
    };
    return {
      imageUrl: generatePlaceholderImage(req.prompt),
      seed: req.seed || 0,
      debugInfo: debug,
    };
  }
}

// Public API endpoint wrapper that calls the internal helper.
export const generateImage = api<ImageGenerationRequest, ImageGenerationResponse>(
  { expose: true, method: "POST", path: "/ai/generate-image" },
  async (req) => {
    return await runwareGenerateImage(req);
  }
);

// Try to extract image base64 and mime type from many plausible Runware response shapes.
function extractRunwareImage(data: any): { b64: string; contentType: string; seed?: number; fromPath: string } | null {
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
    // default
    return "image/webp";
  };

  // 1) If response is an array (as per Runware docs), iterate items
  if (Array.isArray(data)) {
    for (const [idx, item] of data.entries()) {
      // Common: item.results is an array of outputs
      if (item && Array.isArray(item.results)) {
        for (const [rIdx, res] of item.results.entries()) {
          // Look for common fields carrying base64 image - ERWEITERT!
          const b64 =
            res?.imageBase64Data ||  // <- NEU: Das fehlende Feld!
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
          // Sometimes nested deeper
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

      // 2) Some variants may place image directly on the item - ERWEITERT!
      const b64Direct =
        item?.imageBase64Data ||  // <- NEU: Das fehlende Feld!
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

      // 3) Some variants: item.images: [...]
      if (Array.isArray(item?.images) && item.images.length > 0) {
        const img0 = item.images[0];
        const b64im =
          img0?.imageBase64Data ||  // <- NEU!
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

      // 4) Some variants: item.output: [...]
      if (Array.isArray(item?.output) && item.output.length > 0) {
        const out0 = item.output[0];
        const b64out =
          out0?.imageBase64Data ||  // <- NEU!
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

  // 5) If object (not array), try same shapes
  if (data && typeof data === "object") {
    // results
    if (Array.isArray(data.results)) {
      for (const [rIdx, res] of data.results.entries()) {
        const b64 =
          res?.imageBase64Data ||  // <- NEU!
          res?.imageBase64 ||
          res?.base64Data ||
          res?.base64 ||
          res?.b64 ||
          res?.b64_json ||
          res?.data;
        if (b64 && typeof b64 === "string") {
          const contentType = pickMime(res?.contentType || res?.mimeType || null, res?.format || null);
          const seed = res?.seed || data?.seed;
          return { b64, contentType, seed, fromPath: `data.results[${rIdx}]` };
        }
      }
    }
    // images
    if (Array.isArray(data.images) && data.images.length > 0) {
      const img0 = data.images[0];
      const b64im =
        img0?.imageBase64Data ||  // <- NEU!
        img0?.imageBase64 ||
        img0?.base64Data ||
        img0?.base64 ||
        img0?.b64 ||
        img0?.b64_json ||
        img0?.data;
      if (b64im && typeof b64im === "string") {
        const contentType = pickMime(img0?.contentType || img0?.mimeType || null, img0?.format || null);
        const seed = img0?.seed || data?.seed;
        return { b64: b64im, contentType, seed, fromPath: "data.images[0]" };
      }
    }
    // direct fields - ERWEITERT!
    const b64Direct =
      data?.imageBase64Data ||  // <- NEU: Das fehlende Feld!
      data?.imageBase64 ||
      data?.base64Data ||
      data?.base64 ||
      data?.b64 ||
      data?.b64_json ||
      data?.data;
    if (b64Direct && typeof b64Direct === "string") {
      const contentType = pickMime(data?.contentType || data?.mimeType || null, (data as any)?.format || null);
      const seed = (data as any)?.seed;
      return { b64: b64Direct, contentType, seed, fromPath: "data" };
    }
  }

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
      <text x="256" y="260" text-anchor="middle" font-family="Arial" font-size="22" fill="white">No Image</text>
      <text x="256" y="300" text-anchor="middle" font-family="Arial" font-size="14" fill="white" opacity="0.9">${escapeXML(prompt).slice(0, 40)}</text>
    </svg>
  `;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function escapeXML(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
