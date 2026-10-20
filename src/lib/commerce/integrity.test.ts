import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptedImage,
  checkoutHitsAllowed,
  countsInBooks,
  demonstrationPaymentAllowed,
  holdIsDue,
  orderProofAllows,
  resolveOwnerEmail,
} from "./integrity.ts";

const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]).toString("base64")}`;

test("an emailed order number is not enough to open an order", () => {
  assert.equal(
    orderProofAllows({ orderToken: "secret", token: "", sessionEmail: null, orderEmail: "a@b.co" }),
    false,
  );
  assert.equal(
    orderProofAllows({ orderToken: "secret", token: "secret", sessionEmail: null, orderEmail: "a@b.co" }),
    true,
  );
  assert.equal(
    orderProofAllows({ orderToken: "secret", token: "nope", sessionEmail: "other@b.co", orderEmail: "a@b.co" }),
    false,
  );
});

test("production cannot confirm a demonstration payment", () => {
  assert.equal(demonstrationPaymentAllowed("production"), false);
  assert.equal(demonstrationPaymentAllowed("preview"), true);
  assert.equal(demonstrationPaymentAllowed(undefined), true);
});

test("an unpaid hold expires once, and a paid order does not", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const due = new Date("2026-10-20T11:30:00Z");
  assert.equal(holdIsDue({ stockHeld: true, paymentStatus: "unpaid", reserveUntil: due, now }), true);
  assert.equal(holdIsDue({ stockHeld: false, paymentStatus: "unpaid", reserveUntil: due, now }), false);
  assert.equal(holdIsDue({ stockHeld: true, paymentStatus: "paid", reserveUntil: due, now }), false);
});

test("checkout rate limit allows eight and blocks the ninth", () => {
  assert.equal(checkoutHitsAllowed(8), true);
  assert.equal(checkoutHitsAllowed(9), false);
});

test("books exclude demonstration orders unless the desk asks", () => {
  assert.equal(countsInBooks({ includeDemo: false, isDemo: true, paymentSource: "none" }), false);
  assert.equal(countsInBooks({ includeDemo: false, isDemo: false, paymentSource: "demonstration" }), false);
  assert.equal(countsInBooks({ includeDemo: false, isDemo: false, paymentSource: "gateway" }), true);
  assert.equal(countsInBooks({ includeDemo: true, isDemo: true, paymentSource: "demonstration" }), true);
});

test("production does not invent an owner from source code", () => {
  assert.equal(resolveOwnerEmail(null, undefined, true), null);
  assert.equal(resolveOwnerEmail(null, "Owner@shop.test", true), "owner@shop.test");
  assert.equal(resolveOwnerEmail("kept@shop.test", "other@shop.test", true), "kept@shop.test");
  assert.equal(resolveOwnerEmail(null, undefined, false), "luckylynn230821@gmail.com");
});

test("image uploads must match the declared type", () => {
  assert.equal(acceptedImage(png), true);
  assert.equal(acceptedImage("data:image/png;base64,AAAA"), false);
  assert.equal(acceptedImage("https://example.com/a.png"), false);
});
