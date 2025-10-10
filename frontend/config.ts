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
export const clerkPublishableKey = "pk_test_c2luY2VyZS1qYXktNC5jbGVyay5hY2NvdW50cy5kZXYk";

// -----------------------------------------------------------------------------
// BACKEND API URL
// -----------------------------------------------------------------------------
// Auto-detect the backend API URL based on the current environment.
// In Leap.dev, the backend API is at a different subdomain.
// -----------------------------------------------------------------------------
export function getBackendUrl(): string {
  if (import.meta.env.VITE_CLIENT_TARGET) {
    return import.meta.env.VITE_CLIENT_TARGET;
  }
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    if (hostname.includes('.lp.dev')) {
      const projectId = hostname.split('.lp.dev')[0];
      return `https://${projectId}.api.lp.dev`;
    }
    
    if (hostname.includes('.up.railway.app')) {
      return import.meta.env.VITE_CLIENT_TARGET || 'https://your-backend.up.railway.app';
    }
  }
  
  return 'http://localhost:4000';
}
