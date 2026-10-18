import { iso, num } from "@/lib/format";
import { userError } from "./errors";
import { stageOf, type StageKey } from "./stages";
import { ensureSeeded } from "./seed.server";
import { withTx, type Query } from "./tx.server";

export type OrderFace = {
  number: string;
  name: string;
  createdAt: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  refundedCents: number;
  shippingMethod: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  stageKey: StageKey;
  stageLabel: string;
  stageDetail: string;
  adminLabel: string;
  carrier: string;
  tracking: string;
  items: { name: string; title: string; qty: number; unitPriceCents: number }[];
  events: { message: string; at: string }[];
};

type Proof = { email: string | null; token: string | null };

async function event(query: Query, orderId: string, message: string) {
  await query(`insert into order_events (id, order_id, message) values ($1, $2, $3)`, [
    crypto.randomUUID(),
    orderId,
    message,
  ]);
}

export async function faceFor(query: Query, orderId: string, row: Record<string, unknown>): Promise<OrderFace> {
  const items = await query<Record<string, unknown>>(
    `select product_name, variant_title, qty, unit_price_cents from order_items where order_id = $1 order by id`,
    [orderId],
  );
  const events = await query<Record<string, unknown>>(
    `select message, created_at from order_events where order_id = $1 order by created_at`,
    [orderId],
  );
  const ships = await query<Record<string, unknown>>(
    `select carrier, tracking from fulfillments where order_id = $1 order by created_at desc limit 1`,
    [orderId],
  );
  const reviews = await query<{ id: string }>(`select id from order_reviews where order_id = $1`, [orderId]);
  const services = await query<{ status: string }>(
    `select status from service_requests where order_id = $1 order by created_at desc limit 1`,
    [orderId],
  );
  const stage = stageOf({
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    fulfillmentStatus: String(row.fulfillment_status),
    reviewed: reviews.length > 0,
    serviceStatus: services[0]?.status ?? "none",
    isDemo: Boolean(row.is_demo),
  });
  return {
    number: String(row.number),
    name: String(row.customer_name),
    createdAt: iso(row.created_at),
    totalCents: num(row.total_cents),
    subtotalCents: num(row.subtotal_cents),
    shippingCents: num(row.shipping_cents),
    taxCents: num(row.tax_cents),
    refundedCents: num(row.refunded_cents),
    shippingMethod: String(row.shipping_method),
    paymentStatus: String(row.payment_status),
    fulfillmentStatus: String(row.fulfillment_status),
    stageKey: stage.key,
    stageLabel: stage.label,
    stageDetail: stage.detail,
    adminLabel: stage.admin,
    carrier: String(ships[0]?.carrier ?? ""),
    tracking: String(ships[0]?.tracking ?? ""),
    items: items.map((item) => ({
      name: String(item.product_name),
      title: String(item.variant_title),
      qty: num(item.qty),
      unitPriceCents: num(item.unit_price_cents),
    })),
    events: events.map((item) => ({ message: String(item.message), at: iso(item.created_at) })),
  };
}

async function owned(query: Query, number: string, proof: Proof) {
  const rows = await query<Record<string, unknown>>(`select * from orders where number = $1 for update`, [
    number.trim().toUpperCase(),
  ]);
  const order = rows[0];
  if (!order) throw userError("err.missingOrder");
  const tokenOk = Boolean(proof.token && proof.token === String(order.access_token));
  const emailOk = Boolean(proof.email && proof.email.toLowerCase() === String(order.email).toLowerCase());
  if (!tokenOk && !emailOk) throw userError("err.notYours");
  return order;
}

