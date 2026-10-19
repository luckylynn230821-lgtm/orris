export type RangeKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "last_month"
  | "year"
  | "custom";

export type ResolvedRange = {
  key: RangeKey;
  label: string;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
};

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function startOfUtcDay(date: Date): Date {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

const LABELS: Record<RangeKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  last_month: "Last month",
  year: "This year",
  custom: "Custom range",
};

export function resolveRange(
  key: RangeKey,
  now = new Date(),
  custom?: { from?: string; to?: string },
): ResolvedRange {
  const today = startOfUtcDay(now);
  const tomorrow = addUtcDays(today, 1);
  let start = addUtcDays(today, -29);
  let end = tomorrow;

  if (key === "today") start = today;
  else if (key === "yesterday") {
    start = addUtcDays(today, -1);
    end = today;
  } else if (key === "7d") start = addUtcDays(today, -6);
  else if (key === "30d") start = addUtcDays(today, -29);
  else if (key === "month") start = utcDay(today.getUTCFullYear(), today.getUTCMonth(), 1);
  else if (key === "last_month") {
    start = utcDay(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
    end = utcDay(today.getUTCFullYear(), today.getUTCMonth(), 1);
  } else if (key === "year") start = utcDay(today.getUTCFullYear(), 0, 1);
  else if (key === "custom") {
    const from = custom?.from ? new Date(`${custom.from}T00:00:00.000Z`) : today;
    const to = custom?.to ? new Date(`${custom.to}T00:00:00.000Z`) : today;
    const a = Number.isNaN(from.getTime()) ? today : from;
    const b = Number.isNaN(to.getTime()) ? today : to;
    start = a <= b ? a : b;
    end = addUtcDays(a <= b ? b : a, 1);
  }

  const length = end.getTime() - start.getTime();
  return {
    key,
    label: LABELS[key],
    start,
    end,
    previousStart: new Date(start.getTime() - length),
    previousEnd: start,
  };
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type LineFact = {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  qty: number;
  refundedQty: number;
  unitPriceCents: number;
  unitCostCents: number;
};

export type OrderFact = {
  id: string;
  createdAt: string;
  paymentStatus: string;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  refundedCents: number;
  totalCents: number;
  lines: LineFact[];
};

export function countsAsSale(order: OrderFact): boolean {
  return ["paid", "partially_refunded", "refunded"].includes(order.paymentStatus);
}

export function shippingQuote(
  subtotalCents: number,
  method: "standard" | "express",
  settings: { flatCents: number; expressCents: number; thresholdCents: number },
): number {
  if (method === "express") return settings.expressCents;
  return subtotalCents >= settings.thresholdCents ? 0 : settings.flatCents;
}

function lineGross(line: LineFact): number {
  return line.qty * line.unitPriceCents;
}

export function allocatedRefund(order: OrderFact, line: LineFact): number {
  const gross = order.lines.reduce((sum, item) => sum + lineGross(item), 0);
  if (gross <= 0 || order.refundedCents <= 0) return 0;
  return Math.round((order.refundedCents * lineGross(line)) / gross);
}

export type Economics = {
  grossCents: number;
  discountCents: number;
  refundCents: number;
  netCents: number;
  units: number;
  cogsCents: number;
  profitCents: number;
  shippingCents: number;
  taxCents: number;
  paidTotalCents: number;
};

export function orderEconomics(order: OrderFact): Economics {
  const grossCents = order.lines.reduce((sum, line) => sum + lineGross(line), 0);
  const units = order.lines.reduce((sum, line) => sum + (line.qty - line.refundedQty), 0);
  const cogsCents = order.lines.reduce(
    (sum, line) => sum + (line.qty - line.refundedQty) * line.unitCostCents,
    0,
  );
  const netCents = grossCents - order.discountCents - order.refundedCents;
  return {
    grossCents,
    discountCents: order.discountCents,
    refundCents: order.refundedCents,
    netCents,
    units,
    cogsCents,
    profitCents: netCents - cogsCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    paidTotalCents: order.totalCents - order.refundedCents,
  };
}

export type Kpis = Economics & {
  orders: number;
  aovCents: number | null;
  margin: number | null;
  refundRate: number | null;
};

export function summarize(orders: OrderFact[]): Kpis {
  const sales = orders.filter(countsAsSale);
  const empty: Kpis = {
    grossCents: 0,
    discountCents: 0,
    refundCents: 0,
    netCents: 0,
    units: 0,
    cogsCents: 0,
    profitCents: 0,
    shippingCents: 0,
    taxCents: 0,
    paidTotalCents: 0,
    orders: 0,
    aovCents: null,
    margin: null,
    refundRate: null,
  };
  if (sales.length === 0) return empty;
  const totals = sales.reduce((acc, order) => {
    const econ = orderEconomics(order);
    acc.grossCents += econ.grossCents;
    acc.discountCents += econ.discountCents;
    acc.refundCents += econ.refundCents;
    acc.netCents += econ.netCents;
    acc.units += econ.units;
    acc.cogsCents += econ.cogsCents;
    acc.profitCents += econ.profitCents;
    acc.shippingCents += econ.shippingCents;
    acc.taxCents += econ.taxCents;
    acc.paidTotalCents += econ.paidTotalCents;
    return acc;
  }, empty);
  totals.orders = sales.length;
  totals.aovCents = Math.round(totals.paidTotalCents / sales.length);
  totals.margin = totals.netCents > 0 ? totals.profitCents / totals.netCents : null;
  totals.refundRate = totals.grossCents > 0 ? totals.refundCents / totals.grossCents : null;
  return totals;
}

export function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export type DailyPoint = {
  date: string;
  netCents: number;
  orders: number;
  profitCents: number;
  units: number;
};

export function dailySeries(orders: OrderFact[], start: Date, end: Date): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (let cursor = new Date(start); cursor < end; cursor = addUtcDays(cursor, 1)) {
    const date = dayKey(cursor);
    map.set(date, { date, netCents: 0, orders: 0, profitCents: 0, units: 0 });
  }
  for (const order of orders) {
    if (!countsAsSale(order)) continue;
    const date = order.createdAt.slice(0, 10);
    const point = map.get(date);
    if (!point) continue;
    const econ = orderEconomics(order);
    point.netCents += econ.netCents;
    point.orders += 1;
    point.profitCents += econ.profitCents;
    point.units += econ.units;
  }
  return [...map.values()];
}

export type ProductStat = {
  productId: string;
  name: string;
  sku: string;
  categoryName: string;
  priceCents: number;
  costCents: number;
  units: number;
  grossCents: number;
  netCents: number;
  profitCents: number;
  margin: number | null;
  refundCents: number;
  refundRate: number | null;
};

export function productRollup(orders: OrderFact[]): ProductStat[] {
  const map = new Map<string, ProductStat & { qtySold: number }>();
  for (const order of orders) {
    if (!countsAsSale(order)) continue;
    for (const line of order.lines) {
      const current = map.get(line.productId) ?? {
        productId: line.productId,
        name: line.productName,
        sku: line.sku,
        categoryName: line.categoryName,
        priceCents: line.unitPriceCents,
        costCents: line.unitCostCents,
        units: 0,
        grossCents: 0,
        netCents: 0,
        profitCents: 0,
        margin: null,
        refundCents: 0,
        refundRate: null,
        qtySold: 0,
      };
      const gross = lineGross(line);
      const refund = allocatedRefund(order, line);
      const net = gross - refund;
      const units = line.qty - line.refundedQty;
      const cogs = units * line.unitCostCents;
      current.units += units;
      current.qtySold += line.qty;
      current.grossCents += gross;
      current.netCents += net;
      current.refundCents += refund;
      current.profitCents += net - cogs;
      current.priceCents = line.unitPriceCents;
      current.costCents = line.unitCostCents;
      current.sku = line.sku;
      map.set(line.productId, current);
    }
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      margin: row.netCents > 0 ? row.profitCents / row.netCents : null,
      refundRate: row.grossCents > 0 ? row.refundCents / row.grossCents : null,
    }))
    .sort((a, b) => b.netCents - a.netCents);
}

