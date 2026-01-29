/**
 * Image Proxy Endpoint for PDF Export
 *
 * Proxies images from bucket storage to frontend with proper CORS headers.
 * This allows PDF export to work even when the bucket doesn't send CORS headers.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import {
  extractBucketKeyForUrl,
  resolveImageUrlForBucketKey
} from "../helpers/bucket-storage";
import { storyDB } from "./db";

const avatarDB = SQLDatabase.named("avatar");

interface ProxyImageRequest {
  imageUrl: string;
}

interface ProxyImageResponse {
  success: boolean;
  imageData?: string;
  contentType?: string;
  error?: string;
}

/**
 * Proxy an image URL and return it as base64 data URL.
 * This bypasses CORS restrictions by fetching server-side.
 */
export const proxyImage = api<ProxyImageRequest, ProxyImageResponse>(
  { expose: true, method: "POST", path: "/story/proxy-image", auth: true },
  async (req): Promise<ProxyImageResponse> => {
    try {
      // Verify user is authenticated
      const authData = getAuthData();
      if (!authData?.userID) {
        throw APIError.unauthenticated("Authentication required");
      }

      const { imageUrl } = req;

      // Validate URL
      if (!imageUrl || typeof imageUrl !== 'string') {
        return {
          success: false,
          error: "Invalid image URL"
        };
      }

      // Security: Only allow specific domains to prevent abuse
      const allowedDomains = [
        'im.runware.ai',
        'storage.railway.app',
        'tidy-shoebox-buxk4wlwbry.storage.railway.app',
      ];

      let isAllowed = false;
      try {
        const url = new URL(imageUrl);
        isAllowed = allowedDomains.some(domain => url.hostname.includes(domain));
      } catch {
        return {
          success: false,
          error: "Invalid URL format"
        };
      }

      if (!isAllowed) {
        return {
          success: false,
          error: "URL domain not allowed"
        };
      }

      // Fetch the image
      const response = await fetch(imageUrl);

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch image: ${response.status} ${response.statusText}`
        };
      }

      // Get content type
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      // Convert to base64
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;

      return {
        success: true,
        imageData: dataUrl,
        contentType,
      };

    } catch (error: any) {
      console.error('[ProxyImage] Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }
);

/**
 * Proxy an image by bucket key and stream it directly.
 * Useful for short, stable image URLs in the UI.
 */
export const proxyImageStream = api.raw(
  { expose: true, method: "GET", path: "/story/image", auth: false },
  async (req, resp) => {
    const url = parseUrl(req);
    const key = url?.searchParams.get("key") || undefined;
    const sourceUrl = url?.searchParams.get("url") || undefined;
    const result = await streamByKeyOrUrl(key, sourceUrl);
    sendResult(resp, result);
  }
);

export const proxyStoryChapterImage = api.raw(
  { expose: true, method: "GET", path: "/story/image/story/*path", auth: false },
  async (req, resp) => {
    const url = parseUrl(req);
    const parts = url?.pathname.split("/").filter(Boolean) || [];
    // Expected: story/image/story/{id}/chapter/{n}
    const storyIndex = parts.lastIndexOf("story");
    const chapterIndex = parts.indexOf("chapter");
    if (storyIndex === -1 || chapterIndex === -1 || chapterIndex !== storyIndex + 2) {
      sendResult(resp, { status: 400, message: "Invalid story chapter path" });
      return;
    }

    const storyId = parts[storyIndex + 1];
    const chapterStr = parts[chapterIndex + 1];
    const chapterNumber = Number(chapterStr);
    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
      sendResult(resp, { status: 400, message: "Invalid chapter" });
      return;
    }

    const row = await storyDB.queryRow<{ image_url: string | null }>`
      SELECT image_url FROM chapters
      WHERE story_id = ${storyId} AND chapter_order = ${chapterNumber}
    `;

    if (!row?.image_url) {
      sendResult(resp, { status: 404, message: "Image not found" });
      return;
    }

    const result = await streamFromImageUrl(row.image_url);
    sendResult(resp, result);
  }
);

export const proxyAvatarImage = api.raw(
  { expose: true, method: "GET", path: "/story/image/avatar/:id", auth: false },
  async (req, resp) => {
    const url = parseUrl(req);
    const parts = url?.pathname.split("/").filter(Boolean) || [];
    const id = parts[parts.length - 1];
    if (!id) {
      sendResult(resp, { status: 400, message: "Missing avatar id" });
      return;
    }

    const row = await avatarDB.queryRow<{ image_url: string | null }>`
      SELECT image_url FROM avatars WHERE id = ${id}
    `;

    if (!row?.image_url) {
      sendResult(resp, { status: 404, message: "Image not found" });
      return;
    }

    const result = await streamFromImageUrl(row.image_url);
    sendResult(resp, result);
  }
);

export const proxyArtifactImage = api.raw(
  { expose: true, method: "GET", path: "/story/image/artifact/:id", auth: false },
  async (req, resp) => {
    const url = parseUrl(req);
    const parts = url?.pathname.split("/").filter(Boolean) || [];
    const id = parts[parts.length - 1];
    if (!id) {
      sendResult(resp, { status: 400, message: "Missing artifact id" });
      return;
    }

    const row = await storyDB.queryRow<{ image_url: string | null }>`
      SELECT image_url FROM artifact_pool WHERE id = ${id}
    `;

    if (!row?.image_url) {
      sendResult(resp, { status: 404, message: "Image not found" });
      return;
    }

    const result = await streamFromImageUrl(row.image_url);
    sendResult(resp, result);
  }
);

type StreamResult = {
  status: number;
  body?: Buffer;
  contentType?: string;
  cacheControl?: string;
  message?: string;
};

async function streamByKeyOrUrl(keyValue?: string, urlValue?: string): Promise<StreamResult> {
  const rawKey = typeof keyValue === "string" ? keyValue.trim() : "";
  const keyFromUrl = urlValue ? await extractBucketKeyForUrl(urlValue) : null;
  const key = (rawKey || keyFromUrl || "").replace(/^\/+/, "");

  if (!key) {
    return { status: 400, message: "Missing image key" };
  }

  if (key.includes("..")) {
    return { status: 400, message: "Invalid image key" };
  }

  const signedUrl = await resolveImageUrlForBucketKey(key);
  if (!signedUrl) {
    return { status: 404, message: "Image not found" };
  }

  return await streamFromSignedUrl(signedUrl);
}

async function streamFromImageUrl(imageUrl: string): Promise<StreamResult> {
  const key = await extractBucketKeyForUrl(imageUrl);
  if (!key) {
    return { status: 404, message: "Image not found" };
  }

  const signedUrl = await resolveImageUrlForBucketKey(key);
  if (!signedUrl) {
    return { status: 404, message: "Image not found" };
  }

  return await streamFromSignedUrl(signedUrl);
}

async function streamFromSignedUrl(signedUrl: string): Promise<StreamResult> {
  const response = await fetch(signedUrl);
  if (!response.ok) {
    return { status: 502, message: "Failed to fetch image" };
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    status: 200,
    contentType,
    cacheControl: "public, max-age=3600",
    body: buffer,
  };
}

function parseUrl(req: { url?: string; headers?: Record<string, string | string[] | undefined> }): URL | null {
  const rawUrl = req.url || "";
  const hostHeader = Array.isArray(req.headers?.host) ? req.headers?.host[0] : req.headers?.host;
  const base = hostHeader ? `http://${hostHeader}` : "http://localhost";
  try {
    return new URL(rawUrl, base);
  } catch {
    return null;
  }
}

function sendResult(resp: any, result: StreamResult): void {
  resp.statusCode = result.status;
  if (result.contentType) {
    resp.setHeader("Content-Type", result.contentType);
  }
  if (result.cacheControl) {
    resp.setHeader("Cache-Control", result.cacheControl);
  }
  if (result.body) {
    resp.end(result.body);
    return;
  }
  resp.end(result.message || "Error");
}
