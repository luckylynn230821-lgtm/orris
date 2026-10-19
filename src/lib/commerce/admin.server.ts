import { getSql } from "@/lib/db";
import { asJson, iso, num, slugify } from "@/lib/format";
import { loadAllProducts, loadCategories, readSettings } from "./catalog.server";
import { userError } from "./errors";
import { stageOf } from "./stages";
import { faceFor } from "./customer.server";
import { ensureSeeded } from "./seed.server";
import { withTx } from "./tx.server";
import { STAFF_CAP, can, deskPermissions, type DeskRole, type PermissionRequest } from "./access";
import { PUBLIC_CARRIERS, deliverMail, detectCarrier, trackingLink } from "./shipping";

function asRole(role: string): DeskRole {
  if (role === "owner" || role === "administrator") return "owner";
  if (role === "manager" || role === "staff") return role;
  throw userError("err.forbidden");
}

async function actor(userId: string) {
  await ensureSeeded();
  const sql = await getSql();
  const people = await sql<{ email: string; name: string }>`select email, name from "user" where id = ${userId}`;
  const email = people[0]?.email?.trim().toLowerCase() ?? null;
  const name = people[0]?.name ?? null;
  const members = await sql<{ user_id: string; role: string }>`select user_id, role from store_members`;
  if (members.length === 0) {
    try {
      await sql`insert into store_members (user_id, role, email, name) values (${userId}, 'owner', ${email}, ${name})`;
      await sql`insert into audit_logs (actor_id, action, entity, entity_id, detail) values (${userId}, 'claim_store', 'store', '1', ${JSON.stringify({ email })}::jsonb)`;
    } catch {
      const mine = await sql<{ user_id: string }>`select user_id from store_members where user_id = ${userId}`;
      if (!mine[0]) throw userError("err.forbidden");
    }
    return { role: "owner" as const, email, name };
  }
  const mine = members.find((member) => member.user_id === userId);
  if (mine) {
    const role = asRole(mine.role);
    if (mine.role !== role) {
      await sql`update store_members set role = ${role} where user_id = ${userId}`;
    }
    await sql`update store_members set email = ${email}, name = ${name} where user_id = ${userId}`;
    return { role, email, name };
  }
  if (email) {
    const invites = await sql<{ role: string }>`select role from store_invites where email = ${email}`;
    if (invites[0]) {
      const role = asRole(invites[0].role);
      if (role === "owner") throw userError("err.forbidden");
      const used = await seatCount();
      if (used >= STAFF_CAP) throw userError("err.seatsFull");
      await sql`insert into store_members (user_id, role, email, name) values (${userId}, ${role}, ${email}, ${name})`;
      await sql`delete from store_invites where email = ${email}`;
      await audit(userId, "accept_invite", "member", userId, { email, role });
      return { role, email, name };
    }
  }
  throw userError("err.notOnDesk");
}

async function seatCount() {
  const sql = await getSql();
  const rows = await sql<{ used: number }>`
    select (
      (select count(*) from store_members where role in ('manager', 'staff'))
      + (select count(*) from store_invites)
    )::int as used
  `;
  return num(rows[0]?.used);
}

async function requireDesk(userId: string, request?: PermissionRequest, connector?: "OR" | "AND") {
  const session = await actor(userId);
  if (request && !can(session.role, request, connector)) throw userError("err.forbidden");
  return session;
}

export async function assertAdminThen(userId: string) {
  await requireDesk(userId, { money: ["read"] });
}

export async function deskSession(userId: string) {
  const session = await actor(userId);
  return {
    role: session.role,
    email: session.email,
    name: session.name,
    permissions: deskPermissions(session.role),
    seats: { used: await seatCount(), cap: STAFF_CAP },
  };
}

async function audit(userId: string, action: string, entity: string, entityId: string, detail: unknown) {
  const sql = await getSql();
  await sql`insert into audit_logs (actor_id, action, entity, entity_id, detail) values (${userId}, ${action}, ${entity}, ${entityId}, ${JSON.stringify(detail)}::jsonb)`;
}

export async function adminCatalog(userId: string) {
  const session = await requireDesk(userId, { catalog: ["read"] });
  const seeCost = can(session.role, { money: ["read"] });
  const [products, categories] = await Promise.all([loadAllProducts(), loadCategories()]);
  return {
    products: products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        costCents: seeCost && "costCents" in variant ? num(variant.costCents) : null,
      })),
    })),
    categories,
  };
}

export async function adminProduct(userId: string, id: string) {
  const catalog = await adminCatalog(userId);
  return catalog.products.find((product) => product.id === id) ?? null;
}

type VariantInput = {
  id?: string;
  sku: string;
  title: string;
  option1Name?: string | null;
  option1Value?: string | null;
  option2Name?: string | null;
  option2Value?: string | null;
  priceCents: number;
  compareAtCents?: number | null;
  costCents: number;
  inventoryQty: number;
};

