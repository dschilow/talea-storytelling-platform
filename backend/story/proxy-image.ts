/**
 * Image Proxy Endpoint for PDF Export
 *
 * Proxies images from bucket storage to frontend with proper CORS headers.
 * This allows PDF export to work even when the bucket doesn't send CORS headers.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "encore.dev/auth";

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
