# CRITICAL: Clerk Keys Update Required

## Problem
- Frontend zeigt "Sign in to NotePad" statt "Sign in to Talea"
- 401 Unauthorized errors persist
- **Using wrong Clerk instance!**

## Current State
**Railway Frontend Variables** (INCORRECT):
```
VITE_CLERK_PUBLISHABLE_KEY = pk_test_YW11c2VkLWFhcmR2YXJrLTc4LmNsZXJrLmFjY291bnRzLmRldiQ
(amused-aardvark-78 - NotePad's Clerk instance)
```

**Railway Backend Variables** (NEED TO UPDATE):
```
CLERK_SECRET_KEY = sk_test_Lxft4y2rEfoYa8Q7X2GMCRakN4tUXAWHb5NvNPeGeM
(old key - doesn't match any instance)
```

## Correct Keys (Talea's Clerk Instance)

**Clerk Instance**: `sincere-jay-4.clerk.accounts.dev`

**Publishable Key**:
```
pk_test_c2luY2VyZS1qYXktNC5jbGVyay5hY2NvdW50cy5kZXYk
```

**Secret Key**:
```
sk_test_K8f5b0LyLp7Y5RXSWQsdGXc4kFTT19mXNsY1hm5PXR
```

## Action Required

### 1. Update Railway Frontend Variables

Go to: **Frontend Service → Variables**

**Change:**
```
VITE_CLERK_PUBLISHABLE_KEY = pk_test_c2luY2VyZS1qYXktNC5jbGVyay5hY2NvdW50cy5kZXYk
```

### 2. Update Railway Backend Variables

Go to: **Backend Service → Variables**

**Change:**
```
CLERK_SECRET_KEY = sk_test_K8f5b0LyLp7Y5RXSWQsdGXc4kFTT19mXNsY1hm5PXR
```

### 3. Redeploy Both Services

After updating variables:
1. Redeploy Frontend
2. Redeploy Backend

### 4. Verify

After redeploy:
1. Open: https://frontend-production-0b44.up.railway.app
2. Click "Sign in" or "Sign up"
3. Should show: **"Sign in to Talea"** (not NotePad!)
4. Login should work without 401 errors

## Why This Fixes Everything

**Before:**
- Frontend: Uses NotePad's Clerk (amused-aardvark-78)
- Backend: Uses invalid/old key
- **Result**: Token validation fails (wrong instances)

**After:**
- Frontend: Uses Talea's Clerk (sincere-jay-4)
- Backend: Uses Talea's Clerk Secret Key
- **Result**: ✅ Token validation succeeds!

## Code Changes Already Made

✅ `backend/auth/auth.ts`: Added Clerk domains to authorized parties
✅ `frontend/config.ts`: Already has correct fallback key

**Only Environment Variables need to be updated!**
