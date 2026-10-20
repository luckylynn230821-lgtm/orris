import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { recallOrderToken, rememberOrderToken } from "./order-secret.ts";

test("the order token is remembered in session storage, not in the address", () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  rememberOrderToken("or-1", "secret-token");
  assert.equal(recallOrderToken("OR-1"), "secret-token");
  const checkout = readFileSync("src/routes/checkout.tsx", "utf8");
  const lookup = readFileSync("src/routes/orders.tsx", "utf8");
  assert.equal(checkout.includes("search: { token"), false);
  assert.equal(lookup.includes("search: { token"), false);
  const seed = readFileSync("src/lib/commerce/seed.server.ts", "utf8");
  assert.equal(seed.includes("seed-token-"), false);
});
