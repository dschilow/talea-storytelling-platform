import express from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { createMcpServer } from './tools.js';
import type { Request, Response } from 'express';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Larger limit for story data

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'talea-mcp-validator',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// MCP Server instance
const mcpServer = createMcpServer();

// Validate MCP API Key middleware
function validateApiKey(req: Request, res: Response, next: () => void): void {
  const apiKey = req.headers['x-mcp-api-key'] as string;

  if (!apiKey || apiKey !== CONFIG.mcp.apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing MCP API Key',
    });
    return;
  }

  next();
}

// MCP endpoint
app.post('/mcp', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { method, params } = req.body;

    console.log(`📥 MCP Validator Request: ${method}`);

    // Import tools directly
    const { handleToolCall, listTools } = await import('./tools.js');

    let result;

    if (method === 'tools/list') {
      result = listTools();
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      result = await handleToolCall(name, args);
    } else {
      res.status(400).json({
        error: 'Invalid MCP method',
        message: `Method ${method} is not supported`,
      });
      return;
    }

    console.log(`✅ MCP Validator Response: ${method}`, { success: true });

    res.json(result);
  } catch (error) {
    console.error('❌ MCP Validator Error:', error);

    res.status(500).json({
      error: 'MCP execution failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start server
export function startServer(): void {
  app.listen(CONFIG.server.port, () => {
    console.log(`
✅ MCP Validator Server running on port ${CONFIG.server.port}
🔗 Health: http://localhost:${CONFIG.server.port}/health
🔗 MCP Endpoint: http://localhost:${CONFIG.server.port}/mcp
    `);
  });
}
