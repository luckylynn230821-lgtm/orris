import assert from "node:assert/strict";
import test from "node:test";
import { stageOf } from "./stages.ts";

const base = {
  status: "paid",
  paymentStatus: "paid",
  fulfillmentStatus: "unfulfilled",
  reviewed: false,
  serviceStatus: "none",
  isDemo: false,
};

test("customer stages follow payment then shipment", () => {
  assert.equal(stageOf({ ...base, status: "pending", paymentStatus: "unpaid" }).label, "stage.unpaid.label");
  assert.equal(stageOf(base).label, "stage.toship.label");
  assert.equal(stageOf({ ...base, fulfillmentStatus: "shipped" }).detail, "stage.toreceive.detail");
  assert.equal(stageOf({ ...base, fulfillmentStatus: "fulfilled" }).label, "stage.toreview.label");
  assert.equal(stageOf({ ...base, fulfillmentStatus: "fulfilled", reviewed: true }).label, "stage.done.label");
  assert.equal(stageOf({ ...base, serviceStatus: "open", fulfillmentStatus: "shipped" }).key, "aftersales");
  assert.equal(stageOf({ ...base, fulfillmentStatus: "fulfilled", isDemo: true }).key, "done");
});
