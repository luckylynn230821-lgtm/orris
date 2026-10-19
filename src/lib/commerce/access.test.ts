import assert from "node:assert/strict";
import { test } from "node:test";
import { can } from "./access.ts";

test("the owner is the only role that can appoint people", () => {
  assert.equal(can("owner", { team: ["manage"] }), true);
  assert.equal(can("manager", { team: ["manage"] }), false);
  assert.equal(can("staff", { team: ["manage"] }), false);
});

test("only the owner can see cost and profit", () => {
  assert.equal(can("owner", { money: ["read"] }), true);
  assert.equal(can("manager", { money: ["read"] }), false);
  assert.equal(can("manager", { customer: ["read"] }), true);
  assert.equal(can("manager", { settings: ["update"] }), true);
  assert.equal(can("manager", { catalog: ["update"] }), true);
  assert.equal(can("staff", { money: ["read"] }), false);
  assert.equal(can("staff", { customer: ["read"] }), false);
  assert.equal(can("staff", { catalog: ["read"] }), false);
  assert.equal(can("staff", { settings: ["update"] }), false);
});

test("staff can ship, not refund or open inventory", () => {
  assert.equal(can("staff", { order: ["read"] }), true);
  assert.equal(can("staff", { order: ["fulfill"] }), true);
  assert.equal(can("staff", { order: ["refund"] }), false);
  assert.equal(can("staff", { inventory: ["read"] }), false);
  assert.equal(can("staff", { inventory: ["adjust"] }), false);
  assert.equal(can("manager", { inventory: ["read"] }), false);
  assert.equal(can("manager", { inventory: ["adjust"] }), false);
  assert.equal(can("owner", { inventory: ["read"] }), true);
  assert.equal(can("owner", { inventory: ["adjust"] }), true);
  assert.equal(can("manager", { order: ["refund"] }), true);
});
