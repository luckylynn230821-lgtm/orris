import { mintOrderToken } from "./integrity";
import { num } from "@/lib/format";
import { SEED_CATEGORIES, SEED_PEOPLE, SEED_PRODUCTS, SEED_SETTINGS } from "./seed-data";
import type { Query } from "./tx.server";
import { withTx } from "./tx.server";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seeding: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  seeding ??= withTx(async (query) => {
    const existing = await query<{ seeded: boolean }>(
      "select seeded from store_settings where id = 1",
    );
    if (!existing[0]?.seeded) await seedAll(query);
    await upgradeStudio(query);
    await dropShipPromise(query);
  })
    .then(() => undefined)
    .catch((error) => {
      seeding = null;
      throw error;
    });
  return seeding;
}

async function seedAll(query: Query) {
  const settings = SEED_SETTINGS;
  await query(
    `insert into store_settings (
      id, brand_name, tagline, announcement, support_email, currency,
      shipping_flat_cents, express_shipping_cents, free_shipping_threshold_cents,
      low_stock_threshold, slow_cover_days, replenish_cover_days, min_views,
      high_margin_bps, low_margin_bps, low_conversion_bps, judgement_days,
      hero, benefits, editorial, footer_blurb, socials, seeded
    ) values (
      1, $1, $2, $3, $4, 'USD', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16::jsonb, $17::jsonb, $18::jsonb, $19, $20::jsonb, false
    ) on conflict (id) do nothing`,
    [
      settings.brandName,
      settings.tagline,
      settings.announcement,
      settings.supportEmail,
      settings.shippingFlatCents,
      settings.expressShippingCents,
      settings.freeShippingThresholdCents,
      settings.lowStockThreshold,
      settings.slowCoverDays,
      settings.replenishCoverDays,
      settings.minViews,
      settings.highMarginBps,
      settings.lowMarginBps,
      settings.lowConversionBps,
      settings.judgementDays,
      JSON.stringify(settings.hero),
      JSON.stringify(settings.benefits),
      JSON.stringify(settings.editorial),
      settings.footerBlurb,
      JSON.stringify(settings.socials),
    ],
  );

  for (const category of SEED_CATEGORIES) {
    await query(
      `insert into categories (id, name, slug, description, sort_order)
       values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
      [category.id, category.name, category.slug, category.description, category.sort],
    );
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const variantMeta = new Map<string, { productId: string; name: string; price: number; cost: number; title: string; sku: string }>();

  for (const product of SEED_PRODUCTS) {
    const published = new Date(todayUtc - product.publishedDaysAgo * 86_400_000).toISOString();
    await query(
      `insert into products (
        id, name, slug, description, story, category_id, status, tags,
        seo_title, seo_description, published_at, created_at
      ) values ($1,$2,$3,$4,$5,$6,'published',$7::jsonb,$8,$9,$10,$10)
      on conflict (id) do nothing`,
      [
        product.id,
        product.name,
        product.slug,
        product.description,
        product.story,
        product.categoryId,
        JSON.stringify(product.tags),
        product.seoTitle,
        product.seoDescription,
        published,
      ],
    );
    await query(
      `insert into product_images (id, product_id, url, alt, position, is_cover)
       values ($1, $2, $3, $4, 0, true) on conflict (id) do nothing`,
      [`img_${product.id}`, product.id, product.image, product.alt],
    );
    product.variants.forEach((variant) => {
      variantMeta.set(variant.id, {
        productId: product.id,
        name: product.name,
        price: variant.priceCents,
        cost: variant.costCents,
        title: variant.title,
        sku: variant.sku,
      });
    });
    for (const [index, variant] of product.variants.entries()) {
      await query(
        `insert into product_variants (
          id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
          price_cents, cost_cents, inventory_qty, position
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        on conflict (id) do nothing`,
        [
          variant.id,
          product.id,
          variant.sku,
          variant.title,
          variant.option1Name,
          variant.option1Value,
          variant.option2Name,
          variant.option2Value,
          variant.priceCents,
          variant.costCents,
          variant.inventory,
          index,
        ],
      );
      await query(
        `insert into inventory_movements (id, variant_id, qty_delta, reason, note)
         values ($1, $2, $3, 'opening', 'Opening on-hand balance for the sample shop')
         on conflict (id) do nothing`,
        [`mov_open_${variant.id}`, variant.id, variant.inventory],
      );
    }
  }

  const customerIds: string[] = [];
  for (const [index, [name, email]] of SEED_PEOPLE.entries()) {
    const id = `cus_seed_${index}`;
    customerIds.push(id);
    await query(
      `insert into customers (id, email, name, is_demo) values ($1, $2, $3, true)
       on conflict (id) do nothing`,
      [id, email, name],
    );
  }

  const rand = mulberry32(20261018);
  const pickVariant = (daysAgo: number) => {
    const pool = SEED_PRODUCTS.filter((product) => !(product.oldOnly && daysAgo < 40));
    const weights = pool.map((product) => product.weight * (daysAgo <= 30 ? product.recentBoost : 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = rand() * total;
    let product = pool[0]!;
    for (let i = 0; i < pool.length; i += 1) {
      cursor -= weights[i] ?? 0;
      if (cursor <= 0) {
        product = pool[i]!;
        break;
      }
    }
    const variant = product.variants[Math.floor(rand() * product.variants.length)]!;
    return { product, variant };
  };

  let orderIndex = 0;
  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const weekend = new Date(todayUtc - daysAgo * 86_400_000).getUTCDay() % 6 === 0;
    let count = weekend ? 2 : 1;
    if (rand() < 0.22) count += 1;
    if (rand() < 0.12) count -= 1;
    if (daysAgo === 0) count = 2;
    for (let n = 0; n < count; n += 1) {
      orderIndex += 1;
      const lineCount = rand() < 0.72 ? 1 : rand() < 0.85 ? 2 : 3;
      const chosen = new Map<string, { variantId: string; productId: string; name: string; title: string; sku: string; price: number; cost: number; qty: number }>();
      for (let l = 0; l < lineCount; l += 1) {
        const picked = pickVariant(daysAgo);
        const meta = variantMeta.get(picked.variant.id)!;
        const existing = chosen.get(picked.variant.id);
        if (existing) existing.qty += 1;
        else {
          chosen.set(picked.variant.id, {
            variantId: picked.variant.id,
            productId: meta.productId,
            name: meta.name,
            title: meta.title,
            sku: meta.sku,
            price: meta.price,
            cost: meta.cost,
            qty: 1,
          });
        }
      }
      const lines = [...chosen.values()];
      const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
      const shipping = subtotal >= settings.freeShippingThresholdCents ? 0 : settings.shippingFlatCents;
      const total = subtotal + shipping;
      const fullRefund = rand() < 0.06 && daysAgo > 2;
      const partialRefund = !fullRefund && rand() < 0.035 && daysAgo > 2;
      const refunded = fullRefund ? total : partialRefund ? Math.round(total * 0.3) : 0;
      const paymentStatus = fullRefund ? "refunded" : partialRefund ? "partially_refunded" : "paid";
      const status = fullRefund ? "refunded" : partialRefund ? "partially_refunded" : daysAgo <= 2 ? "paid" : "fulfilled";
      const fulfillment = status === "fulfilled" ? "fulfilled" : "unfulfilled";
      const hour = 10 + Math.floor(rand() * 8);
      const created = new Date(todayUtc - daysAgo * 86_400_000 + hour * 3_600_000).toISOString();
      const occurred = created.slice(0, 10);
      const person = orderIndex % customerIds.length;
      const orderId = `ord_seed_${String(orderIndex).padStart(4, "0")}`;
      const number = `OR-${18420 + orderIndex}`;
      await query(
        `insert into orders (
          id, number, access_token, customer_id, email, customer_name, status, payment_status,
          fulfillment_status, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
          refunded_cents, currency, shipping_method, shipping_address, is_demo, created_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,0,$12,$13,'USD','standard',$14::jsonb,true,$15
        ) on conflict (id) do nothing`,
        [
          orderId,
          number,
          mintOrderToken(),
          customerIds[person],
          SEED_PEOPLE[person]![1],
          SEED_PEOPLE[person]![0],
          status,
          paymentStatus,
          fulfillment,
          subtotal,
          shipping,
          total,
          refunded,
          JSON.stringify({
            line1: "18 Rue des Archives",
            city: "Paris",
            region: "IDF",
            postal: "75004",
            country: "France",
          }),
          created,
        ],
      );
      await query(
        `insert into payments (id, order_id, provider, status, amount_cents, provider_ref)
         values ($1, $2, 'sample', $3, $4, $5) on conflict (id) do nothing`,
        [`pay_${orderId}`, orderId, paymentStatus === "paid" ? "paid" : paymentStatus, total, `sample-${orderIndex}`],
      );
      if (fulfillment === "fulfilled") {
        await query(
          `insert into fulfillments (id, order_id, carrier, tracking, status)
           values ($1, $2, 'Atelier dispatch', $3, 'fulfilled') on conflict (id) do nothing`,
          [`ful_${orderId}`, orderId, `ORR${100000 + orderIndex}`],
        );
      }
      if (refunded > 0) {
        await query(
          `insert into refunds (id, order_id, amount_cents, reason, restocked)
           values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
          [`ref_${orderId}`, orderId, refunded, fullRefund ? "Sample full return" : "Sample partial refund", fullRefund],
        );
      }
      let lineNo = 0;
      for (const line of lines) {
        lineNo += 1;
        await query(
          `insert into order_items (
            id, order_id, product_id, variant_id, product_name, variant_title, sku, qty, refunded_qty,
            unit_price_cents, unit_cost_cents
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do nothing`,
          [
            `li_${orderId}_${lineNo}`,
            orderId,
            line.productId,
            line.variantId,
            line.name,
            line.title,
            line.sku,
            line.qty,
            fullRefund ? line.qty : 0,
            line.price,
            line.cost,
          ],
        );
        await query(
          `insert into product_events (product_id, event, session_key, qty, occurred_on, is_demo)
           values ($1, 'purchase', $2, $3, $4, true)
           on conflict (product_id, event, session_key, occurred_on) do nothing`,
          [line.productId, `purchase-${orderId}`, line.qty, occurred],
        );
        await query(
          `insert into product_events (product_id, event, session_key, qty, occurred_on, is_demo)
           values ($1, 'add_to_cart', $2, 1, $3, true)
           on conflict (product_id, event, session_key, occurred_on) do nothing`,
          [line.productId, `cart-${orderId}-${lineNo}`, occurred],
        );
        const views = line.productId === "p_shirt" ? 1 : 3;
        for (let v = 0; v < views; v += 1) {
          await query(
            `insert into product_events (product_id, event, session_key, qty, occurred_on, is_demo)
             values ($1, 'view', $2, 1, $3, true)
             on conflict (product_id, event, session_key, occurred_on) do nothing`,
            [line.productId, `view-${orderId}-${lineNo}-${v}`, occurred],
          );
        }
      }
    }
  }

  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const occurred = new Date(todayUtc - daysAgo * 86_400_000).toISOString().slice(0, 10);
    for (let v = 0; v < 7; v += 1) {
      await query(
        `insert into product_events (product_id, event, session_key, qty, occurred_on, is_demo)
         values ('p_shirt', 'view', $1, 1, $2, true)
         on conflict (product_id, event, session_key, occurred_on) do nothing`,
        [`shirt-browse-${daysAgo}-${v}`, occurred],
      );
    }
    if (daysAgo % 3 === 0) {
      await query(
        `insert into product_events (product_id, event, session_key, qty, occurred_on, is_demo)
         values ('p_shirt', 'add_to_cart', $1, 1, $2, true)
         on conflict (product_id, event, session_key, occurred_on) do nothing`,
        [`shirt-cart-${daysAgo}`, occurred],
      );
    }
    await query(
      `insert into product_events (product_id, event, session_key, qty, occurred_on, is_demo)
       values ('p_slip', 'view', $1, 2, $2, true)
       on conflict (product_id, event, session_key, occurred_on) do nothing`,
      [`slip-view-${daysAgo}`, occurred],
    );
  }

  await query("update store_settings set seeded = true, updated_at = now() where id = 1");
  const check = await query<{ n: number }>("select count(*)::int as n from orders");
  if (num(check[0]?.n) < 10) throw new Error("Sample catalog did not seed");
}

