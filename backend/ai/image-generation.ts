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
    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${runwareApiKey()}`,
      },
      body: JSON.stringify({
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        model: req.model || "flux.1-dev",
        positivePrompt: req.prompt,
        width: req.width || 512,
        height: req.height || 512,
        numberResults: 1,
        steps: req.steps || 20,
        seed: req.seed || Math.floor(Math.random() * 1000000),
      }),
    });

    if (!response.ok) {
      throw new Error(`Runware API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].imageURL) {
      throw new Error("Invalid response from Runware API");
    }

    return {
      imageUrl: data.data[0].imageURL,
      seed: data.data[0].seed || req.seed || 0,
    };
  }
);
