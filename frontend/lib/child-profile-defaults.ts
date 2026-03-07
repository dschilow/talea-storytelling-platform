import type { ChildProfile } from "@/contexts/ChildProfilesContext";

export type ChildAgeGroup = "3-5" | "6-8" | "9-12" | "13+";

export function ageToAgeGroup(age?: number | null): ChildAgeGroup | null {
  if (!Number.isFinite(age)) {
    return null;
  }

  if ((age as number) <= 5) return "3-5";
  if ((age as number) <= 8) return "6-8";
  if ((age as number) <= 12) return "9-12";
  return "13+";
}

export function parseKeywordInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );
}

export function formatKeywordInput(values: string[] | undefined): string {
  return (values || []).join(", ");
}

export function getPreferredAvatarIds(profile: ChildProfile | null | undefined): string[] {
  if (!profile) {
    return [];
  }

  const ids: string[] = [];
  if (profile.childAvatarId) {
    ids.push(profile.childAvatarId);
  }

  for (const avatarId of profile.preferredAvatarIds || []) {
    if (!ids.includes(avatarId)) {
      ids.push(avatarId);
    }
  }

  return ids;
}
