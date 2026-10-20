const SHIELD_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-dns-prefetch-control": "off",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "x-permitted-cross-domain-policies": "none",
  "strict-transport-security": "max-age=15552000; includeSubDomains",
};

/** Deployed responses get Helmet-style headers. Frame blocking is left off so the preview can embed the shop. */
export default async function shieldHeaders(_event: unknown, next: () => Promise<unknown>) {
  const result = await next();
  if (!(result instanceof Response)) return result;
  const headers = new Headers(result.headers);
  for (const [name, value] of Object.entries(SHIELD_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
}
