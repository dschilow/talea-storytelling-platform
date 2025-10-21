import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import * as db from './db.js';
import type { AvatarVisualProfile } from './types.js';

/**
 * Build a detailed image prompt from Visual Profile
 */
function buildImagePromptFromProfile(
  visualProfile: AvatarVisualProfile,
  avatarName: string,
  options?: {
    sceneDescription?: string;
    action?: string;
    expression?: string;
    clothing?: string;
  }
): string {
  const sections: string[] = [];

  // 1. Quality header
  sections.push(
    'masterpiece, best quality, ultra detailed, professional children\'s book illustration, Disney Pixar 3D style, vibrant colors, perfect lighting'
  );

  // 2. Character name
  sections.push(`CHARACTER: ${avatarName}`);

  // 3. Age & Gender
  if (visualProfile.ageApprox) {
    sections.push(`age ${visualProfile.ageApprox} years old`);
  }
  if (visualProfile.gender && visualProfile.gender !== 'unknown') {
    sections.push(`${visualProfile.gender} character`);
  }

  // 4. Skin details
  const skinDesc: string[] = [];
  if (visualProfile.skin?.tone) skinDesc.push(`${visualProfile.skin.tone} skin tone`);
  if (visualProfile.skin?.undertone) skinDesc.push(`${visualProfile.skin.undertone} undertones`);
  if (visualProfile.skin?.distinctiveFeatures?.length) {
    skinDesc.push(visualProfile.skin.distinctiveFeatures.join(' and '));
  }
  if (skinDesc.length) sections.push(`SKIN: ${skinDesc.join(', ')}`);

  // 5. Hair details
  const hairDesc: string[] = [];
  if (visualProfile.hair?.color) hairDesc.push(`${visualProfile.hair.color} color`);
  if (visualProfile.hair?.type) hairDesc.push(`${visualProfile.hair.type} texture`);
  if (visualProfile.hair?.length) hairDesc.push(`${visualProfile.hair.length} length`);
  if (visualProfile.hair?.style) hairDesc.push(`styled: ${visualProfile.hair.style}`);
  if (hairDesc.length) sections.push(`HAIR: ${hairDesc.join(', ')}`);

  // 6. Eye details
  const eyeDesc: string[] = [];
  if (visualProfile.eyes?.color) eyeDesc.push(`${visualProfile.eyes.color} colored`);
  if (visualProfile.eyes?.shape) eyeDesc.push(`${visualProfile.eyes.shape} shaped`);
  if (visualProfile.eyes?.size) eyeDesc.push(`${visualProfile.eyes.size} sized`);
  if (eyeDesc.length) sections.push(`EYES: ${eyeDesc.join(', ')}`);

  // 7. Face details
  const faceDesc: string[] = [];
  if (visualProfile.face?.shape) faceDesc.push(`${visualProfile.face.shape} face shape`);
  if (visualProfile.face?.nose) faceDesc.push(`nose: ${visualProfile.face.nose}`);
  if (visualProfile.face?.mouth) faceDesc.push(`mouth: ${visualProfile.face.mouth}`);
  if (visualProfile.face?.eyebrows) faceDesc.push(`eyebrows: ${visualProfile.face.eyebrows}`);
  if (visualProfile.face?.freckles) faceDesc.push('with freckles');
  if (visualProfile.face?.otherFeatures?.length) {
    faceDesc.push(visualProfile.face.otherFeatures.join(' and '));
  }
  if (faceDesc.length) sections.push(`FACE: ${faceDesc.join(', ')}`);

  // 8. Accessories
  if (visualProfile.accessories?.length) {
    sections.push(`ACCESSORIES: ${visualProfile.accessories.join(', ')}`);
  }

  // 9. Clothing (canonical or scene-specific)
  if (options?.clothing) {
    sections.push(`CLOTHING: ${options.clothing}`);
  } else if (visualProfile.clothingCanonical?.outfit) {
    sections.push(`CLOTHING: ${visualProfile.clothingCanonical.outfit}`);
  } else if (visualProfile.clothingCanonical?.top || visualProfile.clothingCanonical?.bottom) {
    const clothingParts = [];
    if (visualProfile.clothingCanonical.top) clothingParts.push(`top: ${visualProfile.clothingCanonical.top}`);
    if (visualProfile.clothingCanonical.bottom) clothingParts.push(`bottom: ${visualProfile.clothingCanonical.bottom}`);
    sections.push(`CLOTHING: ${clothingParts.join(', ')}`);
  }

  // 10. Scene context
  if (options?.sceneDescription) {
    sections.push(`SCENE: ${options.sceneDescription}`);
  }

  // 11. Action & Expression
  if (options?.action) {
    sections.push(`ACTION: ${options.action}`);
  }
  if (options?.expression) {
    sections.push(`EXPRESSION: ${options.expression}`);
  }

  // 12. Consistency tokens
  if (visualProfile.consistentDescriptors?.length) {
    const tokens = visualProfile.consistentDescriptors.slice(0, 10).join(', ');
    sections.push(`CHARACTER CONSISTENCY CRITICAL: [${tokens}]`);
  }

  // 13. Style enforcement
  sections.push(
    'child-friendly illustration, expressive facial features, anatomically correct proportions, high resolution details, clean composition, Disney animation quality'
  );

  return sections.join('. ');
}

