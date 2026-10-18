import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dailySeries,
  diagnose,
  growth,
  orderEconomics,
  resolveRange,
  shippingQuote,
  summarize,
  toCsv,
  type OrderFact,
} from "./metrics.ts";

function order(partial: Partial<OrderFact> & Pick<OrderFact, "lines">): OrderFact {
  return {
    id: "o1",
    createdAt: "2026-10-01T12:00:00.000Z",
    paymentStatus: "paid",
    discountCents: 0,
    shippingCents: 1800,
    taxCents: 0,
    refundedCents: 0,
    totalCents: 0,
    ...partial,
    lines: partial.lines,
  };
}

const line = {
  productId: "p1",
  productName: "Throw",
  sku: "THR",
  categoryName: "Textiles",
  qty: 1,
  refundedQty: 0,
  unitPriceCents: 48000,
  unitCostCents: 18600,
};

describe("commerce metrics", () => {
  it("keeps shipping and tax out of net sales and gross profit", () => {
    const econ = orderEconomics(
      order({
        lines: [line],
        shippingCents: 1800,
        taxCents: 500,
        totalCents: 50300,
      }),
    );
    assert.equal(econ.grossCents, 48000);
    assert.equal(econ.netCents, 48000);
    assert.equal(econ.profitCents, 48000 - 18600);
    assert.equal(econ.shippingCents, 1800);
    assert.equal(econ.taxCents, 500);
  });

  it("zeroes profit on a full refund that restocks", () => {
    const econ = orderEconomics(
      order({
        paymentStatus: "refunded",
        refundedCents: 48000,
        totalCents: 48000,
        shippingCents: 0,
        lines: [{ ...line, refundedQty: 1 }],
      }),
    );
    assert.equal(econ.netCents, 0);
    assert.equal(econ.cogsCents, 0);
    assert.equal(econ.profitCents, 0);
    assert.equal(econ.units, 0);
  });

  it("reduces net sales but keeps cost when a refund does not restock", () => {
    const econ = orderEconomics(
      order({
        paymentStatus: "partially_refunded",
        refundedCents: 10000,
        totalCents: 48000,
        lines: [line],
      }),
    );
    assert.equal(econ.netCents, 38000);
    assert.equal(econ.cogsCents, 18600);
    assert.equal(econ.profitCents, 19400);
  });

  it("does not invent a growth rate from a zero base", () => {
    assert.equal(growth(100, 0), null);
    assert.equal(growth(0, 0), 0);
    assert.equal(growth(150, 100), 0.5);
  });

  it("fills empty days in a series", () => {
    const series = dailySeries(
      [
        order({
          createdAt: "2026-10-02T08:00:00.000Z",
          lines: [line],
          totalCents: 48000,
          shippingCents: 0,
        }),
      ],
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2026-10-04T00:00:00.000Z"),
    );
    assert.deepEqual(
      series.map((point) => point.date),
      ["2026-10-01", "2026-10-02", "2026-10-03"],
    );
    assert.equal(series[1]?.netCents, 48000);
    assert.equal(series[0]?.orders, 0);
  });

  it("quotes free standard shipping only over the threshold", () => {
    const settings = { flatCents: 1800, expressCents: 2800, thresholdCents: 25000 };
    assert.equal(shippingQuote(24900, "standard", settings), 1800);
    assert.equal(shippingQuote(25000, "standard", settings), 0);
    assert.equal(shippingQuote(90000, "express", settings), 2800);
  });

  it("refuses to mark a new quiet product as underperforming", () => {
    const [insight] = diagnose(
      [
        {
          productId: "new",
          name: "New cup",
          ageDays: 4,
          inventory: 20,
          units: 0,
          netCents: 0,
          profitCents: 0,
          margin: null,
          refundRate: null,
          views: 3,
          addToCarts: 0,
          purchases: 0,
        },
      ],
      {
        lowStock: 8,
        slowCoverDays: 90,
        replenishCoverDays: 14,
        minViews: 20,
        highMargin: 0.55,
        lowMargin: 0.25,
        lowConversion: 0.02,
        judgementDays: 21,
      },
      30,
    );
    assert.deepEqual(insight?.flags, ["insufficient"]);
  });

  it("flags replenishment from cover days without calling it slow", () => {
    const [insight] = diagnose(
      [
        {
          productId: "brass",
          name: "Brass",
          ageDays: 80,
          inventory: 4,
          units: 12,
          netCents: 150000,
          profitCents: 90000,
          margin: 0.6,
          refundRate: 0,
          views: 40,
          addToCarts: 20,
          purchases: 10,
        },
      ],
      {
        lowStock: 8,
        slowCoverDays: 90,
        replenishCoverDays: 14,
        minViews: 20,
        highMargin: 0.55,
        lowMargin: 0.25,
        lowConversion: 0.02,
        judgementDays: 21,
      },
      30,
    );
    assert.ok(insight?.flags.includes("replenishment"));
    assert.ok(insight?.flags.includes("high_margin"));
    assert.equal(insight?.flags.includes("slow_moving"), false);
    assert.equal(insight?.flags.includes("insufficient"), false);
  });

  it("escapes csv cells", () => {
    assert.equal(toCsv(["Name", "Note"], [["Throw", 'He said "hello"']]), 'Name,Note\nThrow,"He said ""hello"""');
  });

  it("uses an exclusive end so custom ranges include the last day", () => {
    const range = resolveRange("custom", new Date("2026-10-18T15:00:00.000Z"), {
      from: "2026-10-01",
      to: "2026-10-03",
    });
    assert.equal(range.start.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-10-04T00:00:00.000Z");
    assert.equal(range.previousEnd.toISOString(), range.start.toISOString());
  });

  it("summarizes average order value from paid totals after refunds", () => {
    const kpis = summarize([
      order({
        lines: [line],
        totalCents: 49800,
        shippingCents: 1800,
        refundedCents: 0,
      }),
      order({
        id: "o2",
        lines: [line],
        totalCents: 48000,
        shippingCents: 0,
        refundedCents: 48000,
        paymentStatus: "refunded",
      }),
    ]);
    assert.equal(kpis.orders, 2);
    assert.equal(kpis.aovCents, Math.round((49800 + 0) / 2));
  });
});
