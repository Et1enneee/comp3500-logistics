/** Normalize a single-line delivery address; callers must still enforce authorization. */
export function normalizeDeliveryAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return null;
  }
  const normalized = value.trim();
  return normalized.length >= 1 && normalized.length <= 200 ? normalized : null;
}