/**
 * Initialize MCP Server with all tools
 */
export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'talea-mcp-main',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ==================== LIST TOOLS ====================
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_avatar_visual_profile',
          description: 'Get the complete visual profile (appearance details) for a single avatar. Returns detailed physical characteristics including hair, eyes, skin, face features, accessories, and consistent descriptors for image generation.',
          inputSchema: {
            type: 'object',
            properties: {
              avatarId: {
                type: 'string',
                description: 'The unique ID of the avatar',
              },
            },
            required: ['avatarId'],
          },
        },
        {
          name: 'get_multiple_avatar_profiles',
          description: 'Get visual profiles for multiple avatars at once. Useful for stories with multiple characters. Returns an array of avatar profiles with their names and visual details.',
          inputSchema: {
            type: 'object',
            properties: {
              avatarIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of avatar IDs to fetch',
              },
            },
            required: ['avatarIds'],
          },
        },
        {
          name: 'build_consistent_image_prompt',
          description: 'Generate a detailed, consistent image prompt from an avatar\'s visual profile. This ensures the character looks the same across all story images. Optionally include scene-specific details like action, expression, or clothing.',
          inputSchema: {
            type: 'object',
            properties: {
              avatarId: {
                type: 'string',
                description: 'The avatar ID to build the prompt for',
              },
              sceneDescription: {
                type: 'string',
                description: 'Optional scene context (e.g., "in a magical forest")',
              },
              action: {
                type: 'string',
                description: 'Optional action (e.g., "running towards the castle")',
              },
              expression: {
                type: 'string',
                description: 'Optional facial expression (e.g., "smiling happily", "looking curious")',
              },
              clothing: {
                type: 'string',
                description: 'Optional scene-specific clothing override (e.g., "wearing a red raincoat")',
              },
            },
            required: ['avatarId'],
          },
        },
        {
          name: 'get_avatar_memories',
          description: 'Get all memories (past story experiences) for an avatar. Memories include experiences from previous stories, emotional impacts, and personality changes. Use this to make stories feel connected and show character growth.',
          inputSchema: {
            type: 'object',
            properties: {
              avatarId: {
                type: 'string',
                description: 'The avatar ID to get memories for',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of memories to return (default: 50)',
              },
            },
            required: ['avatarId'],
          },
        },
        {
          name: 'search_memories_by_context',
          description: 'Search through an avatar\'s memories for specific topics, themes, or keywords. Useful for finding relevant past experiences to reference in new stories.',
          inputSchema: {
            type: 'object',
            properties: {
              avatarId: {
                type: 'string',
                description: 'The avatar ID to search memories for',
              },
              searchTerm: {
                type: 'string',
                description: 'Keyword or phrase to search for (e.g., "dragon", "friendship", "beach")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 20)',
              },
            },
            required: ['avatarId', 'searchTerm'],
          },
        },
        {
          name: 'add_avatar_memory',
          description: 'Add a new memory after a story is completed. This records the avatar\'s experience, emotional impact, and any personality trait changes from the story.',
          inputSchema: {
            type: 'object',
            properties: {
              avatarId: {
                type: 'string',
                description: 'The avatar ID',
              },
              storyId: {
                type: 'string',
                description: 'The story ID this memory is from',
              },
              storyTitle: {
                type: 'string',
                description: 'The title of the story',
              },
              experience: {
                type: 'string',
                description: 'Brief description of what the avatar experienced/learned',
              },
              emotionalImpact: {
                type: 'string',
                enum: ['positive', 'negative', 'neutral'],
                description: 'The emotional impact of this experience',
              },
              personalityChanges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    trait: {
                      type: 'string',
                      description: 'The trait that changed (e.g., "courage", "knowledge.physics")',
                    },
                    change: {
                      type: 'number',
                      description: 'The amount of change (positive or negative)',
                    },
                  },
                  required: ['trait', 'change'],
                },
                description: 'Array of personality trait changes from this experience',
              },
            },
            required: ['avatarId', 'storyId', 'storyTitle', 'experience', 'emotionalImpact', 'personalityChanges'],
          },
        },
        {
          name: 'get_avatar_personality',
          description: 'Get an avatar\'s current personality traits and their values. Traits include knowledge, creativity, courage, empathy, etc. Each trait can have subcategories (e.g., knowledge.physics, knowledge.history).',
          inputSchema: {
            type: 'object',
            properties: {
              avatarId: {
                type: 'string',
                description: 'The avatar ID',
              },
            },
            required: ['avatarId'],
          },
        },
      ],
    };
  });

  // ==================== CALL TOOL ====================
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Extract userId from MCP context (passed by OpenAI via headers)
    const userId = (request as any).userId;

    if (!userId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'User authentication required'
      );
    }

    try {
      switch (name) {
        // ==================== GET VISUAL PROFILE ====================
        case 'get_avatar_visual_profile': {
          const { avatarId } = args as { avatarId: string };

          const profile = await db.getAvatarVisualProfile(avatarId, userId);

          if (!profile) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Avatar not found or access denied'
            );
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(profile, null, 2),
              },
            ],
          };
        }

        // ==================== GET MULTIPLE PROFILES ====================
        case 'get_multiple_avatar_profiles': {
          const { avatarIds } = args as { avatarIds: string[] };

          const avatars = await db.getAvatarsByIds(avatarIds, userId);

          const profiles = avatars.map((avatar) => ({
            id: avatar.id,
            name: avatar.name,
            visualProfile: avatar.visualProfile,
          }));

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(profiles, null, 2),
              },
            ],
          };
        }

        // ==================== BUILD IMAGE PROMPT ====================
        case 'build_consistent_image_prompt': {
          const {
            avatarId,
            sceneDescription,
            action,
            expression,
            clothing,
          } = args as {
            avatarId: string;
            sceneDescription?: string;
            action?: string;
            expression?: string;
            clothing?: string;
          };

          const profile = await db.getAvatarVisualProfile(avatarId, userId);

          if (!profile || !profile.visualProfile) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Avatar or visual profile not found'
            );
          }

          const prompt = buildImagePromptFromProfile(
            profile.visualProfile,
            profile.name,
            { sceneDescription, action, expression, clothing }
          );

          return {
            content: [
              {
                type: 'text',
                text: prompt,
              },
            ],
          };
        }

        // ==================== GET MEMORIES ====================
        case 'get_avatar_memories': {
          const { avatarId, limit = 50 } = args as {
            avatarId: string;
            limit?: number;
          };

          const memories = await db.getAvatarMemories(avatarId, userId, limit);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(memories, null, 2),
              },
            ],
          };
        }

        // ==================== SEARCH MEMORIES ====================
        case 'search_memories_by_context': {
          const { avatarId, searchTerm, limit = 20 } = args as {
            avatarId: string;
            searchTerm: string;
            limit?: number;
          };

          const memories = await db.searchMemories(
            avatarId,
            userId,
            searchTerm,
            limit
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(memories, null, 2),
              },
            ],
          };
        }

        // ==================== ADD MEMORY ====================
        case 'add_avatar_memory': {
          const memory = args as {
            avatarId: string;
            storyId: string;
            storyTitle: string;
            experience: string;
            emotionalImpact: 'positive' | 'negative' | 'neutral';
            personalityChanges: Array<{ trait: string; change: number }>;
          };

          const newMemory = await db.addAvatarMemory(
            memory.avatarId,
            userId,
            {
              storyId: memory.storyId,
              storyTitle: memory.storyTitle,
              experience: memory.experience,
              emotionalImpact: memory.emotionalImpact,
              personalityChanges: memory.personalityChanges,
            }
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(newMemory, null, 2),
              },
            ],
          };
        }

        // ==================== GET PERSONALITY ====================
        case 'get_avatar_personality': {
          const { avatarId } = args as { avatarId: string };

          const personality = await db.getAvatarPersonality(avatarId, userId);

          if (!personality) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Avatar not found or access denied'
            );
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(personality, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      console.error(`❌ Error executing tool ${name}:`, error);

      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  return server;
}

/**
 * Start MCP server with stdio transport (for local testing)
 */
export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.log('✅ MCP Server running on stdio');
}
