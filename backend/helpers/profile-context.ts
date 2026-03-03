export function extractRequestedProfileId(input: unknown): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const candidates = [
    record["profileId"],
    record["activeProfileId"],
    record["profile_id"],
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export function extractParticipantProfileIds(input: unknown): string[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  const record = input as Record<string, unknown>;
  const direct = record["participantProfileIds"];
  const config = record["config"];
  const nested =
    config && typeof config === "object"
      ? (config as Record<string, unknown>)["participantProfileIds"]
      : undefined;

  const normalize = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      )
    );
  };

  const resolved = normalize(direct);
  if (resolved.length > 0) {
    return resolved;
  }

  return normalize(nested);
}
