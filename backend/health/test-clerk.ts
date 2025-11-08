import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createClerkClient } from "@clerk/backend";

const clerkSecretKey = secret("ClerkSecretKey");

interface ClerkHealthResponse {
  status: "healthy" | "unhealthy";
  clerkSecretConfigured: boolean;
  clerkSecretLength: number;
  clerkApiReachable: boolean;
  error?: string;
  details?: string;
}

/**
 * Test Clerk API connectivity and configuration
 * Use this endpoint to diagnose authentication issues
 */
export const testClerk = api<void, ClerkHealthResponse>(
  { expose: true, method: "GET", path: "/health/test-clerk", auth: false },
  async (): Promise<ClerkHealthResponse> => {
    console.log("🔍 Testing Clerk API connectivity...");

    try {
      // Check if secret is configured
      const secretKey = clerkSecretKey();

      if (!secretKey || secretKey.length === 0) {
        console.error("❌ ClerkSecretKey is not configured!");
        return {
          status: "unhealthy",
          clerkSecretConfigured: false,
          clerkSecretLength: 0,
          clerkApiReachable: false,
          error: "ClerkSecretKey is missing or empty",
          details: "Set ClerkSecretKey in Railway environment variables"
        };
      }

      console.log("✅ ClerkSecretKey is configured (length: " + secretKey.length + ")");

      // Try to create Clerk client and make a simple API call
      const clerkClient = createClerkClient({ secretKey });

      // Test API connectivity by fetching the organization list (lightweight call)
      try {
        await clerkClient.organizations.getOrganizationList({ limit: 1 });
        console.log("✅ Clerk API is reachable!");

        return {
          status: "healthy",
          clerkSecretConfigured: true,
          clerkSecretLength: secretKey.length,
          clerkApiReachable: true,
          details: "Clerk API is working correctly"
        };
      } catch (apiError: any) {
        console.error("❌ Clerk API call failed:", apiError.message);

        return {
          status: "unhealthy",
          clerkSecretConfigured: true,
          clerkSecretLength: secretKey.length,
          clerkApiReachable: false,
          error: apiError.message || "Clerk API unreachable",
          details: "Network connectivity issue or invalid API key"
        };
      }
    } catch (error: any) {
      console.error("❌ Unexpected error testing Clerk:", error);

      return {
        status: "unhealthy",
        clerkSecretConfigured: false,
        clerkSecretLength: 0,
        clerkApiReachable: false,
        error: error.message || "Unknown error",
        details: "Failed to test Clerk configuration"
      };
    }
  }
);
