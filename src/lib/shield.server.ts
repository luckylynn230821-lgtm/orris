import { getRequest } from "@tanstack/react-start/server";
import { userError } from "@/lib/commerce/errors";
import { AUTH_BUDGET, READ_BUDGET, WRITE_BUDGET, consume, type Budget } from "@/lib/shield";

/**
 * Response headers follow github.com/helmetjs/helmet. Helmet itself is
 * Express middleware, so it is not mounted here. Frame blocking is omitted on
 * purpose: the shop is shown inside the preview frame.
 */
export const SHIELD_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-dns-prefetch-control": "off",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "x-permitted-cross-domain-policies": "none",
  "strict-transport-security": "max-age=15552000; includeSubDomains",
};

let inFlight = 0;
const MAX_IN_FLIGHT = 48;

export function callerKey(header: (name: string) => string | null) {
  const forwarded = header("x-forwarded-for")?.split(",")[0]?.trim();
  const real = header("x-real-ip")?.trim();
  return (forwarded || real || "local").slice(0, 80);
}

export function guardCall(kind: "read" | "write") {
  if (inFlight >= MAX_IN_FLIGHT) throw userError("err.busy");
  const request = getRequest();
  const key = request ? callerKey((name) => request.headers.get(name)) : "local";
  const budget: Budget = kind === "write" ? WRITE_BUDGET : READ_BUDGET;
  const result = consume(kind, key, budget);
  if (!result.ok) throw userError("err.busy");
}

export function enter() {
  inFlight += 1;
}

export function leave() {
  inFlight = Math.max(0, inFlight - 1);
}

export function guardAuthRequest(request: Request) {
  const key = callerKey((name) => request.headers.get(name));
  const result = consume("auth", key, AUTH_BUDGET);
  if (result.ok) return null;
  return new Response("err.busy", {
    status: 429,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "retry-after": String(Math.ceil(result.retryMs / 1000)),
      ...SHIELD_HEADERS,
    },
  });
}
