import { ContractOutputError } from "./contracts";

export function transientGenerationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const http = error.message.match(/OpenRouter HTTP (\d{3})/);
  if (http) return [408, 429, 500, 502, 503, 504].includes(Number(http[1]));
  return error.name === "AbortError" || error.name === "TimeoutError" ||
    /fetch failed|network|ECONNRESET|ETIMEDOUT|connection (?:lost|reset)/i.test(error.message);
}

export function recoverableStageError(error: unknown, kind: string): boolean {
  // Review format recovery is handled separately against the exact manuscript.
  return transientGenerationError(error) || (kind !== "review" && error instanceof ContractOutputError);
}
