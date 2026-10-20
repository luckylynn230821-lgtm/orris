/** Guest order proof stays in sessionStorage. It is not a URL search param. */

const STORAGE_KEY = "orris-order-secret";

function readMap(): Record<string, string> {
  try {
    if (typeof sessionStorage === "undefined") return {};
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value) out[key] = value;
    }
    return out;
  } catch {
    // Corrupt storage is ignored. The guest can paste the token again.
    return {};
  }
}

export function rememberOrderToken(number: string, token: string) {
  const cleanNumber = number.trim().toUpperCase();
  const cleanToken = token.trim();
  if (!cleanNumber || !cleanToken) return;
  try {
    if (typeof sessionStorage === "undefined") return;
    const current = readMap();
    current[cleanNumber] = cleanToken;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private mode can reject storage. Lookup still works for this submission.
  }
}

export function recallOrderToken(number: string): string {
  return readMap()[number.trim().toUpperCase()] ?? "";
}
