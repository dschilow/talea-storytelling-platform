import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import {
  validateStoryResponse,
  validateAvatarDevelopments,
  normalizeTraitUpdates,
  getValidationReport,
} from './validator.js';

/**
 * Initialize MCP Validator Server with validation tools
 */
export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'talea-mcp-validator',
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
          name: 'validate_story_response',
          description:
            'Validates a complete story response from OpenAI. Checks structure, chapters, image descriptions, avatar developments, and learning outcomes. Returns validation result with errors and normalized data.',
          inputSchema: {
            type: 'object',
            properties: {
              storyData: {
                type: 'object',
                description: 'The complete story response object from OpenAI',
              },
            },
            required: ['storyData'],
          },
        },
        {
          name: 'validate_avatar_developments',
          description:
            'Validates avatar development data from a story. Ensures trait IDs are valid, normalizes legacy trait names, and validates change values are within acceptable ranges (-10 to +10).',
          inputSchema: {
            type: 'object',
            properties: {
              developments: {
                type: 'array',
                items: {
                  type: 'object',
                },
                description: 'Array of avatar development objects',
              },
            },
            required: ['developments'],
          },
        },
        {
          name: 'normalize_trait_updates',
          description:
            'Normalizes trait update data. Converts legacy trait names (German, alternative English) to canonical trait IDs. Supports both base traits (courage, intelligence) and knowledge subcategories (knowledge.physics, knowledge.history).',
          inputSchema: {
            type: 'object',
            properties: {
              updates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    trait: { type: 'string' },
                    change: { type: 'number' },
                  },
                },
                description: 'Array of trait updates with trait ID and change value',
              },
            },
            required: ['updates'],
          },
        },
        {
          name: 'get_validation_report',
          description:
            'Generates a comprehensive validation report for story data. Includes overall validation status, detailed errors, and warnings. Useful for debugging OpenAI responses.',
          inputSchema: {
            type: 'object',
            properties: {
              storyData: {
                type: 'object',
                description: 'The story data to generate a report for',
              },
            },
            required: ['storyData'],
          },
        },
      ],
    };
  });

  // ==================== CALL TOOL ====================
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        // ==================== VALIDATE STORY RESPONSE ====================
        case 'validate_story_response': {
          const { storyData } = args as { storyData: any };

          if (!storyData) {
            throw new McpError(ErrorCode.InvalidRequest, 'storyData is required');
          }

          const result = validateStoryResponse(storyData);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        // ==================== VALIDATE AVATAR DEVELOPMENTS ====================
        case 'validate_avatar_developments': {
          const { developments } = args as { developments: any[] };

          if (!Array.isArray(developments)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'developments must be an array'
            );
          }

          const result = validateAvatarDevelopments(developments);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        // ==================== NORMALIZE TRAIT UPDATES ====================
        case 'normalize_trait_updates': {
          const { updates } = args as {
            updates: Array<{ trait: string; change: number }>;
          };

          if (!Array.isArray(updates)) {
            throw new McpError(ErrorCode.InvalidRequest, 'updates must be an array');
          }

          const result = normalizeTraitUpdates(updates);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        // ==================== GET VALIDATION REPORT ====================
        case 'get_validation_report': {
          const { storyData } = args as { storyData: any };

          if (!storyData) {
            throw new McpError(ErrorCode.InvalidRequest, 'storyData is required');
          }

          const report = getValidationReport(storyData);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(report, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
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
  console.log('✅ MCP Validator Server running on stdio');
}