export async function saveProduct(
  userId: string,
  input: {
    id?: string;
    name: string;
    slug: string;
    description: string;
    story: string;
    categoryId: string;
    tags: string[];
    status: "draft" | "published" | "archived";
    seoTitle: string;
    seoDescription: string;
    variants: VariantInput[];
  },
) {
  const session = await requireDesk(userId, { catalog: ["update"] });
  const seeCost = can(session.role, { money: ["read"] });
  const name = input.name.trim();
  const slug = slugify(input.slug || name);
  if (!name || !slug) throw userError("A product needs a name.");
  if (input.variants.length === 0) throw userError("Add at least one variant.");
  const skus = new Set<string>();
  for (const variant of input.variants) {
    if (!variant.sku.trim()) throw userError("Every variant needs a SKU.");
    if (skus.has(variant.sku.trim())) throw userError(`SKU ${variant.sku} is repeated.`);
    skus.add(variant.sku.trim());
    if (variant.priceCents < 0 || variant.costCents < 0 || variant.inventoryQty < 0) {
      throw userError("Price, cost and stock cannot be negative.");
    }
  }

  const id = await withTx(async (query) => {
    const slugOwner = await query<{ id: string }>("select id from products where slug = $1", [slug]);
    if (slugOwner[0] && slugOwner[0].id !== input.id) throw userError("That slug is already in use.");
    let productId = input.id;
    if (!productId) {
      productId = crypto.randomUUID();
      await query(
        `insert into products (id, name, slug, description, story, category_id, status, tags, seo_title, seo_description, published_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10, case when $7 = 'published' then now() else null end)`,
        [productId, name, slug, input.description.trim(), input.story.trim(), input.categoryId, input.status, JSON.stringify(input.tags), input.seoTitle.trim(), input.seoDescription.trim()],
      );
    } else {
      await query(
        `update products set name = $2, slug = $3, description = $4, story = $5, category_id = $6, status = $7,
           tags = $8::jsonb, seo_title = $9, seo_description = $10, updated_at = now(),
           published_at = case when published_at is null and $7 = 'published' then now() else published_at end
         where id = $1`,
        [productId, name, slug, input.description.trim(), input.story.trim(), input.categoryId, input.status, JSON.stringify(input.tags), input.seoTitle.trim(), input.seoDescription.trim()],
      );
    }
    const existing = await query<{ id: string; inventory_qty: number; sku: string; cost_cents: number }>(
      "select id, inventory_qty, sku, cost_cents from product_variants where product_id = $1",
      [productId],
    );
    const keep = new Set<string>();
    for (const [index, variant] of input.variants.entries()) {
      const skuOwner = await query<{ id: string }>("select id from product_variants where sku = $1", [variant.sku.trim()]);
      if (skuOwner[0] && skuOwner[0].id !== variant.id) throw userError(`SKU ${variant.sku} belongs to another variant.`);
      if (variant.id && existing.some((row) => row.id === variant.id)) {
        keep.add(variant.id);
        const previous = existing.find((row) => row.id === variant.id)!;
        const costCents = seeCost ? variant.costCents : num(previous.cost_cents);
        await query(
          `update product_variants set sku = $2, title = $3, option1_name = $4, option1_value = $5,
             option2_name = $6, option2_value = $7, price_cents = $8, compare_at_cents = $9, cost_cents = $10,
             inventory_qty = $11, position = $12
           where id = $1 and product_id = $13`,
          [
            variant.id,
            variant.sku.trim(),
            variant.title.trim() || "Default",
            variant.option1Name || null,
            variant.option1Value || null,
            variant.option2Name || null,
            variant.option2Value || null,
            variant.priceCents,
            variant.compareAtCents ?? null,
            costCents,
            variant.inventoryQty,
            index,
            productId,
          ],
        );
        const delta = variant.inventoryQty - num(previous.inventory_qty);
        if (delta !== 0) {
          await query(
            `insert into inventory_movements (id, variant_id, qty_delta, reason, note) values ($1, $2, $3, 'adjustment', 'Edited on the product form')`,
            [crypto.randomUUID(), variant.id, delta],
          );
        }
      } else {
        const variantId = crypto.randomUUID();
        keep.add(variantId);
        await query(
          `insert into product_variants (
            id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
            price_cents, compare_at_cents, cost_cents, inventory_qty, position
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            variantId,
            productId,
            variant.sku.trim(),
            variant.title.trim() || "Default",
            variant.option1Name || null,
            variant.option1Value || null,
            variant.option2Name || null,
            variant.option2Value || null,
            variant.priceCents,
            variant.compareAtCents ?? null,
            seeCost ? variant.costCents : 0,
            variant.inventoryQty,
            index,
          ],
        );
        await query(
          `insert into inventory_movements (id, variant_id, qty_delta, reason, note) values ($1,$2,$3,'opening','New variant')`,
          [crypto.randomUUID(), variantId, variant.inventoryQty],
        );
      }
    }
    for (const row of existing) {
      if (keep.has(row.id)) continue;
      const used = await query<{ n: number }>("select count(*)::int as n from order_items where variant_id = $1", [row.id]);
      if (num(used[0]?.n) > 0) throw userError(`SKU ${row.sku} is on past orders and cannot be deleted.`);
      await query("delete from inventory_movements where variant_id = $1", [row.id]);
      await query("delete from product_variants where id = $1", [row.id]);
    }
    return productId!;
  });
  await audit(userId, "save_product", "product", id, { name, status: input.status });
  return { id };
}

export async function bulkProducts(
  userId: string,
  input: { ids: string[]; action: "publish" | "draft" | "archive" | "category" | "price"; categoryId?: string; percent?: number },
) {
  await requireDesk(userId, { catalog: ["update"] });
  if (input.ids.length === 0) throw userError("Select at least one product.");
  const ids = JSON.stringify(input.ids);
  await withTx(async (query) => {
    if (input.action === "publish" || input.action === "draft" || input.action === "archive") {
      const status = input.action === "publish" ? "published" : input.action === "draft" ? "draft" : "archived";
      await query(
        `update products set status = $2, updated_at = now(),
           published_at = case when $2 = 'published' and published_at is null then now() else published_at end
         where id in (select jsonb_array_elements_text($1::jsonb))`,
        [ids, status],
      );
    } else if (input.action === "category") {
      if (!input.categoryId) throw userError("Choose a category.");
      await query(
        `update products set category_id = $2, updated_at = now()
         where id in (select jsonb_array_elements_text($1::jsonb))`,
        [ids, input.categoryId],
      );
    } else if (input.action === "price") {
      const percent = input.percent ?? 0;
      if (percent < -80 || percent > 200 || percent === 0) throw userError("Use a price change between -80% and 200%, other than zero.");
      await query(
        `update product_variants set price_cents = greatest(0, round(price_cents * (1 + ($2::numeric / 100))))::int
         where product_id in (select jsonb_array_elements_text($1::jsonb))`,
        [ids, percent],
      );
    }
  });
  await audit(userId, "bulk_products", "product", input.ids.join(","), input);
  return { ok: true };
}

export async function saveImage(
  userId: string,
  input: { productId: string; dataUrl?: string; url?: string; alt: string },
) {
  await requireDesk(userId, { catalog: ["update"] });
  let url = input.url?.trim() ?? "";
  if (input.dataUrl) {
    const match = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.exec(input.dataUrl);
    if (!match) throw userError("Use a JPEG, PNG or WebP image.");
    if (input.dataUrl.length > 1_200_000) throw userError("Images must be under about 900KB.");
    url = input.dataUrl;
  }
  if (!url.startsWith("/catalog/") && !url.startsWith("data:image/")) {
    throw userError("Use an uploaded image or an existing catalog image.");
  }
  const sql = await getSql();
  const pos = await sql<{ n: number }>`select coalesce(max(position), -1)::int as n from product_images where product_id = ${input.productId}`;
  const id = crypto.randomUUID();
  const position = num(pos[0]?.n) + 1;
  await sql`insert into product_images (id, product_id, url, alt, position, is_cover) values (${id}, ${input.productId}, ${url}, ${input.alt.trim()}, ${position}, ${position === 0})`;
  return { id };
}

export async function updateImage(userId: string, input: { id: string; alt?: string; cover?: boolean; delete?: boolean }) {
  await requireDesk(userId, { catalog: ["update"] });
  const sql = await getSql();
  if (input.delete) {
    await sql`delete from product_images where id = ${input.id}`;
    return { ok: true };
  }
  if (input.cover) {
    const rows = await sql<{ product_id: string }>`select product_id from product_images where id = ${input.id}`;
    const productId = rows[0]?.product_id;
    if (productId) {
      await sql`update product_images set is_cover = false where product_id = ${productId}`;
      await sql`update product_images set is_cover = true where id = ${input.id}`;
    }
  }
  if (typeof input.alt === "string") {
    await sql`update product_images set alt = ${input.alt} where id = ${input.id}`;
  }
  return { ok: true };
}

export async function adjustStock(userId: string, input: { variantId: string; delta: number; note: string }) {
  await requireDesk(userId, { inventory: ["adjust"] });
  if (!Number.isInteger(input.delta) || input.delta === 0) throw userError("Enter a whole number of units, other than zero.");
  await withTx(async (query) => {
    const rows = await query<{ inventory_qty: number }>(
      `update product_variants set inventory_qty = inventory_qty + $1
       where id = $2 and inventory_qty + $1 >= 0
       returning inventory_qty`,
      [input.delta, input.variantId],
    );
    if (!rows[0]) throw userError("That adjustment would take stock below zero.");
    await query(
      `insert into inventory_movements (id, variant_id, qty_delta, reason, note) values ($1, $2, $3, 'adjustment', $4)`,
      [crypto.randomUUID(), input.variantId, input.delta, input.note.trim() || "Manual adjustment"],
    );
  });
  await audit(userId, "adjust_stock", "variant", input.variantId, { delta: input.delta });
  return { ok: true };
}

export async function listInventory(userId: string) {
  const session = await requireDesk(userId, { inventory: ["read"] });
  const seeCost = can(session.role, { money: ["read"] });
  const canAdjust = can(session.role, { inventory: ["adjust"] });
  const settings = await readSettings();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    sku: string;
    title: string;
    inventory_qty: number;
    cost_cents: number;
    product_name: string;
    status: string;
  }>`
    select v.id, v.sku, v.title, v.inventory_qty, v.cost_cents, p.name as product_name, p.status
    from product_variants v join products p on p.id = v.product_id
    order by v.inventory_qty asc, p.name
  `;
  const movements = await sql<Record<string, unknown>>`
    select m.created_at, m.qty_delta, m.reason, m.note, m.reference, v.sku, p.name as product_name
    from inventory_movements m
    join product_variants v on v.id = m.variant_id
    join products p on p.id = v.product_id
    order by m.created_at desc
    limit 40
  `;
  const variants = rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    title: row.title,
    qty: num(row.inventory_qty),
    costCents: seeCost ? num(row.cost_cents) : null,
    valueCents: seeCost ? num(row.inventory_qty) * num(row.cost_cents) : null,
    productName: row.product_name,
    status: row.status,
    low: num(row.inventory_qty) > 0 && num(row.inventory_qty) <= settings.lowStock,
    out: num(row.inventory_qty) === 0,
  }));
  return {
    variants,
    movements: movements.map((row) => ({
      at: iso(row.created_at),
      delta: num(row.qty_delta),
      reason: String(row.reason),
      note: String(row.note ?? ""),
      reference: String(row.reference ?? ""),
      sku: String(row.sku),
      productName: String(row.product_name),
    })),
    summary: {
      units: variants.reduce((sum, row) => sum + row.qty, 0),
      valueCents: seeCost ? variants.reduce((sum, row) => sum + (row.valueCents ?? 0), 0) : null,
      low: variants.filter((row) => row.low).length,
      out: variants.filter((row) => row.out).length,
    },
    lowStockThreshold: settings.lowStock,
    canSeeCost: seeCost,
    canAdjust,
  };
}

export async function listOrders(userId: string, q: string) {
  await requireDesk(userId, { order: ["read"] });
  const sql = await getSql();
  const query = `%${q.trim().toLowerCase()}%`;
  const rows = await sql<Record<string, unknown>>`
    select id, number, email, customer_name, status, payment_status, fulfillment_status,
           total_cents, refunded_cents, currency, is_demo, created_at,
           exists(select 1 from order_reviews r where r.order_id = orders.id) as reviewed,
           exists(select 1 from order_events e where e.order_id = orders.id and e.message like 'event.accepted%') as accepted,
           coalesce((select s.status from service_requests s where s.order_id = orders.id order by s.created_at desc limit 1), 'none') as service_status
    from orders
    where ${q.trim()} = '' or lower(number) like ${query} or lower(email) like ${query} or lower(customer_name) like ${query}
    order by created_at desc
    limit 200
  `;
  return rows.map((row) => ({
    id: String(row.id),
    number: String(row.number),
    email: String(row.email),
    name: String(row.customer_name),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    fulfillmentStatus: String(row.fulfillment_status),
    totalCents: num(row.total_cents),
    refundedCents: num(row.refunded_cents),
    currency: String(row.currency),
    isDemo: Boolean(row.is_demo),
    accepted: Boolean(row.accepted),
    createdAt: iso(row.created_at),
    ...(() => {
      const stage = stageOf({
        status: String(row.status),
        paymentStatus: String(row.payment_status),
        fulfillmentStatus: String(row.fulfillment_status),
        reviewed: Boolean(row.reviewed),
        serviceStatus: String(row.service_status ?? "none"),
        isDemo: Boolean(row.is_demo),
      });
      return { stageKey: stage.key, stageLabel: stage.label, adminLabel: stage.admin };
    })(),
  }));
}

export async function orderDetail(userId: string, id: string) {
  const session = await requireDesk(userId, { order: ["read"] });
  const seeCost = can(session.role, { money: ["read"] });
  const sql = await getSql();
  const orders = await sql<Record<string, unknown>>`select * from orders where id = ${id} or number = ${id} limit 1`;
  const order = orders[0];
  if (!order) return null;
  const items = await sql<Record<string, unknown>>`select * from order_items where order_id = ${String(order.id)}`;
  const refunds = await sql<Record<string, unknown>>`select * from refunds where order_id = ${String(order.id)} order by created_at`;
  const fulfillments = await sql<Record<string, unknown>>`select * from fulfillments where order_id = ${String(order.id)} order by created_at`;
  const story = await faceFor((text, params) => sql.query(text, params ?? []), String(order.id), order);
  return {
    id: String(order.id),
    number: String(order.number),
    email: String(order.email),
    name: String(order.customer_name),
    status: String(order.status),
    paymentStatus: String(order.payment_status),
    fulfillmentStatus: String(order.fulfillment_status),
    subtotalCents: num(order.subtotal_cents),
    discountCents: num(order.discount_cents),
    shippingCents: num(order.shipping_cents),
    taxCents: num(order.tax_cents),
    totalCents: num(order.total_cents),
    refundedCents: num(order.refunded_cents),
    currency: String(order.currency),
    shippingMethod: String(order.shipping_method),
    address: asJson(order.shipping_address, {}),
    isDemo: Boolean(order.is_demo),
    createdAt: iso(order.created_at),
    stageKey: story.stageKey,
    stageLabel: story.stageLabel,
    stageDetail: story.stageDetail,
    adminLabel: story.adminLabel,
    carrier: story.carrier,
    tracking: story.tracking,
    events: story.events,
    items: items.map((item) => ({
      id: String(item.id),
      name: String(item.product_name),
      title: String(item.variant_title),
      sku: String(item.sku),
      qty: num(item.qty),
      refundedQty: num(item.refunded_qty),
      unitPriceCents: num(item.unit_price_cents),
      unitCostCents: seeCost ? num(item.unit_cost_cents) : null,
      variantId: item.variant_id ? String(item.variant_id) : null,
    })),
    refunds: refunds.map((refund) => ({
      amountCents: num(refund.amount_cents),
      reason: String(refund.reason ?? ""),
      restocked: Boolean(refund.restocked),
      at: iso(refund.created_at),
    })),
    fulfillments: fulfillments.map((row) => ({
      carrier: String(row.carrier ?? ""),
      tracking: String(row.tracking ?? ""),
      trackingUrl: String(row.tracking_url ?? ""),
      logisticsCostCents: seeCost ? num(row.logistics_cost_cents) : null,
      status: String(row.status),
      at: iso(row.created_at),
    })),
  };
}

export async function fulfillOrder(userId: string, input: { id: string; carrier: string; tracking: string; carrierId?: string }) {
  await requireDesk(userId, { order: ["fulfill"] });
  const sql = await getSql();
  const chosen = input.carrierId
    ? (await sql<{ name: string; tracking_url: string; cost_cents: number }>`
        select name, tracking_url, cost_cents from carriers where id = ${input.carrierId} and active = true
      `)[0]
    : undefined;
  const tracking = input.tracking.trim();
  const detected = tracking ? detectCarrier(tracking) : null;
  const carrier = chosen?.name || input.carrier.trim() || detected?.carrier || "Studio dispatch";
  const fromBook = chosen?.tracking_url?.includes("{{tracking}}")
    ? trackingLink(chosen.tracking_url, tracking)
    : "";
  const url = fromBook || detected?.url || "";
  const cost = chosen ? num(chosen.cost_cents) : 0;
  let email = "";
  await withTx(async (query) => {
    const rows = await query<{ payment_status: string; fulfillment_status: string; email: string }>(
      "select payment_status, fulfillment_status, email from orders where id = $1 for update",
      [input.id],
    );
    if (!rows[0]) throw userError("Order not found.");
    if (!["paid", "partially_refunded"].includes(rows[0].payment_status)) throw userError("err.payFirst");
    if (rows[0].fulfillment_status === "shipped" || rows[0].fulfillment_status === "fulfilled") {
      throw userError("err.alreadyShipped");
    }
    email = rows[0].email;
    await query(`update orders set fulfillment_status = 'shipped' where id = $1`, [input.id]);
    await query(
      `insert into fulfillments (id, order_id, carrier, tracking, status, carrier_id, tracking_url, logistics_cost_cents)
       values ($1, $2, $3, $4, 'shipped', $5, $6, $7)`,
      [crypto.randomUUID(), input.id, carrier, tracking, input.carrierId ?? null, url, cost],
    );
    await query(`insert into order_events (id, order_id, message) values ($1, $2, $3)`, [
      crypto.randomUUID(),
      input.id,
      `event.shipped\n${JSON.stringify({ carrier, tracking: tracking || "—", url: url || "—" })}`,
    ]);
  });
  await recordMail("order_shipped", email, input.id, "event.shipped", { carrier, tracking: tracking || "—", url: url || "—" });
  await audit(userId, "fulfill", "order", input.id, { tracking, carrierId: input.carrierId ?? null });
  return { ok: true, mail: deliverMail() };
}

async function recordMail(kind: string, email: string, orderId: string | null, subject: string, body: unknown) {
  const sql = await getSql();
  await sql`
    insert into outbound_messages (id, kind, order_id, email, subject, body, status)
    values (${crypto.randomUUID()}, ${kind}, ${orderId}, ${email}, ${subject}, ${JSON.stringify(body)}, 'recorded')
  `;
}

export async function refundOrder(userId: string, input: { id: string; amountCents: number; reason: string; restock: boolean }) {
  await requireDesk(userId, { order: ["refund"] });
  if (input.amountCents <= 0) throw userError("Enter a refund amount.");
  await withTx(async (query) => {
    const orders = await query<{ total_cents: number; refunded_cents: number; number: string }>(
      "select total_cents, refunded_cents, number from orders where id = $1 for update",
      [input.id],
    );
    const order = orders[0];
    if (!order) throw userError("Order not found.");
    const remaining = num(order.total_cents) - num(order.refunded_cents);
    if (input.amountCents > remaining) throw userError("That refund is larger than the amount still paid.");
    const full = input.amountCents === remaining;
    await query(
      `insert into refunds (id, order_id, amount_cents, reason, restocked) values ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), input.id, input.amountCents, input.reason.trim(), input.restock && full],
    );
    const refunded = num(order.refunded_cents) + input.amountCents;
    const payment = refunded >= num(order.total_cents) ? "refunded" : "partially_refunded";
    await query(
      `update orders set refunded_cents = $2, payment_status = $3,
         status = case when $3 = 'refunded' then 'refunded' else 'partially_refunded' end
       where id = $1`,
      [input.id, refunded, payment],
    );
    await query(`insert into order_events (id, order_id, message) values ($1, $2, $3)`, [
      crypto.randomUUID(),
      input.id,
      `event.refunded\n${JSON.stringify({ amount: (input.amountCents / 100).toFixed(2) })}`,
    ]);
    if (input.restock && full) {
      const items = await query<{ variant_id: string | null; qty: number; refunded_qty: number }>(
        "select variant_id, qty, refunded_qty from order_items where order_id = $1",
        [input.id],
      );
      for (const item of items) {
        const restockQty = num(item.qty) - num(item.refunded_qty);
        await query("update order_items set refunded_qty = qty where order_id = $1", [input.id]);
        if (item.variant_id && restockQty > 0) {
          await query("update product_variants set inventory_qty = inventory_qty + $1 where id = $2", [
            restockQty,
            item.variant_id,
          ]);
          await query(
            `insert into inventory_movements (id, variant_id, qty_delta, reason, reference, note)
             values ($1, $2, $3, 'refund', $4, $5)`,
            [crypto.randomUUID(), item.variant_id, restockQty, order.number, input.reason.trim()],
          );
        }
      }
    }
  });
  await audit(userId, "refund", "order", input.id, { amountCents: input.amountCents, restock: input.restock });
  return { ok: true };
}

