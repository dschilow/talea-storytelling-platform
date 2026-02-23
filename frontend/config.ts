// -----------------------------------------------------------------------------
// IMPORTANT: CLERK PUBLISHABLE KEY
// -----------------------------------------------------------------------------
// To enable user authentication, you must provide your Clerk Publishable Key.
//
// 1. Go to your Clerk Dashboard: https://dashboard.clerk.com
// 2. Navigate to your project's API Keys page.
// 3. Copy the "Publishable key".
// 4. Paste it here.
//
// Example:
// export const clerkPublishableKey = "pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
// -----------------------------------------------------------------------------
export function getClerkPublishableKey(): string {
  // 1. Check runtime config (window.ENV) - set by docker-entrypoint.sh
  if (typeof window !== 'undefined' && (window as any).ENV?.CLERK_PUBLISHABLE_KEY) {
    return (window as any).ENV.CLERK_PUBLISHABLE_KEY;
  }

  // 2. Check build-time env var
  if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    return import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  }

  // 3. Fallback for development - set VITE_CLERK_PUBLISHABLE_KEY in .env
  console.warn("Clerk publishable key not configured. Set VITE_CLERK_PUBLISHABLE_KEY in .env");
  return "";
}

// Export as constant for backward compatibility
export const clerkPublishableKey = getClerkPublishableKey();

// -----------------------------------------------------------------------------
// BACKEND API URL
// -----------------------------------------------------------------------------
// Auto-detect the backend API URL based on the current environment.
// In Leap.dev, the backend API is at a different subdomain.
// -----------------------------------------------------------------------------
export function getBackendUrl(): string {
  // 1. Check runtime config (window.ENV) - set by docker-entrypoint.sh
  if (typeof window !== 'undefined' && (window as any).ENV?.BACKEND_URL) {
    return (window as any).ENV.BACKEND_URL;
  }

  // 2. Check build-time env var
  if (import.meta.env.VITE_CLIENT_TARGET) {
    return import.meta.env.VITE_CLIENT_TARGET;
  }

  // 3. Auto-detect based on hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Check for talea.website domain (production on Railway)
    if (hostname === 'talea.website' || hostname === 'www.talea.website') {
      return 'https://talea-backend-production.up.railway.app';
    }

    if (hostname.includes('.lp.dev')) {
      const projectId = hostname.split('.lp.dev')[0];
      return `https://${projectId}.api.lp.dev`;
    }
  }

  // 4. Default to localhost for development
  return 'http://localhost:4000';
}