/** Replace the fake mailbox and the two-day shipping claim on a shop that already seeded. */
async function dropShipPromise(query: Query) {
  const rows = await query<{ support_email: string; benefits: unknown; announcement: string }>(
    "select support_email, benefits, announcement from store_settings where id = 1",
  );
  const row = rows[0];
  if (!row) return;
  const raw = typeof row.benefits === "string" ? JSON.parse(row.benefits) : row.benefits;
  const benefits = Array.isArray(raw) ? raw : [];
  let changed = false;
  const next = benefits.map((item) => {
    if (!item || typeof item !== "object") return item;
    const title = (item as { title?: string }).title;
    if (title !== "Two-day dispatch") return item;
    changed = true;
    return SEED_SETTINGS.benefits[2];
  });
  const email = row.support_email === "studio@mu.example" ? SEED_SETTINGS.supportEmail : row.support_email;
  const announcement =
    row.announcement === "Complimentary shipping on studio orders over $120" ? SEED_SETTINGS.announcement : row.announcement;
  if (!changed && email === row.support_email && announcement === row.announcement) return;
  await query(
    "update store_settings set support_email = $1, benefits = $2::jsonb, announcement = $3, updated_at = now() where id = 1",
    [email, JSON.stringify(next), announcement],
  );
}

/** One-way copy of the original house demo into the pet studio. Orders and on-hand counts stay. */
async function upgradeStudio(query: Query) {
  const rows = await query<{ brand_name: string }>("select brand_name from store_settings where id = 1");
  if (rows[0]?.brand_name !== "ORRIS") return;
  const settings = SEED_SETTINGS;
  await query(
    `update store_settings set
      brand_name = $1, tagline = $2, announcement = $3, support_email = $4,
      shipping_flat_cents = $5, express_shipping_cents = $6, free_shipping_threshold_cents = $7,
      hero = $8::jsonb, benefits = $9::jsonb, editorial = $10::jsonb,
      footer_blurb = $11, socials = $12::jsonb, updated_at = now()
     where id = 1`,
    [
      settings.brandName,
      settings.tagline,
      settings.announcement,
      settings.supportEmail,
      settings.shippingFlatCents,
      settings.expressShippingCents,
      settings.freeShippingThresholdCents,
      JSON.stringify(settings.hero),
      JSON.stringify(settings.benefits),
      JSON.stringify(settings.editorial),
      settings.footerBlurb,
      JSON.stringify(settings.socials),
    ],
  );
  for (const category of SEED_CATEGORIES) {
    await query(
      `update categories set name = $2, slug = $3, description = $4, sort_order = $5 where id = $1`,
      [category.id, category.name, category.slug, category.description, category.sort],
    );
  }
  for (const product of SEED_PRODUCTS) {
    await query(
      `update products set
        name = $2, slug = $3, description = $4, story = $5, category_id = $6,
        tags = $7::jsonb, seo_title = $8, seo_description = $9
       where id = $1`,
      [
        product.id,
        product.name,
        product.slug,
        product.description,
        product.story,
        product.categoryId,
        JSON.stringify(product.tags),
        product.seoTitle,
        product.seoDescription,
      ],
    );
    await query(`update product_images set url = $2, alt = $3 where id = $1`, [
      `img_${product.id}`,
      product.image,
      product.alt,
    ]);
    for (const [index, variant] of product.variants.entries()) {
      await query(
        `update product_variants set
          sku = $2, title = $3, option1_name = $4, option1_value = $5,
          option2_name = $6, option2_value = $7, price_cents = $8, cost_cents = $9, position = $10
         where id = $1`,
        [
          variant.id,
          variant.sku,
          variant.title,
          variant.option1Name,
          variant.option1Value,
          variant.option2Name,
          variant.option2Value,
          variant.priceCents,
          variant.costCents,
          index,
        ],
      );
    }
  }
}