export async function viewOrder(input: {
  number: string;
  email?: string;
  token?: string;
  sessionEmail?: string | null;
}) {
  await ensureSeeded();
  return withTx(async (query) => {
    const number = input.number.trim().toUpperCase();
    const email = input.email?.trim().toLowerCase() ?? "";
    const token = input.token?.trim() ?? "";
    const sessionEmail = input.sessionEmail?.trim().toLowerCase() ?? "";
    if (!number || (!email && !token && !sessionEmail)) return null;
    const rows = await query<Record<string, unknown>>(
      `select * from orders
       where number = $1
         and (
           ($2 <> '' and access_token = $2)
           or ($3 <> '' and lower(email) = $3)
           or ($4 <> '' and lower(email) = $4)
         )
       limit 1`,
      [number, token, email, sessionEmail],
    );
    if (!rows[0]) return null;
    return faceFor(query, String(rows[0].id), rows[0]);
  });
}

export async function listMyOrders(userId: string) {
  await ensureSeeded();
  return withTx(async (query) => {
    const users = await query<{ email: string }>(`select email from "user" where id = $1`, [userId]);
    const email = users[0]?.email?.toLowerCase();
    if (email) {
      await query(`update customers set user_id = $1 where email = $2 and user_id is null`, [userId, email]);
    }
    const rows = await query<Record<string, unknown>>(
      `select o.* from orders o
       join customers c on c.id = o.customer_id
       where c.user_id = $1
       order by o.created_at desc
       limit 50`,
      [userId],
    );
    const faces: OrderFace[] = [];
    for (const row of rows) faces.push(await faceFor(query, String(row.id), row));
    return faces;
  });
}

export async function payOrder(number: string, proof: Proof) {
  await ensureSeeded();
  return withTx(async (query) => {
    const order = await owned(query, number, proof);
    if (String(order.payment_status) !== "unpaid") throw userError("err.notUnpaid");
    await query(
      `update orders set status = 'paid', payment_status = 'paid' where id = $1`,
      [order.id],
    );
    await query(
      `insert into payments (id, order_id, provider, status, amount_cents, provider_ref, idempotency_key)
       values ($1, $2, 'demonstration', 'paid', $3, $4, $5)`,
      [crypto.randomUUID(), order.id, num(order.total_cents), `demo_${order.id}`, `pay_${order.id}`],
    );
    await event(query, String(order.id), "event.paid");
    return { ok: true };
  });
}

export async function receiveOrder(number: string, proof: Proof) {
  await ensureSeeded();
  return withTx(async (query) => {
    const order = await owned(query, number, proof);
    if (String(order.fulfillment_status) !== "shipped") throw userError("err.notShipped");
    await query(
      `update orders set fulfillment_status = 'fulfilled',
         status = case when status = 'paid' then 'fulfilled' else status end
       where id = $1`,
      [order.id],
    );
    await event(query, String(order.id), "event.received");
    return { ok: true };
  });
}

export async function reviewOrder(number: string, proof: Proof, rating: number, body: string) {
  await ensureSeeded();
  return withTx(async (query) => {
    const order = await owned(query, number, proof);
    if (String(order.fulfillment_status) !== "fulfilled") throw userError("err.reviewEarly");
    const existing = await query(`select id from order_reviews where order_id = $1`, [order.id]);
    if (existing[0]) throw userError("err.reviewed");
    await query(
      `insert into order_reviews (id, order_id, rating, body) values ($1, $2, $3, $4)`,
      [crypto.randomUUID(), order.id, rating, body.trim()],
    );
    await event(query, String(order.id), `event.reviewed\n${JSON.stringify({ rating })}`);
    return { ok: true };
  });
}

export async function requestService(number: string, proof: Proof, reason: string) {
  await ensureSeeded();
  return withTx(async (query) => {
    const order = await owned(query, number, proof);
    if (String(order.payment_status) === "unpaid") throw userError("err.serviceUnpaid");
    const open = await query(
      `select id from service_requests where order_id = $1 and status = 'open'`,
      [order.id],
    );
    if (open[0]) throw userError("err.serviceOpen");
    await query(
      `insert into service_requests (id, order_id, reason, status) values ($1, $2, $3, 'open')`,
      [crypto.randomUUID(), order.id, reason.trim()],
    );
    await event(query, String(order.id), `event.service\n${JSON.stringify({ reason: reason.trim() })}`);
    return { ok: true };
  });
}
