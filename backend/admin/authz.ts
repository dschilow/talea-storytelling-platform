import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

export function ensureAdmin(): { userID: string } {
  const auth = getAuthData();
  if (!auth) {
    throw APIError.unauthenticated("authentication required");
  }
  if (auth.role !== "admin") {
    throw APIError.permissionDenied("admin access required");
  }
  return { userID: auth.userID };
}