export type Thresholds = {
  lowStock: number;
  slowCoverDays: number;
  replenishCoverDays: number;
  minViews: number;
  highMargin: number;
  lowMargin: number;
  lowConversion: number;
  judgementDays: number;
};

export type InsightInput = {
  productId: string;
  name: string;
  ageDays: number;
  inventory: number;
  units: number;
  netCents: number;
  profitCents: number;
  margin: number | null;
  refundRate: number | null;
  views: number;
  addToCarts: number;
  purchases: number;
};

export type Insight = {
  productId: string;
  name: string;
  flags: string[];
  reasons: string[];
  units: number;
  netCents: number;
  profitCents: number;
  margin: number | null;
  inventory: number;
  views: number;
  addToCarts: number;
  purchases: number;
  conversion: number | null;
  daysCover: number | null;
};

export const FLAG_LABEL: Record<string, string> = {
  best_seller: "Best seller",
  high_margin: "High-margin",
  low_margin: "Low margin",
  underperforming: "Underperforming",
  slow_moving: "Slow-moving inventory",
  high_interest_low_conversion: "High interest, low conversion",
  replenishment: "Replenishment candidate",
  high_refund: "High refund",
  insufficient: "Insufficient data",
  steady: "Steady",
};

export function diagnose(items: InsightInput[], thresholds: Thresholds, windowDays: number): Insight[] {
  const ranked = [...items].sort((a, b) => b.units - a.units);
  const bestIds = new Set(
    ranked.filter((item) => item.units >= 5).slice(0, 3).map((item) => item.productId),
  );

  return items
    .map((item) => {
      const conversion = item.views > 0 ? item.purchases / item.views : null;
      const daysCover =
        item.units > 0 ? item.inventory / (item.units / Math.max(windowDays, 1)) : null;
      const youngAndQuiet =
        item.ageDays < thresholds.judgementDays && item.units < 2 && item.views < thresholds.minViews;
      const note = (key: string, vars: Record<string, string | number>) => `${key}\n${JSON.stringify(vars)}`;

      if (youngAndQuiet) {
        return {
          ...base(item, conversion, daysCover),
          flags: ["insufficient"],
          reasons: [
            note("insight.insufficient", { days: item.ageDays, views: item.views, units: item.units }),
          ],
        };
      }

      const flags: string[] = [];
      const reasons: string[] = [];

      if (bestIds.has(item.productId)) {
        flags.push("best_seller");
        reasons.push(note("insight.bestUnits", { units: item.units }));
      }
      if (item.margin !== null && item.units >= 2 && item.netCents > 0 && item.margin >= thresholds.highMargin) {
        flags.push("high_margin");
        reasons.push(note("insight.highMargin", {
          margin: (item.margin * 100).toFixed(1),
          line: (thresholds.highMargin * 100).toFixed(0),
          net: item.netCents,
        }));
      }
      if (
        item.margin !== null &&
        item.units >= 2 &&
        item.netCents > 0 &&
        item.margin < thresholds.lowMargin
      ) {
        flags.push("low_margin");
        reasons.push(note("insight.lowMargin", {
          margin: (item.margin * 100).toFixed(1),
          line: (thresholds.lowMargin * 100).toFixed(0),
        }));
      }
      if (
        item.refundRate !== null &&
        item.refundRate >= 0.15 &&
        item.units >= 3
      ) {
        flags.push("high_refund");
        reasons.push(note("insight.highRefund", { rate: (item.refundRate * 100).toFixed(1) }));
      }
      if (
        daysCover !== null &&
        item.units >= 3 &&
        daysCover < thresholds.replenishCoverDays
      ) {
        flags.push("replenishment");
        reasons.push(note("insight.replenish", {
          days: daysCover.toFixed(0),
          units: item.units,
          window: windowDays,
          stock: item.inventory,
          line: thresholds.replenishCoverDays,
        }));
      }
      const slow =
        (item.units === 0 && item.inventory >= thresholds.lowStock && item.ageDays >= thresholds.judgementDays) ||
        (daysCover !== null && daysCover > thresholds.slowCoverDays && item.inventory >= thresholds.lowStock);
      if (slow) {
        flags.push("slow_moving");
        reasons.push(
          item.units === 0
            ? note("insight.slowNone", { stock: item.inventory })
            : note("insight.slowCover", {
                days: daysCover?.toFixed(0) ?? "",
                line: thresholds.slowCoverDays,
                stock: item.inventory,
              }),
        );
      }
      if (
        conversion !== null &&
        item.views >= thresholds.minViews &&
        conversion < thresholds.lowConversion
      ) {
        flags.push("high_interest_low_conversion");
        reasons.push(note("insight.lowConversion", {
          views: item.views,
          purchases: item.purchases,
          rate: (conversion * 100).toFixed(1),
          line: (thresholds.lowConversion * 100).toFixed(1),
        }));
      }
      if (
        item.ageDays >= thresholds.judgementDays &&
        item.views >= thresholds.minViews &&
        item.units <= 1 &&
        item.inventory > 0 &&
        (conversion === null || conversion < thresholds.lowConversion)
      ) {
        flags.push("underperforming");
        reasons.push(note("insight.underperforming", { days: item.ageDays, views: item.views, units: item.units }));
      }
      if (flags.length === 0) {
        flags.push("steady");
        reasons.push(note("insight.steady", {}));
      }
      return { ...base(item, conversion, daysCover), flags, reasons };
    })
    .sort((a, b) => b.netCents - a.netCents);
}

