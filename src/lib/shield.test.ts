import assert from "node:assert/strict";
import { test } from "node:test";
import { consume, type Budget } from "./shield.ts";

const budget: Budget = { points: 2, windowMs: 1_000, blockMs: 5_000 };

test("a caller is blocked after spending the points", () => {
  const key = `shopper-${Date.now()}`;
  assert.equal(consume("write", key, budget, 1_000).ok, true);
  assert.equal(consume("write", key, budget, 1_100).ok, true);
  const blocked = consume("write", key, budget, 1_200);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.retryMs, 5_000);
});

test("the budget refills after the window", () => {
  const key = `later-${Date.now()}`;
  assert.equal(consume("read", key, budget, 1_000).ok, true);
  assert.equal(consume("read", key, budget, 1_100).ok, true);
  assert.equal(consume("read", key, budget, 2_100).ok, true);
});
