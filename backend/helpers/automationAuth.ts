// Simple API Key Authentication for Automated Testing
// Allows Claude to access test endpoints with a secret key

import { secret } from "encore.dev/config";

const automationApiKey = secret("AutomationAPIKey");

/**
 * Validates the automation API key from request header
 */
export function validateAutomationKey(key: string | undefined): boolean {
  if (!key) return false;

  const validKey = automationApiKey();
  if (!validKey) {
    console.warn("[Auth] AutomationAPIKey not configured - automation endpoints disabled");
    return false;
  }

  return key === validKey;
}

/**
 * Middleware to check automation API key
 */
export function requireAutomationKey(providedKey: string | undefined): void {
  if (!validateAutomationKey(providedKey)) {
    throw new Error("Invalid or missing automation API key");
  }
}
