/**
 * Environment Configuration for Talea Mobile App
 */

export const ENV = {
  BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:4000',
  CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
} as const;

// Validate required environment variables
if (!ENV.CLERK_PUBLISHABLE_KEY) {
  console.warn('⚠️ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set');
}

if (!ENV.BACKEND_URL) {
  console.warn('⚠️ EXPO_PUBLIC_BACKEND_URL is not set, using default localhost');
}
