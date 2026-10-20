import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptedImage,
  checkoutHitsAllowed,
  countsInBooks,
  demonstrationPaymentAllowed,
  holdIsDue,
  isRetiredSeedToken,
  mintOrderToken,
  orderProofAllows,
  ownerMayBind,
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

test("only a verified Google sign-in can bind the owner", () => {
  assert.equal(ownerMayBind(false, ["grok-google"]), false);
  assert.equal(ownerMayBind(true, ["credential"]), false);
  assert.equal(ownerMayBind(true, ["grok-x"]), false);
  assert.equal(ownerMayBind(true, []), false);
  assert.equal(ownerMayBind(true, ["grok-google"]), true);
});

test("new order tokens are not the published seed pattern", () => {
  const first = mintOrderToken();
  const second = mintOrderToken();
  assert.equal(isRetiredSeedToken("seed-token-1"), true);
  assert.equal(isRetiredSeedToken(first), false);
  assert.notEqual(first, second);
  assert.equal(first.length, 43);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
});

test("image uploads must match the declared type", () => {
  assert.equal(acceptedImage(png), true);
  assert.equal(acceptedImage("data:image/png;base64,AAAA"), false);
  assert.equal(acceptedImage("https://example.com/a.png"), false);
});
