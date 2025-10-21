/**
 * MCP (Model Context Protocol) Client
 *
 * Provides helper functions to call MCP Main and MCP Validator servers
 * from the Encore backend.
 */

import { secret } from "encore.dev/config";

// MCP Server URLs (Railway)
const MCP_MAIN_URL = "https://talea-mcp-main-production.up.railway.app";
const MCP_VALIDATOR_URL = "https://talea-mcp-validator-production.up.railway.app";

// MCP Server API Key
const mcpApiKey = secret("MCPServerAPIKey");

/**
 * Call MCP Main Server tool
 */
export async function callMcpMainTool(
  toolName: string,
  args: any,
  clerkToken: string
): Promise<any> {
  try {
    console.log(`📡 [MCP Main] Calling tool: ${toolName}`);

    const response = await fetch(`${MCP_MAIN_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${clerkToken}`,
        "X-MCP-API-Key": mcpApiKey(),
      },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP Main call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ [MCP Main] Tool ${toolName} succeeded`);

    // Extract text content from MCP response
    if (result.content && result.content[0] && result.content[0].text) {
      return JSON.parse(result.content[0].text);
    }

    return result;
  } catch (error) {
    console.error(`❌ [MCP Main] Tool ${toolName} failed:`, error);
    throw error;
  }
}

/**
 * Call MCP Validator Server tool
 */
export async function callMcpValidatorTool(
  toolName: string,
  args: any
): Promise<any> {
  try {
    console.log(`📡 [MCP Validator] Calling tool: ${toolName}`);

    const response = await fetch(`${MCP_VALIDATOR_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MCP-API-Key": mcpApiKey(),
      },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP Validator call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ [MCP Validator] Tool ${toolName} succeeded`);

    // Extract text content from MCP response
    if (result.content && result.content[0] && result.content[0].text) {
      return JSON.parse(result.content[0].text);
    }

    return result;
  } catch (error) {
    console.error(`❌ [MCP Validator] Tool ${toolName} failed:`, error);
    throw error;
  }
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Get avatar visual profile from MCP
 */
export async function getAvatarVisualProfile(
  avatarId: string,
  clerkToken: string
) {
  return callMcpMainTool("get_avatar_visual_profile", { avatarId }, clerkToken);
}

/**
 * Get multiple avatar profiles from MCP
 */
export async function getMultipleAvatarProfiles(
  avatarIds: string[],
  clerkToken: string
) {
  return callMcpMainTool("get_multiple_avatar_profiles", { avatarIds }, clerkToken);
}

/**
 * Build consistent image prompt from MCP
 */
export async function buildConsistentImagePrompt(
  avatarId: string,
  clerkToken: string,
  options?: {
    sceneDescription?: string;
    action?: string;
    expression?: string;
    clothing?: string;
  }
) {
  return callMcpMainTool(
    "build_consistent_image_prompt",
    { avatarId, ...options },
    clerkToken
  );
}

/**
 * Get avatar memories from MCP
 */
export async function getAvatarMemories(
  avatarId: string,
  clerkToken: string,
  limit?: number
) {
  return callMcpMainTool("get_avatar_memories", { avatarId, limit }, clerkToken);
}

/**
 * Search avatar memories from MCP
 */
export async function searchAvatarMemories(
  avatarId: string,
  searchTerm: string,
  clerkToken: string,
  limit?: number
) {
  return callMcpMainTool(
    "search_memories_by_context",
    { avatarId, searchTerm, limit },
    clerkToken
  );
}

/**
 * Add avatar memory via MCP
 */
export async function addAvatarMemoryViaMcp(
  avatarId: string,
  clerkToken: string,
  memory: {
    storyId: string;
    storyTitle: string;
    experience: string;
    emotionalImpact: "positive" | "negative" | "neutral";
    personalityChanges: Array<{ trait: string; change: number }>;
  }
) {
  return callMcpMainTool(
    "add_avatar_memory",
    { avatarId, ...memory },
    clerkToken
  );
}

/**
 * Get avatar personality from MCP
 */
export async function getAvatarPersonality(
  avatarId: string,
  clerkToken: string
) {
  return callMcpMainTool("get_avatar_personality", { avatarId }, clerkToken);
}

/**
 * Validate story response via MCP Validator
 */
export async function validateStoryResponse(storyData: any) {
  return callMcpValidatorTool("validate_story_response", { storyData });
}

/**
 * Validate avatar developments via MCP Validator
 */
export async function validateAvatarDevelopments(developments: any[]) {
  return callMcpValidatorTool("validate_avatar_developments", { developments });
}

/**
 * Normalize trait updates via MCP Validator
 */
export async function normalizeTraitUpdates(
  updates: Array<{ trait: string; change: number }>
) {
  return callMcpValidatorTool("normalize_trait_updates", { updates });
}

/**
 * Get validation report via MCP Validator
 */
export async function getValidationReport(storyData: any) {
  return callMcpValidatorTool("get_validation_report", { storyData });
}
