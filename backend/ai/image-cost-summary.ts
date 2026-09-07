/** Preserve billing without storing images, signed URLs or provider payloads. */
export function summarizeRunwareResponse(value: any): Record<string, unknown> {
  const rows = Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.results) ? value.results : value ? [value] : [];
  const costs = rows.map((row: any) => row?.cost).filter((cost: unknown) => cost !== null && cost !== undefined && cost !== "" && Number.isFinite(Number(cost)) && Number(cost) >= 0).map((cost: unknown) => ({ cost: Number(cost) }));
  return {
    responseType: Array.isArray(value) ? "array" : typeof value,
    itemCount: rows.length,
    hasError: Boolean(value?.error),
    // Existing consumers read data[].cost. An empty array means unknown.
    data: costs,
    costComplete: costs.length === rows.length && rows.length > 0,
  };
}
