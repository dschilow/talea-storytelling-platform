/**
 * Image Proxy Endpoint for PDF Export
 *
 * Proxies images from bucket storage to frontend with proper CORS headers.
 * This allows PDF export to work even when the bucket doesn't send CORS headers.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import {
  extractBucketKeyForUrl,
  resolveImageUrlForBucketKey
} from "../helpers/bucket-storage";

interface ProxyImageRequest {
  imageUrl: string;
}

interface ProxyImageResponse {
  success: boolean;
  imageData?: string;
  contentType?: string;
  error?: string;
}

interface ProxyImageGetRequest {
  key?: string;
  url?: string;
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
export const proxyImageStream = api<ProxyImageGetRequest, Response>(
  { expose: true, method: "GET", path: "/story/image", auth: false },
  async (req): Promise<Response> => {
    const rawKey = typeof req.key === "string" ? req.key.trim() : "";
    const keyFromUrl = req.url ? await extractBucketKeyForUrl(req.url) : null;
    const key = (rawKey || keyFromUrl || "").replace(/^\/+/, "");

    if (!key) {
      return new Response("Missing image key", { status: 400 });
    }

    if (key.includes("..")) {
      return new Response("Invalid image key", { status: 400 });
    }

    const signedUrl = await resolveImageUrlForBucketKey(key);
    if (!signedUrl) {
      return new Response("Image not found", { status: 404 });
    }

    const response = await fetch(signedUrl);
    if (!response.ok) {
      return new Response("Failed to fetch image", { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
);
