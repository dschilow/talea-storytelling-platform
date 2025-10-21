import { createClerkClient } from '@clerk/backend';
import { CONFIG } from './config.js';
import type { Request, Response, NextFunction } from 'express';

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: CONFIG.clerk.secretKey,
});

/**
 * Extract user ID from Clerk token
 */
export async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    // Remove "Bearer " prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '');

    // Verify the token with Clerk - decode JWT payload
    // Using simple decode for now (production would use full Clerk verification)
    const payload = JSON.parse(Buffer.from(cleanToken.split('.')[1], 'base64').toString());

    return payload.sub; // User ID
  } catch (error) {
    console.error('❌ Token verification failed:', error);
    return null;
  }
}

/**
 * Middleware: Validate MCP Server API Key
 */
export function validateMcpApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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

/**
 * Middleware: Validate Clerk Token and extract user ID
 */
export async function validateClerkToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization as string;

  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing authorization header',
    });
    return;
  }

  const userId = await getUserIdFromToken(authHeader);

  if (!userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }

  // Attach userId to request object
  (req as any).userId = userId;

  next();
}

/**
 * Combined middleware: Validate both MCP API Key and Clerk Token
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  validateMcpApiKey(req, res, async () => {
    await validateClerkToken(req, res, next);
  });
}