function base(item: InsightInput, conversion: number | null, daysCover: number | null) {
  return {
    productId: item.productId,
    name: item.name,
    units: item.units,
    netCents: item.netCents,
    profitCents: item.profitCents,
    margin: item.margin,
    inventory: item.inventory,
    views: item.views,
    addToCarts: item.addToCarts,
    purchases: item.purchases,
    conversion,
    daysCover,
  };
}

export function windowDays(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

export const LEDGER_CODES = ["1000", "1400", "2100", "2110", "4000", "4100", "4900", "4910", "5000", "5100", "9990"] as const;
export type LedgerCode = (typeof LEDGER_CODES)[number];
export type LedgerClass = "asset" | "liability" | "equity" | "income" | "expense";

export const LEDGER_CLASS: Record<LedgerCode, LedgerClass> = {
  "1000": "asset",
  "1400": "asset",
  "2100": "liability",
  "2110": "liability",
  "4000": "income",
  "4100": "income",
  "4900": "income",
  "4910": "income",
  "5000": "expense",
  "5100": "expense",
  "9990": "equity",
};

export type LedgerLine = { code: LedgerCode; debitCents: number; creditCents: number };

export type Ledger = {
  lines: LedgerLine[];
  debitCents: number;
  creditCents: number;
  earningsCents: number;
};

/** Cash-basis double entry for paid orders. Debits equal credits. */
export function buildLedger(orders: OrderFact[], logisticsCostCents: number): Ledger {
  const totals = summarize(orders.filter(countsAsSale));
  const logistics = Math.max(0, logisticsCostCents);
  const expected = totals.grossCents - totals.discountCents + totals.shippingCents + totals.taxCents;
  const documented = totals.paidTotalCents + totals.refundCents;
  const gap = expected - documented;
  const raw: LedgerLine[] = [
    { code: "1000", debitCents: totals.paidTotalCents, creditCents: 0 },
    { code: "4900", debitCents: totals.discountCents, creditCents: 0 },
    { code: "4910", debitCents: totals.refundCents, creditCents: 0 },
    { code: "4000", debitCents: 0, creditCents: totals.grossCents },
    { code: "4100", debitCents: 0, creditCents: totals.shippingCents },
    { code: "2100", debitCents: 0, creditCents: totals.taxCents },
    { code: "5000", debitCents: totals.cogsCents, creditCents: 0 },
    { code: "1400", debitCents: 0, creditCents: totals.cogsCents },
    { code: "5100", debitCents: logistics, creditCents: 0 },
    { code: "2110", debitCents: 0, creditCents: logistics },
  ];
  if (gap > 0) raw.push({ code: "9990", debitCents: gap, creditCents: 0 });
  else if (gap < 0) raw.push({ code: "9990", debitCents: 0, creditCents: -gap });
  const lines = raw.filter((line) => line.debitCents !== 0 || line.creditCents !== 0);
  const debitCents = lines.reduce((sum, line) => sum + line.debitCents, 0);
  const creditCents = lines.reduce((sum, line) => sum + line.creditCents, 0);
  return {
    lines,
    debitCents,
    creditCents,
    earningsCents: totals.profitCents + totals.shippingCents - logistics,
  };
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return [headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n");
}
