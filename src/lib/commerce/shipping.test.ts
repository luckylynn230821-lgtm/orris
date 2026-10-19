import assert from "node:assert/strict";
import test from "node:test";
import { detectCarrier, trackLive } from "./shipping.ts";

test("a UPS 1Z number opens the UPS public page", () => {
  const hit = detectCarrier("1Z999AA10123456784");
  assert.equal(hit.carrier, "UPS");
  assert.match(hit.url, /^https:\/\/www\.ups\.com\/track\?tracknum=1Z999AA10123456784$/);
});

test("an ambiguous digit waybill stays on the 17TRACK public page", () => {
  const hit = detectCarrier("123456789012");
  assert.equal(hit.carrier, "17TRACK");
  assert.match(hit.url, /^https:\/\/t\.17track\.net\//);
});

test("an SF number is named 顺丰 and still uses the public page", () => {
  const hit = detectCarrier("SF1234567890123");
  assert.equal(hit.carrier, "顺丰");
  assert.match(hit.url, /17track\.net/);
});

test("a blank number is not a live scan", () => {
  const hit = trackLive({ tracking: "  " });
  assert.equal(hit.connected, false);
  if (!hit.connected) assert.equal(hit.reason, "missing_number");
});
