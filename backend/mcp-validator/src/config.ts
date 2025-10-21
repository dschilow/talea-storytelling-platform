import { config } from 'dotenv';

// Load environment variables
config();

export const CONFIG = {
  mcp: {
    apiKey: process.env.MCP_SERVER_API_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '8080', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
} as const;

// Validation
export function validateConfig(): void {
  const requiredVars = ['MCP_SERVER_API_KEY'];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  console.log('✅ Configuration validated successfully');
}
