// Simple API Key Authentication for Automated Testing
// Allows Claude to access test endpoints with a secret key
// Note: This helper does NOT load secrets - they must be passed as parameters

/**
 * Validates the automation API key against the configured key
 * @param providedKey - The API key from the request
 * @param validKey - The actual secret key from Encore config
 */
export function validateAutomationKey(
  providedKey: string | undefined,
  validKey: string | undefined
): boolean {
  if (!providedKey || !validKey) {
    return false;
  }

  return providedKey === validKey;
}

/**
 * Throws an error if the API key is invalid
 * @param providedKey - The API key from the request
 * @param validKey - The actual secret key from Encore config
 */
export function requireAutomationKey(
  providedKey: string | undefined,
  validKey: string | undefined
): void {
  if (!validKey) {
    throw new Error("AutomationAPIKey not configured - automation endpoints disabled");
  }

  if (!validateAutomationKey(providedKey, validKey)) {
    throw new Error("Invalid or missing automation API key");
  }
}
