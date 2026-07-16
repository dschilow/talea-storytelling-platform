export interface AvatarDevelopmentIdentity {
  id: string;
  name: string;
}

export interface AvatarDevelopmentChange {
  trait: string;
  change: number;
  description: string;
}

export interface AssignedAvatarDevelopment {
  avatarId: string;
  name: string;
  changedTraits: AvatarDevelopmentChange[];
}

const BASE_TRAITS = new Set([
  "knowledge",
  "creativity",
  "vocabulary",
  "courage",
  "curiosity",
  "teamwork",
  "empathy",
  "persistence",
  "logic",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: unknown): string {
  return cleanString(value)
    .normalize("NFKC")
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, " ");
}

function validTraitId(value: unknown): string | null {
  const trait = cleanString(value);
  if (!trait) return null;
  const [base, subcategory, ...rest] = trait.split(".");
  if (!BASE_TRAITS.has(base)) return null;
  if (rest.length > 0 || (subcategory !== undefined && !subcategory)) return null;
  return trait;
}

function positiveChange(value: unknown, trait: string): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const max = trait.includes(".") ? 5 : 6;
  return Math.max(1, Math.min(max, Math.round(parsed)));
}

function normalizeArrayChanges(value: unknown): AvatarDevelopmentChange[] {
  if (!Array.isArray(value)) return [];
  const result: AvatarDevelopmentChange[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    const entry = asRecord(raw);
    const trait = validTraitId(entry?.trait);
    if (!entry || !trait || seen.has(trait)) continue;
    const change = positiveChange(entry.change, trait);
    if (change === null) continue;
    const description = cleanString(entry.description ?? entry.reason).slice(0, 240)
      || "Entwicklung durch ein konkretes Erlebnis in der Geschichte.";
    result.push({ trait, change, description });
    seen.add(trait);
    if (result.length >= 4) break;
  }

  return result;
}

function normalizeObjectChanges(value: unknown): AvatarDevelopmentChange[] {
  const source = asRecord(value);
  if (!source) return [];
  const result: AvatarDevelopmentChange[] = [];

  for (const [rawTrait, rawValue] of Object.entries(source)) {
    const trait = validTraitId(rawTrait);
    const entry = asRecord(rawValue);
    if (!trait || !entry) continue;
    const before = Number(entry.before);
    const after = Number(entry.after);
    const rawChange = entry.change ?? (
      Number.isFinite(before) && Number.isFinite(after) ? after - before : undefined
    );
    const change = positiveChange(rawChange, trait);
    if (change === null) continue;
    const description = cleanString(entry.description ?? entry.reason).slice(0, 240)
      || "Entwicklung durch ein konkretes Erlebnis in der Geschichte.";
    result.push({ trait, change, description });
    if (result.length >= 4) break;
  }

  return result;
}

export function normalizeAvatarDevelopmentChanges(value: unknown): AvatarDevelopmentChange[] {
  return Array.isArray(value) ? normalizeArrayChanges(value) : normalizeObjectChanges(value);
}

/**
 * Attaches generated developments to the immutable avatar ids selected for a
 * story. An explicit unknown id is rejected; it never falls back to a name.
 * Legacy name-only rows are accepted only when that name identifies exactly
 * one selected avatar.
 */
export function assignAvatarDevelopmentIds(
  developments: unknown,
  avatars: AvatarDevelopmentIdentity[],
): AssignedAvatarDevelopment[] {
  if (!Array.isArray(developments)) return [];

  const avatarById = new Map(
    avatars
      .filter((avatar) => cleanString(avatar.id))
      .map((avatar) => [cleanString(avatar.id), avatar]),
  );
  const avatarsByName = new Map<string, AvatarDevelopmentIdentity[]>();
  for (const avatar of avatarById.values()) {
    const key = normalizeName(avatar.name);
    if (!key) continue;
    avatarsByName.set(key, [...(avatarsByName.get(key) || []), avatar]);
  }

  const assigned: AssignedAvatarDevelopment[] = [];
  const assignedIds = new Set<string>();

  for (const raw of developments) {
    const entry = asRecord(raw);
    if (!entry) continue;

    const explicitAvatarId = cleanString(entry.avatarId);
    let avatar: AvatarDevelopmentIdentity | undefined;
    if (explicitAvatarId) {
      avatar = avatarById.get(explicitAvatarId);
      if (!avatar) continue;
    } else {
      const nameKey = normalizeName(entry.name ?? entry.avatarName);
      const candidates = nameKey ? avatarsByName.get(nameKey) || [] : [];
      if (candidates.length !== 1) continue;
      avatar = candidates[0];
    }

    if (assignedIds.has(avatar.id)) continue;
    const changedTraits = normalizeAvatarDevelopmentChanges(
      entry.changedTraits ?? entry.updates,
    );
    if (changedTraits.length === 0) continue;

    assigned.push({
      avatarId: avatar.id,
      name: avatar.name,
      changedTraits,
    });
    assignedIds.add(avatar.id);
  }

  return assigned;
}

export function getAssignedDevelopmentForAvatar(args: {
  developments: unknown;
  eligibleAvatars: AvatarDevelopmentIdentity[];
  avatarId: string;
}): AssignedAvatarDevelopment | undefined {
  return assignAvatarDevelopmentIds(args.developments, args.eligibleAvatars)
    .find((development) => development.avatarId === args.avatarId);
}
