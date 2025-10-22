const DEFAULT_MCP_MAIN_URL = "https://talea-mcp-main-production.up.railway.app";
const DEFAULT_MCP_VALIDATOR_URL = "https://talea-mcp-validator-production.up.railway.app";

const mcpMainUrl = process.env.MCP_MAIN_URL ?? DEFAULT_MCP_MAIN_URL;
const mcpValidatorUrl = process.env.MCP_VALIDATOR_URL ?? DEFAULT_MCP_VALIDATOR_URL;

// Type definitions for MCP validator responses
export interface ValidationResult {
  isValid: boolean;
  errors?: any[];
  normalized?: any;
}

export interface AvatarDevelopmentValidationResult {
  isValid: boolean;
  errors?: any[];
  validDevelopments?: any[];
}

export interface TraitUpdateNormalizationResult {
  normalizedUpdates: Array<{ trait: string; change: number }>;
}

export interface ValidationReport {
  isValid: boolean;
  errors: any[];
  warnings: any[];
  suggestions: any[];
}

async function callMcpEndpoint<T>(
  url: string,
  body: Record<string, unknown>,
  apiKey: string,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  console.log(`[MCP] Calling ${url} with body:`, JSON.stringify(body).substring(0, 200));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MCP-API-Key": apiKey,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[MCP] Request failed (${response.status}):`, text);
      throw new Error(`MCP request failed (${response.status}): ${text}`);
    }

    const result = await response.json();
    console.log(`[MCP] Response received:`, JSON.stringify(result).substring(0, 200));

    const content = Array.isArray(result.content) ? result.content[0] : undefined;

    if (content && typeof content === "object" && "text" in content) {
      try {
        return JSON.parse(content.text as string) as T;
      } catch {
        return content.text as T;
      }
    }

    return result as T;
  } catch (error) {
    console.error(`[MCP] Error calling ${url}:`, error);
    throw error;
  }
}

export async function callMcpMainTool<T>(
  toolName: string,
  args: Record<string, unknown>,
  clerkToken: string,
  apiKey: string
): Promise<T> {
  if (!clerkToken) {
    throw new Error("Missing Clerk token for MCP main call");
  }

  return callMcpEndpoint<T>(`${mcpMainUrl}/mcp`, {
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  }, apiKey, {
    Authorization: `Bearer ${clerkToken}`,
  });
}

export async function callMcpValidatorTool<T>(
  toolName: string,
  args: Record<string, unknown>,
  apiKey: string
): Promise<T> {
  return callMcpEndpoint<T>(`${mcpValidatorUrl}/mcp`, {
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  }, apiKey);
}

export async function getAvatarVisualProfile(
  avatarId: string,
  clerkToken: string,
  apiKey: string
) {
  return callMcpMainTool("get_avatar_visual_profile", { avatarId }, clerkToken, apiKey);
}

export async function getMultipleAvatarProfiles(
  avatarIds: string[],
  clerkToken: string,
  apiKey: string
) {
  return callMcpMainTool("get_multiple_avatar_profiles", { avatarIds }, clerkToken, apiKey);
}

export async function buildConsistentImagePrompt(
  avatarId: string,
  clerkToken: string,
  apiKey: string,
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
    clerkToken,
    apiKey
  );
}

export async function getAvatarMemories(
  avatarId: string,
  clerkToken: string,
  apiKey: string,
  limit?: number
) {
  return callMcpMainTool("get_avatar_memories", { avatarId, limit }, clerkToken, apiKey);
}

export async function searchAvatarMemories(
  avatarId: string,
  searchTerm: string,
  clerkToken: string,
  apiKey: string,
  limit?: number
) {
  return callMcpMainTool(
    "search_memories_by_context",
    { avatarId, searchTerm, limit },
    clerkToken,
    apiKey
  );
}

export async function addAvatarMemoryViaMcp(
  avatarId: string,
  clerkToken: string,
  apiKey: string,
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
    clerkToken,
    apiKey
  );
}

export async function getAvatarPersonality(
  avatarId: string,
  clerkToken: string,
  apiKey: string
) {
  return callMcpMainTool("get_avatar_personality", { avatarId }, clerkToken, apiKey);
}

export async function validateStoryResponse(storyData: unknown, apiKey: string): Promise<ValidationResult> {
  return callMcpValidatorTool<ValidationResult>("validate_story_response", { storyData }, apiKey);
}

export async function validateAvatarDevelopments(developments: unknown[], apiKey: string): Promise<AvatarDevelopmentValidationResult> {
  return callMcpValidatorTool<AvatarDevelopmentValidationResult>("validate_avatar_developments", { developments }, apiKey);
}

export async function normalizeTraitUpdates(
  updates: Array<{ trait: string; change: number }>,
  apiKey: string
): Promise<TraitUpdateNormalizationResult> {
  return callMcpValidatorTool<TraitUpdateNormalizationResult>("normalize_trait_updates", { updates }, apiKey);
}

export async function getValidationReport(storyData: unknown, apiKey: string): Promise<ValidationReport> {
  return callMcpValidatorTool<ValidationReport>("get_validation_report", { storyData }, apiKey);
}
