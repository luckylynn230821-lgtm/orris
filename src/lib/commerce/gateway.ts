import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Payment gateway contract for a later phase.
 * Nothing in this module marks an order paid, and no route calls it.
 * Production still refuses demonstration payment in customer.server.ts.
 */

export type GatewayEventName = "payment.succeeded" | "payment.failed" | "payment.refunded";

export type GatewayEvent = {
  id: string;
  type: GatewayEventName;
  orderNumber: string;
  amountCents: number;
};

export function verifyGatewaySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret || !rawBody) return false;
  const given = header.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]+$/i.test(given)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(given, "hex");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Real capture is not authorized. Callers must keep this false. */
export function gatewayMayCapture(): false {
  return false;
}

export function acceptGatewayEvent(event: GatewayEvent, signatureOk: boolean): { applied: false; reason: string } {
  if (!signatureOk) return { applied: false, reason: "bad-signature" };
  if (!event.id || event.amountCents < 0) return { applied: false, reason: "bad-event" };
  return { applied: false, reason: "not-live" };
}
