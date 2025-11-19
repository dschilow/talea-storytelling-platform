// Utility function to create a deterministic number from a string seed
// Copied here to avoid circular dependencies with ai-generation.ts
export function deterministicSeedFrom(source: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  return Math.abs(hash >>> 0);
}

