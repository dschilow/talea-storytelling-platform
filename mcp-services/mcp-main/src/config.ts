import { config } from 'dotenv';

// Load environment variables
config();

export const CONFIG = {
  database: {
    url: process.env.DATABASE_URL || '',
  },
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY || '',
  },
  mcp: {
    apiKey: process.env.MCP_SERVER_API_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
} as const;

// Validation
export function validateConfig(): void {
  const requiredVars = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'MCP_SERVER_API_KEY',
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  console.log('✅ Configuration validated successfully');
}