export async function cancelOrder(userId: string, id: string) {
  await requireDesk(userId, { order: ["refund"] });
  const detail = await orderDetail(userId, id);
  if (!detail) throw userError("Order not found.");
  const remaining = detail.totalCents - detail.refundedCents;
  if (remaining > 0 && ["paid", "partially_refunded"].includes(detail.paymentStatus)) {
    await refundOrder(userId, { id: detail.id, amountCents: remaining, reason: "Cancelled", restock: true });
  } else if (detail.paymentStatus === "unpaid") {
    await withTx(async (query) => {
      const items = await query<{ variant_id: string | null; qty: number }>(
        "select variant_id, qty from order_items where order_id = $1",
        [detail.id],
      );
      for (const item of items) {
        if (!item.variant_id) continue;
        await query("update product_variants set inventory_qty = inventory_qty + $1 where id = $2", [
          num(item.qty),
          item.variant_id,
        ]);
        await query(
          `insert into inventory_movements (id, variant_id, qty_delta, reason, reference, note)
           values ($1, $2, $3, 'cancel', $4, 'Unpaid order released')`,
          [crypto.randomUUID(), item.variant_id, num(item.qty), detail.number],
        );
      }
      await query(
        `update orders set status = 'cancelled', fulfillment_status = 'cancelled', payment_status = 'failed' where id = $1`,
        [detail.id],
      );
      await query(`insert into order_events (id, order_id, message) values ($1, $2, $3)`, [
        crypto.randomUUID(),
        detail.id,
        "event.cancelledUnpaid",
      ]);
    });
  }
  const sql = await getSql();
  await sql`update orders set status = 'cancelled', fulfillment_status = 'cancelled' where id = ${detail.id}`;
  await audit(userId, "cancel", "order", detail.id, {});
  return { ok: true };
}

