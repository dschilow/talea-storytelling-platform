/**
 * Artifact Image Generator
 * 
 * Generates consistent, high-quality images for inventory artifacts
 * using a master style template for visual consistency.
 */

import { ai } from "~encore/clients";
import type { NewArtifact } from "./types";

/**
 * Master style template for all artifact images.
 * Ensures consistent look across all inventory items.
 */
const ARTIFACT_MASTER_STYLE = [
    "3d render",
    "pixar style magical item",
    "isometric view",
    "soft magical rim lighting",
    "volumetric glow",
    "high detail",
    "white background",
    "no shadow",
    "8k resolution",
    "studio lighting",
    "product photography style",
].join(", ");

/**
 * Negative prompt to avoid common issues in artifact images
 */
const ARTIFACT_NEGATIVE_PROMPT = [
    "text",
    "watermark",
    "signature",
    "humans",
    "characters",
    "hands",
    "faces",
    "blurry",
    "low quality",
    "distorted",
    "disfigured",
    "duplicate",
    "multiple items",
    "busy background",
].join(", ");

interface ArtifactImageResult {
    imageUrl?: string;
    prompt: string;
    success: boolean;
    error?: string;
}

/**
 * Generates an image for a newly acquired artifact.
 * 
 * @param artifact - The artifact metadata from story generation
 * @returns The generated image URL or error information
 */
export async function generateArtifactImage(
    artifact: NewArtifact
): Promise<ArtifactImageResult> {
    console.log(`[Artifact] 🎁 Generating image for artifact: "${artifact.name}"`);

    // Build the subject description from visual keywords
    const subjectDescription = artifact.visualDescriptorKeywords
        .map(keyword => keyword.trim())
        .filter(Boolean)
        .join(", ");

    if (!subjectDescription) {
        console.warn("[Artifact] No visual keywords provided, using artifact name");
    }

    // Combine subject with master style
    const fullPrompt = [
        subjectDescription || `magical ${artifact.name}`,
        artifact.type === "COMPANION" ? "small creature, cute" : "magical artifact",
        ARTIFACT_MASTER_STYLE,
    ].join(", ");

    console.log(`[Artifact] Full prompt: ${fullPrompt.substring(0, 150)}...`);

    try {
        const response = await ai.generateImage({
            prompt: fullPrompt,
            negativePrompt: ARTIFACT_NEGATIVE_PROMPT,
            // Using standard settings for high-quality artifact images
        });

        if (response.imageUrl) {
            console.log(`[Artifact] ✅ Image generated successfully for "${artifact.name}"`);
            return {
                imageUrl: response.imageUrl,
                prompt: fullPrompt,
                success: true,
            };
        }

        console.warn(`[Artifact] ⚠️ No image URL returned for "${artifact.name}"`);
        return {
            prompt: fullPrompt,
            success: false,
            error: "No image URL in response",
        };
    } catch (error) {
        console.error(`[Artifact] ❌ Failed to generate image for "${artifact.name}":`, error);
        return {
            prompt: fullPrompt,
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Builds the prompt for an artifact image based on type.
 * This is a helper for customizing prompts per artifact type.
 */
export function buildArtifactPrompt(artifact: NewArtifact): string {
    const typeStyles: Record<NewArtifact["type"], string> = {
        TOOL: "useful tool, practical design, aged wood and metal",
        WEAPON: "legendary weapon, ornate design, glowing runes",
        KNOWLEDGE: "ancient scroll or book, mystical symbols, floating particles",
        COMPANION: "small magical creature, cute eyes, friendly expression",
    };

    const typeStyle = typeStyles[artifact.type] || "magical item";
    const subjectDescription = artifact.visualDescriptorKeywords.join(", ");

    return [subjectDescription, typeStyle, ARTIFACT_MASTER_STYLE].join(", ");
}
