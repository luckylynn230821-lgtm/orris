import assert from "node:assert/strict";
import { test } from "node:test";
import { can } from "./access.ts";

test("the owner is the only role that can appoint people", () => {
  assert.equal(can("owner", { team: ["manage"] }), true);
  assert.equal(can("manager", { team: ["manage"] }), false);
  assert.equal(can("staff", { team: ["manage"] }), false);
});

test("a manager sees the books and a staff account does not", () => {
  assert.equal(can("manager", { money: ["read"] }), true);
  assert.equal(can("manager", { customer: ["read"] }), true);
  assert.equal(can("manager", { settings: ["update"] }), true);
  assert.equal(can("staff", { money: ["read"] }), false);
  assert.equal(can("staff", { customer: ["read"] }), false);
  assert.equal(can("staff", { catalog: ["read"] }), false);
  assert.equal(can("staff", { settings: ["update"] }), false);
});

test("staff can ship and count stock, not refund", () => {
  assert.equal(can("staff", { order: ["read"] }), true);
  assert.equal(can("staff", { order: ["fulfill"] }), true);
  assert.equal(can("staff", { order: ["refund"] }), false);
  assert.equal(can("staff", { inventory: ["adjust"] }), true);
  assert.equal(can("manager", { order: ["refund"] }), true);
});