export async function resolveService(userId: string, input: { id: string; action: "refund" | "reject"; restock: boolean }) {
  await requireDesk(userId, { order: ["refund"] });
  const detail = await orderDetail(userId, input.id);
  if (!detail) throw userError("Order not found.");
  const sql = await getSql();
  const open = await sql<{ id: string; reason: string }>`
    select id, reason from service_requests where order_id = ${detail.id} and status = 'open' order by created_at desc limit 1
  `;
  if (!open[0]) throw userError("err.noService");
  if (input.action === "reject") {
    await sql`update service_requests set status = 'rejected' where id = ${open[0].id}`;
    await sql`insert into order_events (id, order_id, message) values (${crypto.randomUUID()}, ${detail.id}, ${"event.rejected"})`;
    return { ok: true };
  }
  const remaining = detail.totalCents - detail.refundedCents;
  if (remaining <= 0) throw userError("err.nothingToRefund");
  await refundOrder(userId, { id: detail.id, amountCents: remaining, reason: open[0].reason, restock: input.restock });
  await sql`update service_requests set status = 'approved' where id = ${open[0].id}`;
  return { ok: true };
}

export async function listCustomers(userId: string) {
  await requireDesk(userId, { customer: ["read"] });
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select c.id, c.email, c.name, c.is_demo, c.created_at,
      count(o.id) filter (where o.payment_status in ('paid','partially_refunded','refunded'))::int as orders,
      coalesce(sum(o.total_cents - o.refunded_cents) filter (where o.payment_status in ('paid','partially_refunded','refunded')), 0)::int as spent,
      max(o.created_at) as last_order
    from customers c
    left join orders o on o.customer_id = c.id
    group by c.id
    order by spent desc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    isDemo: Boolean(row.is_demo),
    orders: num(row.orders),
    spentCents: num(row.spent),
    lastOrder: row.last_order ? iso(row.last_order) : null,
  }));
}

