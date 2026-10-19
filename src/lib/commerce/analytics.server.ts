import { getSql } from "@/lib/db";
import { iso, num } from "@/lib/format";
import { loadAllProducts, readSettings } from "./catalog.server";
import {
  dailySeries,
  diagnose,
  growth,
  productRollup,
  resolveRange,
  summarize,
  windowDays,
  buildLedger,
  type Insight,
  type LineFact,
  type OrderFact,
  type ProductStat,
  type RangeKey,
} from "./metrics";
import { ensureSeeded } from "./seed.server";

async function logisticsCost(
  sql: Awaited<ReturnType<typeof getSql>>,
  start: Date,
  end: Date,
  includeDemo: boolean,
) {
  try {
    const rows = await sql.query<{ n: number }>(
      `select coalesce(sum(f.logistics_cost_cents), 0)::int as n
       from fulfillments f
       join orders o on o.id = f.order_id
       where o.created_at >= $1 and o.created_at < $2
         and ($3::boolean or o.is_demo = false)`,
      [start.toISOString(), end.toISOString(), includeDemo],
    );
    return num(rows[0]?.n);
  } catch {
    return 0;
  }
}

export async function loadAnalytics(input: {
  range: RangeKey;
  from?: string;
  to?: string;
  includeDemo: boolean;
}) {
  await ensureSeeded();
  const settings = await readSettings();
  const range = resolveRange(input.range, new Date(), { from: input.from, to: input.to });
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select o.id, o.created_at, o.payment_status, o.discount_cents, o.shipping_cents, o.tax_cents,
            o.refunded_cents, o.total_cents, o.is_demo,
            i.product_id, i.product_name, i.sku, i.qty, i.refunded_qty, i.unit_price_cents, i.unit_cost_cents,
            coalesce(c.name, '') as category_name
     from orders o
     join order_items i on i.order_id = o.id
     left join products p on p.id = i.product_id
     left join categories c on c.id = p.category_id
     where o.created_at >= $1 and o.created_at < $2
       and ($3::boolean or o.is_demo = false)`,
    [range.previousStart.toISOString(), range.end.toISOString(), input.includeDemo],
  );

  const grouped = new Map<string, OrderFact>();
  for (const row of rows) {
    const id = String(row.id);
    const createdAt = iso(row.created_at);
    const fact = grouped.get(id) ?? {
      id,
      createdAt,
      paymentStatus: String(row.payment_status),
      discountCents: num(row.discount_cents),
      shippingCents: num(row.shipping_cents),
      taxCents: num(row.tax_cents),
      refundedCents: num(row.refunded_cents),
      totalCents: num(row.total_cents),
      lines: [] as LineFact[],
    };
    fact.lines.push({
      productId: String(row.product_id ?? ""),
      productName: String(row.product_name),
      sku: String(row.sku),
      categoryName: String(row.category_name ?? ""),
      qty: num(row.qty),
      refundedQty: num(row.refunded_qty),
      unitPriceCents: num(row.unit_price_cents),
      unitCostCents: num(row.unit_cost_cents),
    });
    grouped.set(id, fact);
  }
  const all = [...grouped.values()];
  const current = all.filter((order) => order.createdAt >= range.start.toISOString() && order.createdAt < range.end.toISOString());
  const previous = all.filter(
    (order) => order.createdAt >= range.previousStart.toISOString() && order.createdAt < range.previousEnd.toISOString(),
  );
  const kpis = summarize(current);
  const prev = summarize(previous);
  const products = mergeProducts(productRollup(current), productRollup(previous), await loadAllProducts());

  const events = await sql.query<{ product_id: string; event: string; n: number }>(
    `select product_id, event, coalesce(sum(qty), 0)::int as n
     from product_events
     where occurred_on >= $1::date and occurred_on < $2::date
       and ($3::boolean or is_demo = false)
     group by product_id, event`,
    [range.start.toISOString().slice(0, 10), range.end.toISOString().slice(0, 10), input.includeDemo],
  );
  const eventMap = new Map<string, { view: number; add_to_cart: number; purchase: number }>();
  for (const event of events) {
    const bucket = eventMap.get(event.product_id) ?? { view: 0, add_to_cart: 0, purchase: 0 };
    if (event.event === "view" || event.event === "add_to_cart" || event.event === "purchase") {
      bucket[event.event] = num(event.n);
    }
    eventMap.set(event.product_id, bucket);
  }

  const days = windowDays(range.start, range.end);
  const catalog = await loadAllProducts();
  const statById = new Map(productRollup(current).map((stat) => [stat.productId, stat]));
  const now = Date.now();
  const insights: Insight[] = diagnose(
    catalog
      .filter((product) => product.status === "published" || product.status === "draft")
      .map((product) => {
        const stat = statById.get(product.id);
        const ev = eventMap.get(product.id) ?? { view: 0, add_to_cart: 0, purchase: 0 };
        const published = product.publishedAt ? new Date(product.publishedAt).getTime() : now;
        const ageDays = Math.max(0, Math.floor((now - published) / 86_400_000));
        return {
          productId: product.id,
          name: product.name,
          ageDays,
          inventory: product.inventoryQty,
          units: stat?.units ?? 0,
          netCents: stat?.netCents ?? 0,
          profitCents: stat?.profitCents ?? 0,
          margin: stat?.margin ?? null,
          refundRate: stat?.refundRate ?? null,
          views: ev.view,
          addToCarts: ev.add_to_cart,
          purchases: ev.purchase,
        };
      }),
    {
      lowStock: settings.lowStock,
      slowCoverDays: settings.slowCoverDays,
      replenishCoverDays: settings.replenishCoverDays,
      minViews: settings.minViews,
      highMargin: settings.highMargin,
      lowMargin: settings.lowMargin,
      lowConversion: settings.lowConversion,
      judgementDays: settings.judgementDays,
    },
    days,
  ).map((insight) => {
    const product = catalog.find((item) => item.id === insight.productId);
    return { ...insight, image: product?.images[0]?.url ?? null, sku: product?.variants[0]?.sku ?? "" };
  });

  const funnel = {
    views: events.filter((event) => event.event === "view").reduce((sum, event) => sum + num(event.n), 0),
    addToCart: events.filter((event) => event.event === "add_to_cart").reduce((sum, event) => sum + num(event.n), 0),
    checkout: (
      await sql.query<{ n: number }>(
        `select coalesce(sum(qty), 0)::int as n from product_events
         where event = 'checkout_started' and occurred_on >= $1::date and occurred_on < $2::date
           and ($3::boolean or is_demo = false)`,
        [range.start.toISOString().slice(0, 10), range.end.toISOString().slice(0, 10), input.includeDemo],
      )
    )[0]?.n ?? 0,
    purchases: kpis.orders,
  };

  const logisticsCostCents = await logisticsCost(sql, range.start, range.end, input.includeDemo);
  return {
    range: {
      key: range.key,
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    includeDemo: input.includeDemo,
    kpis: {
      ...kpis,
      growthNet: growth(kpis.netCents, prev.netCents),
      growthOrders: growth(kpis.orders, prev.orders),
      previousNetCents: prev.netCents,
    },
    series: dailySeries(current, range.start, range.end),
    products: products.map((product) => ({
      ...product,
      views: eventMap.get(product.productId)?.view ?? 0,
      addToCarts: eventMap.get(product.productId)?.add_to_cart ?? 0,
      purchases: eventMap.get(product.productId)?.purchase ?? 0,
      conversion:
        (eventMap.get(product.productId)?.view ?? 0) > 0
          ? (eventMap.get(product.productId)?.purchase ?? 0) / (eventMap.get(product.productId)?.view ?? 1)
          : null,
      inventory: catalog.find((item) => item.id === product.productId)?.inventoryQty ?? 0,
      image: catalog.find((item) => item.id === product.productId)?.images[0]?.url ?? null,
    })),
    insights,
    funnel: {
      views: num(funnel.views),
      addToCart: num(funnel.addToCart),
      checkoutStarted: num(funnel.checkout),
      purchases: funnel.purchases,
    },
    definitions: {
      gross: "Sum of unit price × quantity on paid orders, before discounts and refunds. Shipping and tax are excluded.",
      net: "Gross sales minus discounts and refunds. Shipping and tax stay outside this number.",
      profit: "Net sales minus the cost snapshot of units still kept by the customer. Not net profit.",
      aov: "Paid order total after refunds, including shipping and tax, divided by paid orders.",
    },
    logisticsCostCents,
    ledger: buildLedger(current, logisticsCostCents),
  };
}

function mergeProducts(
  current: ProductStat[],
  previous: ProductStat[],
  catalog: Awaited<ReturnType<typeof loadAllProducts>>,
): (ProductStat & { growth: number | null })[] {
  const prev = new Map(previous.map((stat) => [stat.productId, stat]));
  const seen = new Set(current.map((stat) => stat.productId));
  const rows = current.map((stat) => ({
    ...stat,
    growth: growth(stat.units, prev.get(stat.productId)?.units ?? 0),
  }));
  for (const product of catalog) {
    if (product.status === "archived" || seen.has(product.id)) continue;
    rows.push({
      productId: product.id,
      name: product.name,
      sku: product.variants[0]?.sku ?? "",
      categoryName: product.categoryName,
      priceCents: product.priceCents,
      costCents: product.variants[0] && "costCents" in product.variants[0] ? num(product.variants[0].costCents) : 0,
      units: 0,
      grossCents: 0,
      netCents: 0,
      profitCents: 0,
      margin: null,
      refundCents: 0,
      refundRate: null,
      growth: growth(0, prev.get(product.id)?.units ?? 0),
    });
  }
  return rows;
}
