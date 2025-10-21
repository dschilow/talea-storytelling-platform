import express from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { authenticate } from './auth.js';
import type { Request, Response } from 'express';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'talea-mcp-main',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// MCP endpoint for tool calls
app.post('/mcp', authenticate, async (req: Request, res: Response) => {
  try {
    const { method, params } = req.body;
    const userId = (req as any).userId;

    console.log(`📥 MCP Request: ${method}`, { userId, params });

    // Import tools directly to avoid MCP Server complexity
    const { handleToolCall, listTools } = await import('./tools.js');

    let result;

    if (method === 'tools/list') {
      result = listTools();
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      result = await handleToolCall(name, args, userId);
    } else {
      res.status(400).json({
        error: 'Invalid MCP method',
        message: `Method ${method} is not supported`,
      });
      return;
    }

    console.log(`✅ MCP Response: ${method}`, { success: true });

    res.json(result);
  } catch (error) {
    console.error('❌ MCP Error:', error);

    res.status(500).json({
      error: 'MCP execution failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// SSE endpoint (for real-time MCP communication)
app.get('/sse', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  console.log(`🔌 SSE Connection opened for user: ${userId}`);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`:keep-alive\n\n`);
  }, 30000);

  // Cleanup on close
  req.on('close', () => {
    clearInterval(keepAlive);
    console.log(`🔌 SSE Connection closed for user: ${userId}`);
  });
});

// Start server
export function startServer(): void {
  app.listen(CONFIG.server.port, () => {
    console.log(`
✅ MCP Main Server running on port ${CONFIG.server.port}
🔗 Health: http://localhost:${CONFIG.server.port}/health
🔗 MCP Endpoint: http://localhost:${CONFIG.server.port}/mcp
🔗 SSE Endpoint: http://localhost:${CONFIG.server.port}/sse
    `);
  });
}
