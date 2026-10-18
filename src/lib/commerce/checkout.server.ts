import { num } from "@/lib/format";
import { userError } from "./errors";
import { shippingQuote } from "./metrics";
import { ensureSeeded } from "./seed.server";
import { withTx } from "./tx.server";

export type CheckoutInput = {
  email: string;
  name: string;
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  shippingMethod: "standard" | "express";
  lines: { variantId: string; qty: number }[];
  idempotencyKey: string;
};

const recent = new Map<string, number[]>();

function allow(email: string) {
  const now = Date.now();
  const stamps = (recent.get(email) ?? []).filter((stamp) => now - stamp < 10 * 60_000);
  if (stamps.length >= 8) return false;
  stamps.push(now);
  recent.set(email, stamps);
  return true;
}

export async function placeOrder(input: CheckoutInput, userId: string | null) {
  await ensureSeeded();
  const email = input.email.trim().toLowerCase();
  if (!allow(email)) throw userError("err.rate");

  return withTx(async (query) => {
    const existing = await query<{ number: string; access_token: string }>(
      "select number, access_token from orders where idempotency_key = $1",
      [input.idempotencyKey],
    );
    if (existing[0]) {
      return { number: existing[0].number, token: existing[0].access_token, replayed: true };
    }

    const settingsRows = await query<Record<string, unknown>>(
      "select shipping_flat_cents, express_shipping_cents, free_shipping_threshold_cents, currency from store_settings where id = 1",
    );
    const settings = settingsRows[0];
    if (!settings) throw userError("err.settings");

    const ids = JSON.stringify([...new Set(input.lines.map((line) => line.variantId))]);
    const variants = await query<{
      id: string;
      sku: string;
      title: string;
      price_cents: number;
      cost_cents: number;
      inventory_qty: number;
      product_id: string;
      product_name: string;
      status: string;
    }>(
      `select v.id, v.sku, v.title, v.price_cents, v.cost_cents, v.inventory_qty,
              p.id as product_id, p.name as product_name, p.status
       from product_variants v
       join products p on p.id = v.product_id
       where v.id in (select jsonb_array_elements_text($1::jsonb))
       for update`,
      [ids],
    );
    const byId = new Map(variants.map((row) => [row.id, row]));
    const wanted = new Map<string, number>();
    for (const line of input.lines) {
      wanted.set(line.variantId, (wanted.get(line.variantId) ?? 0) + line.qty);
    }

    const priced: {
      variantId: string;
      productId: string;
      name: string;
      title: string;
      sku: string;
      qty: number;
      price: number;
      cost: number;
    }[] = [];

    for (const [variantId, qty] of wanted) {
      const row = byId.get(variantId);
      if (!row || row.status !== "published") throw userError("err.notForSale");
      if (qty > 10) throw userError("err.qtyCap");
      if (num(row.inventory_qty) < qty) {
        throw userError(`err.onlyLeft\n${JSON.stringify({ count: num(row.inventory_qty), name: row.product_name, title: row.title })}`);
      }
      priced.push({
        variantId,
        productId: row.product_id,
        name: row.product_name,
        title: row.title,
        sku: row.sku,
        qty,
        price: num(row.price_cents),
        cost: num(row.cost_cents),
      });
    }

    const subtotal = priced.reduce((sum, line) => sum + line.price * line.qty, 0);
    const shipping = shippingQuote(subtotal, input.shippingMethod, {
      flatCents: num(settings.shipping_flat_cents),
      expressCents: num(settings.express_shipping_cents),
      thresholdCents: num(settings.free_shipping_threshold_cents),
    });
    const tax = 0;
    const discount = 0;
    const total = subtotal - discount + shipping + tax;
    const address = {
      line1: input.line1.trim(),
      city: input.city.trim(),
      region: input.region.trim(),
      postal: input.postal.trim(),
      country: input.country.trim(),
    };

    const found = await query<{ id: string; user_id: string | null }>(
      "select id, user_id from customers where email = $1",
      [email],
    );
    let customerId = found[0]?.id;
    if (!customerId) {
      customerId = crypto.randomUUID();
      await query(
        "insert into customers (id, user_id, email, name, is_demo) values ($1, $2, $3, $4, false)",
        [customerId, userId, email, input.name.trim()],
      );
    } else if (userId && !found[0]?.user_id) {
      await query("update customers set user_id = $1, name = $2 where id = $3", [
        userId,
        input.name.trim(),
        customerId,
      ]);
    }

    const orderId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const seq = await query<{ n: number }>("select nextval('order_number_seq')::int as n");
    const number = `OR-${num(seq[0]?.n)}`;

    await query(
      `insert into orders (
        id, number, access_token, idempotency_key, customer_id, email, customer_name,
        status, payment_status, fulfillment_status, subtotal_cents, discount_cents,
        shipping_cents, tax_cents, total_cents, refunded_cents, currency, shipping_method,
        shipping_address, is_demo
      ) values (
        $1,$2,$3,$4,$5,$6,$7,'pending','unpaid','unfulfilled',$8,$9,$10,$11,$12,0,$13,$14,$15::jsonb,false
      )`,
      [
        orderId,
        number,
        token,
        input.idempotencyKey,
        customerId,
        email,
        input.name.trim(),
        subtotal,
        discount,
        shipping,
        tax,
        total,
        String(settings.currency ?? "USD"),
        input.shippingMethod,
        JSON.stringify(address),
      ],
    );

    for (const line of priced) {
      await query(
        `insert into order_items (
          id, order_id, product_id, variant_id, product_name, variant_title, sku, qty,
          unit_price_cents, unit_cost_cents
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          crypto.randomUUID(),
          orderId,
          line.productId,
          line.variantId,
          line.name,
          line.title,
          line.sku,
          line.qty,
          line.price,
          line.cost,
        ],
      );
      const updated = await query<{ inventory_qty: number }>(
        `update product_variants set inventory_qty = inventory_qty - $1
         where id = $2 and inventory_qty >= $1
         returning inventory_qty`,
        [line.qty, line.variantId],
      );
      if (!updated[0]) throw userError(`err.lowerQty\n${JSON.stringify({ name: line.name })}`);
      await query(
        `insert into inventory_movements (id, variant_id, qty_delta, reason, reference, note)
         values ($1, $2, $3, 'sale', $4, $5)`,
        [crypto.randomUUID(), line.variantId, -line.qty, number, "Reserved for an unpaid order"],
      );
      await query(
        `insert into product_events (product_id, event, session_key, qty, occurred_on, is_demo)
         values ($1, 'purchase', $2, $3, (now() at time zone 'utc')::date, false)
         on conflict (product_id, event, session_key, occurred_on) do nothing`,
        [line.productId, `live-${input.idempotencyKey}`, line.qty],
      );
    }

    await query(
      `insert into order_events (id, order_id, message) values ($1, $2, $3)`,
      [crypto.randomUUID(), orderId, "event.placed"],
    );

    return { number, token, replayed: false, totalCents: total };
  });
}

export async function loadMyOrders(userId: string) {
  await ensureSeeded();
  return withTx(async (query) => {
    const users = await query<{ email: string }>(`select email from "user" where id = $1`, [userId]);
    const email = users[0]?.email?.toLowerCase();
    if (email) {
      await query(
        "update customers set user_id = $1 where email = $2 and user_id is null",
        [userId, email],
      );
    }
    const rows = await query<Record<string, unknown>>(
      `select o.number, o.created_at, o.total_cents, o.payment_status, o.fulfillment_status, o.status, o.currency
       from orders o
       join customers c on c.id = o.customer_id
       where c.user_id = $1
       order by o.created_at desc
       limit 50`,
      [userId],
    );
    return rows.map((row) => ({
      number: String(row.number),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      totalCents: num(row.total_cents),
      paymentStatus: String(row.payment_status),
      fulfillmentStatus: String(row.fulfillment_status),
      status: String(row.status),
      currency: String(row.currency),
    }));
  });
}