export async function loadSettings(userId: string) {
  const session = await requireDesk(userId, { settings: ["update"] });
  const seeCost = can(session.role, { money: ["read"] });
  const settings = await readSettings();
  const sql = await getSql();
  const members = await sql<{ user_id: string; email: string | null; name: string | null; created_at: unknown }>`
    select user_id, email, name, created_at from store_members order by created_at
  `;
  const audits = await sql<Record<string, unknown>>`
    select created_at, action, entity, entity_id, actor_id from audit_logs order by created_at desc limit 30
  `;
  const subscribers = await sql<{ n: number }>`select count(*)::int as n from newsletter_subscribers`;
  return {
    ...settings,
    highMargin: seeCost ? settings.highMargin : null,
    lowMargin: seeCost ? settings.lowMargin : null,
    vatRate: seeCost ? settings.vatRate : null,
    importTaxRate: seeCost ? settings.importTaxRate : null,
    members: members.map((member) => ({
      userId: member.user_id,
      email: member.email,
      name: member.name,
      since: iso(member.created_at),
    })),
    audit: audits.map((row) => ({
      at: iso(row.created_at),
      action: String(row.action),
      entity: String(row.entity),
      entityId: String(row.entity_id ?? ""),
    })),
    subscribers: num(subscribers[0]?.n),
  };
}

