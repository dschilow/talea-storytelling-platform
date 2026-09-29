/** Preserve billing without storing images, signed URLs or provider payloads. */
export function summarizeRunwareResponse(value: any): Record<string, unknown> {
  const rows = Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.results) ? value.results : value ? [value] : [];
  const costs = rows.map((row: any) => row?.cost).filter((cost: unknown) => cost !== null && cost !== undefined && cost !== "" && Number.isFinite(Number(cost)) && Number(cost) >= 0).map((cost: unknown) => ({ cost: Number(cost) }));
  // Runware reports failures as { errors: [{ code, message }] }. Story c6df0e94
  // got HTTP 429 on all 29 requests and the log said only "hasError: false".
  const firstError = Array.isArray(value?.errors) ? value.errors[0] : value?.error;
  const errorCode = typeof firstError === "object" && firstError ? String(firstError.code ?? "").slice(0, 80) : "";
  const errorMessage = typeof firstError === "string" ? firstError.slice(0, 200) : typeof firstError === "object" && firstError ? String(firstError.message ?? "").slice(0, 200) : "";
  return {
    responseType: Array.isArray(value) ? "array" : typeof value,
    itemCount: rows.length,
    hasError: Boolean(firstError),
    ...(errorCode ? { errorCode } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    // Existing consumers read data[].cost. An empty array means unknown.
    data: costs,
    costComplete: costs.length === rows.length && rows.length > 0,
  };
}
