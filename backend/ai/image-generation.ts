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
}

export interface ImageGenerationResponse {
  imageUrl: string;
  seed: number;
}

// Generates an image using Runware API with Flux.1 [dev] model.
export const generateImage = api<ImageGenerationRequest, ImageGenerationResponse>(
  { expose: true, method: "POST", path: "/ai/generate-image" },
  async (req) => {
    try {
      const requestBody = {
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        model: "runware:100@1",
        positivePrompt: req.prompt,
        width: req.width || 512,
        height: req.height || 512,
        numberResults: 1,
        steps: req.steps || 20,
        seed: req.seed || Math.floor(Math.random() * 1000000),
        outputFormat: "WEBP",
        outputType: "base64Data"
      };

      console.log("Sending request to Runware:", JSON.stringify(requestBody, null, 2));

      const response = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${runwareApiKey()}`,
        },
        body: JSON.stringify([requestBody]),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Runware API error:", response.status, errorText);
        
        // Fallback to a placeholder image if Runware fails
        const placeholderImageUrl = generatePlaceholderImage(req.prompt);
        return {
          imageUrl: placeholderImageUrl,
          seed: req.seed || 0,
        };
      }

      const data = await response.json();
      console.log("Runware response:", JSON.stringify(data, null, 2));
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn("Invalid response from Runware API, using placeholder");
        const placeholderImageUrl = generatePlaceholderImage(req.prompt);
        return {
          imageUrl: placeholderImageUrl,
          seed: req.seed || 0,
        };
      }

      const result = data[0];
      if (!result || !result.imageBase64) {
        console.warn("No image data from Runware API, using placeholder");
        const placeholderImageUrl = generatePlaceholderImage(req.prompt);
        return {
          imageUrl: placeholderImageUrl,
          seed: req.seed || 0,
        };
      }

      // Convert base64 to data URL
      const imageUrl = `data:image/webp;base64,${result.imageBase64}`;

      return {
        imageUrl,
        seed: result.seed || req.seed || 0,
      };
    } catch (error) {
      console.error("Error in image generation:", error);
      
      // Fallback to placeholder image
      const placeholderImageUrl = generatePlaceholderImage(req.prompt);
      return {
        imageUrl: placeholderImageUrl,
        seed: req.seed || 0,
      };
    }
  }
);

function generatePlaceholderImage(prompt: string): string {
  // Generate a colorful SVG placeholder based on the prompt
  const colors = ['#FF6B9D', '#4ECDC4', '#FFD93D', '#9F7AEA', '#48BB78', '#ED8936'];
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
      <circle cx="256" cy="200" r="80" fill="white" opacity="0.8"/>
      <circle cx="230" cy="180" r="8" fill="${color}"/>
      <circle cx="282" cy="180" r="8" fill="${color}"/>
      <path d="M 220 220 Q 256 250 292 220" stroke="${color}" stroke-width="4" fill="none"/>
      <text x="256" y="350" text-anchor="middle" font-family="Arial" font-size="24" fill="white">🎨 Generiert</text>
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
