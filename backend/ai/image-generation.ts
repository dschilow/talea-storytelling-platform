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
      throw new Error(`Runware API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Runware response:", JSON.stringify(data, null, 2));
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Invalid response from Runware API: No data array");
    }

    const result = data[0];
    if (!result || !result.imageBase64) {
      throw new Error("Invalid response from Runware API: No image data");
    }

    // Convert base64 to data URL
    const imageUrl = `data:image/webp;base64,${result.imageBase64}`;

    return {
      imageUrl,
      seed: result.seed || req.seed || 0,
    };
  }
);
