export interface LockedCastSelection<T> {
  locked: T[];
  unresolvedNames: string[];
}

/**
 * Resolves the supporting cast already chosen by the winning premise without
 * silently substituting a different pool character later in the pipeline.
 */
export function selectLockedSupportingCast<T extends { name: string }>(
  pool: T[],
  requestedNames: string[],
  maxCount: number,
  normalize: (value: string) => string = (value) => value.trim().toLocaleLowerCase(),
): LockedCastSelection<T> {
  const byName = new Map(pool.map((character) => [normalize(character.name), character]));
  const locked: T[] = [];
  const unresolvedNames: string[] = [];

  for (const rawName of requestedNames) {
    const name = String(rawName || "").trim();
    if (!name) continue;
    const match = byName.get(normalize(name));
    if (!match) {
      if (!unresolvedNames.includes(name)) unresolvedNames.push(name);
      continue;
    }
    if (!locked.includes(match) && locked.length < Math.max(0, maxCount)) {
      locked.push(match);
    }
  }

  return { locked, unresolvedNames };
}
