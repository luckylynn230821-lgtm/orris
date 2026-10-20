import assert from "node:assert/strict";
import test from "node:test";
import { backupTargetIsSafe, dumpHasRestoreMarkers } from "./backup-plan.mjs";

test("a restorable dump names the commerce tables and stays out of the repo", () => {
  const dump = `--
-- PostgreSQL database dump
--
CREATE TABLE public.orders (id text);
CREATE TABLE public.store_settings (id integer);
`;
  assert.equal(dumpHasRestoreMarkers(dump), true);
  assert.equal(dumpHasRestoreMarkers("create table orders (id text);"), false);
  assert.equal(backupTargetIsSafe("/var/backups/orris.sql"), true);
  assert.equal(backupTargetIsSafe("docs/audit/orders.sql"), false);
  assert.equal(backupTargetIsSafe("../secrets.dump"), false);
});