export async function saveSettings(
  userId: string,
  input: {
    brandName: string;
    tagline: string;
    announcement: string;
    supportEmail: string;
    shippingFlatCents: number;
    expressShippingCents: number;
    freeShippingThresholdCents: number;
    lowStock: number;
    slowCoverDays: number;
    replenishCoverDays: number;
    minViews: number;
    highMarginBps: number;
    lowMarginBps: number;
    lowConversionBps: number;
    judgementDays: number;
    vatBps: number;
    importTaxBps: number;
    hero: Record<string, string>;
    benefits: { title: string; body: string }[];
    editorial: Record<string, string>;
    footerBlurb: string;
    socials: { label: string; href: string }[];
  },
) {
  const session = await requireDesk(userId, { settings: ["update"] });
  const sql = await getSql();
  const current = await readSettings();
  const seeCost = can(session.role, { money: ["read"] });
  const highMarginBps = seeCost ? input.highMarginBps : Math.round(current.highMargin * 10_000);
  const lowMarginBps = seeCost ? input.lowMarginBps : Math.round(current.lowMargin * 10_000);
  const vatBps = seeCost ? input.vatBps : Math.round(current.vatRate * 10_000);
  const importTaxBps = seeCost ? input.importTaxBps : Math.round(current.importTaxRate * 10_000);
  await sql`
    update store_settings set
      brand_name = ${input.brandName.trim()},
      tagline = ${input.tagline.trim()},
      announcement = ${input.announcement.trim()},
      support_email = ${input.supportEmail.trim()},
      shipping_flat_cents = ${input.shippingFlatCents},
      express_shipping_cents = ${input.expressShippingCents},
      free_shipping_threshold_cents = ${input.freeShippingThresholdCents},
      low_stock_threshold = ${input.lowStock},
      slow_cover_days = ${input.slowCoverDays},
      replenish_cover_days = ${input.replenishCoverDays},
      min_views = ${input.minViews},
      high_margin_bps = ${highMarginBps},
      low_margin_bps = ${lowMarginBps},
      vat_bps = ${vatBps},
      import_tax_bps = ${importTaxBps},
      low_conversion_bps = ${input.lowConversionBps},
      judgement_days = ${input.judgementDays},
      hero = ${JSON.stringify(input.hero)}::jsonb,
      benefits = ${JSON.stringify(input.benefits)}::jsonb,
      editorial = ${JSON.stringify(input.editorial)}::jsonb,
      footer_blurb = ${input.footerBlurb.trim()},
      socials = ${JSON.stringify(input.socials)}::jsonb,
      updated_at = now()
    where id = 1
  `;
  await audit(userId, "save_settings", "store", "1", { brand: input.brandName });
  return { ok: true };
}

