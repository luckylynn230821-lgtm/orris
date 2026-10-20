import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("desk reports default to excluding demonstration data", () => {
  const files = [
    "src/routes/admin/index.tsx",
    "src/routes/admin/analytics.tsx",
    "src/routes/admin/reports.tsx",
    "src/routes/admin/intelligence.tsx",
    "src/lib/commerce/fns.ts",
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("useState(true)"), false, file);
  }
  const analytics = readFileSync("src/lib/commerce/fns.ts", "utf8");
  assert.match(analytics, /includeDemo: data\.includeDemo === true/);
});

test("isolated database: proof, production pay refusal, and hold expiry", async (t) => {
  if (process.env.DATABASE_URL?.trim()) {
    t.skip("DATABASE_URL is set; this write test must not touch Neon");
    return;
  }
  process.env.VERCEL_ENV = "test";
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
  const { getSql } = await vite.ssrLoadModule("/src/lib/db.ts");
  const { placeOrder, sweepExpiredHolds } = await vite.ssrLoadModule("/src/lib/commerce/checkout.server.ts");
  const { payOrder, viewOrder } = await vite.ssrLoadModule("/src/lib/commerce/customer.server.ts");
  const { loadAnalytics } = await vite.ssrLoadModule("/src/lib/commerce/analytics.server.ts");
  const { loadHome } = await vite.ssrLoadModule("/src/lib/commerce/catalog.server.ts");

  const { ensureSeeded } = await vite.ssrLoadModule("/src/lib/commerce/seed.server.ts");
  const { isRetiredSeedToken } = await vite.ssrLoadModule("/src/lib/commerce/integrity.ts");
  const sql = (await getSql()) as {
    query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  };
  await ensureSeeded();
  await sql.query("select setval('order_number_seq', 90000)");
  const email = "gate-hold@example.com";
  const checkout = (key: string) =>
    placeOrder(
      {
        email,
        name: "Gate Holder",
        line1: "1 Isolated Lane",
        city: "Test",
        region: "QA",
        postal: "00000",
        country: "Testland",
        shippingMethod: "standard",
        lines: [{ variantId: "v_throw", qty: 1 }],
        idempotencyKey: key,
      },
      null,
    );

  const qty = async () => {
    const rows = await sql.query("select inventory_qty from product_variants where id = $1", ["v_throw"]);
    return Number(rows[0]?.inventory_qty);
  };

  const before = await qty();
  const held = await checkout("11111111-1111-4111-8111-111111111111");
  assert.equal(isRetiredSeedToken(held.token), false);
  assert.equal(held.token.length >= 43, true);
  assert.equal(await qty(), before - 1);

  const byEmail = await viewOrder({ number: held.number, email });
  assert.equal(byEmail, null);
  const byWrongToken = await viewOrder({ number: held.number, token: "not-the-token" });
  assert.equal(byWrongToken, null);
  const byOtherSession = await viewOrder({
    number: held.number,
    sessionEmail: "someone-else@example.com",
  });
  assert.equal(byOtherSession, null);
  const byToken = await viewOrder({ number: held.number, token: held.token });
  assert.equal(byToken?.number, held.number);
  const bySession = await viewOrder({ number: held.number, sessionEmail: email });
  assert.equal(bySession?.number, held.number);

  const replay = await checkout("11111111-1111-4111-8111-111111111111");
  assert.equal(replay.replayed, true);
  const hits = await sql.query("select hits from rate_buckets where bucket = $1", [`checkout:${email}`]);
  assert.equal(Number(hits[0]?.hits), 1);

  process.env.VERCEL_ENV = "production";
  await assert.rejects(payOrder(held.number, { email, token: held.token }), /err\.payNotLive/);
  const unpaid = await sql.query(
    "select payment_status, stock_held, payment_source from orders where number = $1",
    [held.number],
  );
  assert.equal(unpaid[0]?.payment_status, "unpaid");
  assert.equal(unpaid[0]?.stock_held, true);
  assert.equal(unpaid[0]?.payment_source, "none");
  const demoPays = await sql.query("select count(*)::int as n from payments where provider = 'demonstration'");
  assert.equal(Number(demoPays[0]?.n), 0);
  assert.equal(await qty(), before - 1);

  await sql.query("update orders set reserve_until = now() - interval '1 minute' where number = $1", [
    held.number,
  ]);
  await sweepExpiredHolds();
  assert.equal(await qty(), before);
  const cancelled = await sql.query(
    "select status, stock_held, payment_status from orders where number = $1",
    [held.number],
  );
  assert.equal(cancelled[0]?.status, "cancelled");
  assert.equal(cancelled[0]?.stock_held, false);
  assert.equal(cancelled[0]?.payment_status, "unpaid");
  const releases = async () => {
    const rows = await sql.query(
      "select count(*)::int as n from inventory_movements where reference = $1 and reason = 'release'",
      [held.number],
    );
    return Number(rows[0]?.n);
  };
  assert.equal(await releases(), 1);
  await sweepExpiredHolds();
  assert.equal(await qty(), before);
  assert.equal(await releases(), 1);

  process.env.VERCEL_ENV = "preview";
  const paid = await checkout("22222222-2222-4222-8222-222222222222");
  const afterReserve = await qty();
  await payOrder(paid.number, { email: null, token: paid.token });
  const settled = await sql.query(
    "select payment_status, stock_held, payment_source from orders where number = $1",
    [paid.number],
  );
  assert.equal(settled[0]?.payment_status, "paid");
  assert.equal(settled[0]?.stock_held, false);
  assert.equal(settled[0]?.payment_source, "demonstration");
  await sql.query(
    `update orders set stock_held = true, reserve_until = now() - interval '1 minute' where number = $1`,
    [paid.number],
  );
  await sweepExpiredHolds();
  assert.equal(await qty(), afterReserve);
  const stillPaid = await sql.query("select status, payment_status from orders where number = $1", [paid.number]);
  assert.equal(stillPaid[0]?.payment_status, "paid");
  assert.notEqual(stillPaid[0]?.status, "cancelled");

  const hidden = await loadAnalytics({ range: "30d", includeDemo: false });
  const shown = await loadAnalytics({ range: "30d", includeDemo: true });
  assert.equal(hidden.kpis.orders, 0);
  assert.ok(shown.kpis.orders > hidden.kpis.orders);
  const quiet = await loadHome();
  assert.equal(quiet.leaders.length, 0);

  await sql.query(
    `insert into orders (
      id, number, access_token, email, customer_name, status, payment_status, fulfillment_status,
      subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, refunded_cents,
      currency, shipping_method, shipping_address, is_demo, stock_held, payment_source, created_at
    ) values (
      'ord_gate_live', 'OR-GATE-LIVE', 'gate-live-token', 'gate-live@example.com', 'Gate Live',
      'paid', 'paid', 'unfulfilled', 4200, 0, 0, 0, 4200, 0, 'USD', 'standard', '{}'::jsonb,
      false, false, 'gateway', now()
    )`,
  );
  await sql.query(
    `insert into order_items (
      id, order_id, product_id, variant_id, product_name, variant_title, sku, qty, unit_price_cents, unit_cost_cents
    ) values (
      'item_gate_live', 'ord_gate_live', 'p_throw', 'v_throw', 'Studio Bowl', 'One size', 'MU-BOWL-01', 1, 4200, 1400
    )`,
  );
  const books = await loadAnalytics({ range: "30d", includeDemo: false });
  assert.equal(books.kpis.orders, 1);
  assert.equal(books.kpis.netCents, 4200);
  const ranked = await loadHome();
  assert.equal(ranked.leaders.some((product: { id: string }) => product.id === "p_throw"), true);
  const purchase = await sql.query(
    "select is_demo from product_events where session_key = $1 and event = 'purchase'",
    ["live-22222222-2222-4222-8222-222222222222"],
  );
  assert.equal(purchase[0]?.is_demo, true);
  } finally {
    await vite.close();
  }
});
