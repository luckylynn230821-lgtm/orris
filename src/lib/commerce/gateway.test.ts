import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { acceptGatewayEvent, gatewayMayCapture, verifyGatewaySignature } from "./gateway.ts";

test("a gateway signature must match and capture stays off", () => {
  const body = JSON.stringify({ id: "evt_1", type: "payment.succeeded" });
  const secret = "test-secret";
  const header = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(verifyGatewaySignature(body, header, secret), true);
  assert.equal(verifyGatewaySignature(body, header, "other"), false);
  assert.equal(verifyGatewaySignature(body, "sha256=abcd", secret), false);
  assert.equal(gatewayMayCapture(), false);
  assert.deepEqual(
    acceptGatewayEvent(
      { id: "evt_1", type: "payment.succeeded", orderNumber: "OR-1", amountCents: 100 },
      true,
    ),
    { applied: false, reason: "not-live" },
  );
});