export async function importCsv(userId: string, csv: string) {
  await requireDesk(userId, { catalog: ["update"] });
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw userError("The CSV needs a header and one row.");
  const header = lines[0]!.split(",").map((cell) => cell.trim().toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const required = ["name", "sku", "price", "cost", "inventory"];
  for (const column of required) {
    if (index(column) < 0) throw userError(`Missing column: ${column}`);
  }
  const categories = await loadCategories();
  let created = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((cell) => cell.trim());
    const name = cells[index("name")] ?? "";
    const sku = cells[index("sku")] ?? "";
    const price = Math.round(Number(cells[index("price")] ?? "0") * 100);
    const cost = Math.round(Number(cells[index("cost")] ?? "0") * 100);
    const inventory = Math.round(Number(cells[index("inventory")] ?? "0"));
    const categorySlug = cells[index("category")] || categories[0]?.slug || "objects";
    const category = categories.find((item) => item.slug === categorySlug) ?? categories[0];
    if (!name || !sku || !category) continue;
    await saveProduct(userId, {
      name,
      slug: slugify(name),
      description: cells[index("description")] || name,
      story: "",
      categoryId: category.id,
      tags: [],
      status: "draft",
      seoTitle: name,
      seoDescription: name,
      variants: [
        {
          sku,
          title: "Default",
          priceCents: Number.isFinite(price) ? price : 0,
          costCents: Number.isFinite(cost) ? cost : 0,
          inventoryQty: Number.isFinite(inventory) ? Math.max(0, inventory) : 0,
        },
      ],
    });
    created += 1;
  }
  return { created };
}

export async function listTeam(userId: string) {
  await requireDesk(userId, { team: ["manage"] });
  const sql = await getSql();
  const members = await sql<{ user_id: string; role: string; email: string | null; name: string | null; created_at: unknown }>`
    select user_id, role, email, name, created_at from store_members order by created_at
  `;
  const invites = await sql<{ email: string; role: string; created_at: unknown }>`
    select email, role, created_at from store_invites order by created_at
  `;
  return {
    members: members.map((member) => ({
      userId: member.user_id,
      email: member.email,
      name: member.name,
      role: asRole(member.role),
      since: iso(member.created_at),
    })),
    invites: invites.map((invite) => ({
      email: invite.email,
      role: asRole(invite.role),
      since: iso(invite.created_at),
    })),
    seats: { used: await seatCount(), cap: STAFF_CAP },
  };
}

export async function grantSeat(userId: string, input: { email: string; role: "manager" | "staff" }) {
  await requireDesk(userId, { team: ["manage"] });
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || email.length > 160) throw userError("err.email");
  const sql = await getSql();
  const owners = await sql<{ email: string | null }>`select email from store_members where role = 'owner'`;
  if (owners.some((owner) => owner.email?.toLowerCase() === email)) throw userError("err.ownerFixed");
  const existing = await sql<{ user_id: string; role: string }>`
    select user_id, role from store_members where lower(email) = ${email}
  `;
  const invited = await sql<{ email: string }>`select email from store_invites where email = ${email}`;
  if (!existing[0] && !invited[0] && (await seatCount()) >= STAFF_CAP) throw userError("err.seatsFull");
  if (existing[0]) {
    if (existing[0].role === "owner") throw userError("err.ownerFixed");
    await sql`update store_members set role = ${input.role} where user_id = ${existing[0].user_id}`;
  } else {
    const users = await sql<{ id: string; name: string | null }>`select id, name from "user" where lower(email) = ${email}`;
    if (users[0]) {
      await sql`
        insert into store_members (user_id, role, email, name)
        values (${users[0].id}, ${input.role}, ${email}, ${users[0].name})
        on conflict (user_id) do update set role = ${input.role}, email = ${email}
      `;
      await sql`delete from store_invites where email = ${email}`;
    } else {
      await sql`
        insert into store_invites (email, role) values (${email}, ${input.role})
        on conflict (email) do update set role = ${input.role}
      `;
    }
  }
  await audit(userId, "grant_seat", "member", email, { email, role: input.role });
  return listTeam(userId);
}

export async function revokeSeat(userId: string, emailRaw: string) {
  await requireDesk(userId, { team: ["manage"] });
  const email = emailRaw.trim().toLowerCase();
  const sql = await getSql();
  await sql`delete from store_members where role <> 'owner' and lower(email) = ${email}`;
  await sql`delete from store_invites where email = ${email}`;
  await audit(userId, "revoke_seat", "member", email, { email });
  return listTeam(userId);
}

async function canFulfillOrEdit(userId: string) {
  const session = await actor(userId);
  if (!can(session.role, { order: ["fulfill"] }) && !can(session.role, { settings: ["update"] })) {
    throw userError("err.forbidden");
  }
  return session;
}

export async function listCarriers(userId: string) {
  const session = await canFulfillOrEdit(userId);
  const seeCost = can(session.role, { money: ["read"] });
  const sql = await getSql();
  const count = await sql<{ n: number }>`select count(*)::int as n from carriers`;
  if (num(count[0]?.n) === 0) {
    for (const carrier of PUBLIC_CARRIERS) {
      await sql`
        insert into carriers (id, name, tracking_url, cost_cents)
        values (${crypto.randomUUID()}, ${carrier.name}, ${carrier.trackingUrl}, 0)
      `;
    }
  }
  const rows = await sql<{ id: string; name: string; tracking_url: string; cost_cents: number; active: boolean }>`
    select id, name, tracking_url, cost_cents, active from carriers order by created_at
  `;
  return {
    connected: "public" as const,
    carriers: rows.map((row) => ({
      id: row.id,
      name: row.name,
      trackingUrl: row.tracking_url,
      costCents: seeCost ? num(row.cost_cents) : null,
      active: row.active,
    })),
  };
}

export async function saveCarrier(
  userId: string,
  input: { id?: string; name: string; trackingUrl: string; costCents: number },
) {
  const session = await requireDesk(userId, { settings: ["update"] });
  const seeCost = can(session.role, { money: ["read"] });
  const sql = await getSql();
  const name = input.name.trim();
  const trackingUrl = input.trackingUrl.trim();
  if (input.id) {
    if (seeCost) {
      await sql`update carriers set name = ${name}, tracking_url = ${trackingUrl}, cost_cents = ${input.costCents} where id = ${input.id}`;
    } else {
      await sql`update carriers set name = ${name}, tracking_url = ${trackingUrl} where id = ${input.id}`;
    }
  } else {
    await sql`
      insert into carriers (id, name, tracking_url, cost_cents)
      values (${crypto.randomUUID()}, ${name}, ${trackingUrl}, ${seeCost ? input.costCents : 0})
    `;
  }
  await audit(userId, "save_carrier", "carrier", input.id ?? name, { name });
  return listCarriers(userId);
}

export async function acceptOrder(userId: string, id: string) {
  await requireDesk(userId, { order: ["fulfill"] });
  const sql = await getSql();
  const rows = await sql<{ email: string; payment_status: string; fulfillment_status: string }>`
    select email, payment_status, fulfillment_status from orders where id = ${id}
  `;
  const order = rows[0];
  if (!order) throw userError("err.orderMissing");
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") throw userError("err.payFirst");
  if (order.fulfillment_status === "shipped" || order.fulfillment_status === "fulfilled") throw userError("err.alreadyShipped");
  const prior = await sql<{ id: string }>`
    select id from order_events where order_id = ${id} and message like 'event.accepted%' limit 1
  `;
  if (prior[0]) return { ok: true, already: true as const, mail: deliverMail() };
  await sql`insert into order_events (id, order_id, message) values (${crypto.randomUUID()}, ${id}, ${"event.accepted"})`;
  await recordMail("order_accepted", order.email, id, "event.accepted", {});
  await audit(userId, "accept_order", "order", id, {});
  return { ok: true, mail: deliverMail() };
}

export async function acceptOrders(userId: string, ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 50);
  let count = 0;
  for (const id of unique) {
    const result = await acceptOrder(userId, id);
    if (!("already" in result && result.already)) count += 1;
  }
  return { count };
}

export async function broadcastCustomers(userId: string, input: { subject: string; body: string }) {
  await requireDesk(userId, { customer: ["read"] });
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 2 || body.length < 2) throw userError("err.email");
  const sql = await getSql();
  const people = await sql<{ email: string }>`
    select distinct email from customers where is_demo = false and email not like '%@example.com'
  `;
  for (const person of people) {
    await recordMail("broadcast", person.email, null, subject, { body });
  }
  await audit(userId, "broadcast", "customer", "all", { count: people.length });
  return { count: people.length, mail: deliverMail() };
}
