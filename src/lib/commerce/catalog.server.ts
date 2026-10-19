import { getSql, type Sql } from "@/lib/db";
import type { CategoryCard, PublicImage, PublicProduct, PublicSettings, PublicVariant } from "./catalog";
import { asJson, iso, num } from "@/lib/format";
import { ensureSeeded } from "./seed.server";
import { shippingQuote } from "./metrics";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  story: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  tags: unknown;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  published_at: unknown;
};

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  title: string;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  cost_cents: number;
  inventory_qty: number;
  position: number;
};

type ImageRow = {
  id: string;
  product_id: string;
  url: string;
  alt: string;
  position: number;
  is_cover: boolean;
};

async function db(): Promise<Sql> {
  await ensureSeeded();
  return getSql();
}

export async function readSettings(): Promise<PublicSettings & {
  lowStock: number;
  slowCoverDays: number;
  replenishCoverDays: number;
  minViews: number;
  highMargin: number;
  lowMargin: number;
  lowConversion: number;
  judgementDays: number;
  vatRate: number;
  importTaxRate: number;
}> {
  const sql = await db();
  const rows = await sql<Record<string, unknown>>`select * from store_settings where id = 1`;
  const row = rows[0];
  if (!row) throw new Error("Shop settings are missing");
  return {
    brandName: String(row.brand_name),
    tagline: String(row.tagline),
    announcement: String(row.announcement),
    supportEmail: String(row.support_email),
    currency: String(row.currency),
    shippingFlatCents: num(row.shipping_flat_cents),
    expressShippingCents: num(row.express_shipping_cents),
    freeShippingThresholdCents: num(row.free_shipping_threshold_cents),
    hero: asJson(row.hero, {
      eyebrow: "",
      title: "",
      subtitle: "",
      ctaLabel: "",
      ctaHref: "/shop",
      image: "/catalog/hero.jpg",
    }),
    benefits: asJson(row.benefits, []),
    editorial: asJson(row.editorial, { eyebrow: "", title: "", body: "", image: "" }),
    footerBlurb: String(row.footer_blurb),
    socials: asJson(row.socials, []),
    lowStock: num(row.low_stock_threshold),
    slowCoverDays: num(row.slow_cover_days),
    replenishCoverDays: num(row.replenish_cover_days),
    minViews: num(row.min_views),
    highMargin: num(row.high_margin_bps) / 10_000,
    lowMargin: num(row.low_margin_bps) / 10_000,
    lowConversion: num(row.low_conversion_bps) / 10_000,
    judgementDays: num(row.judgement_days),
    vatRate: num(row.vat_bps) / 10_000,
    importTaxRate: num(row.import_tax_bps) / 10_000,
  };
}

function toVariant(row: VariantRow, withCost: boolean) {
  const base: PublicVariant & { costCents?: number } = {
    id: row.id,
    sku: row.sku,
    title: row.title,
    option1Name: row.option1_name,
    option1Value: row.option1_value,
    option2Name: row.option2_name,
    option2Value: row.option2_value,
    priceCents: num(row.price_cents),
    compareAtCents: row.compare_at_cents === null ? null : num(row.compare_at_cents),
    inventoryQty: num(row.inventory_qty),
  };
  if (withCost) base.costCents = num(row.cost_cents);
  return base;
}

function assemble(
  rows: ProductRow[],
  variants: VariantRow[],
  images: ImageRow[],
  withCost: boolean,
): (PublicProduct & { status?: string; publishedAt?: string; costCents?: number })[] {
  return rows.map((row) => {
    const vars = variants
      .filter((variant) => variant.product_id === row.id)
      .sort((a, b) => num(a.position) - num(b.position))
      .map((variant) => toVariant(variant, withCost));
    const pics: PublicImage[] = images
      .filter((image) => image.product_id === row.id)
      .sort((a, b) => num(a.position) - num(b.position))
      .map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        isCover: Boolean(image.is_cover),
      }));
    const prices = vars.map((variant) => variant.priceCents);
    const priceCents = prices.length ? Math.min(...prices) : 0;
    const inventoryQty = vars.reduce((sum, variant) => sum + variant.inventoryQty, 0);
    const compare = vars.find((variant) => variant.compareAtCents && variant.compareAtCents > variant.priceCents);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      story: row.story,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      tags: asJson<string[]>(row.tags, []),
      images: pics,
      variants: vars,
      priceCents,
      compareAtCents: compare?.compareAtCents ?? null,
      inventoryQty,
      soldOut: inventoryQty <= 0,
      seoTitle: row.seo_title || row.name,
      seoDescription: row.seo_description || row.description,
      status: row.status,
      publishedAt: iso(row.published_at),
    };
  });
}

async function loadProducts(whereSql: string, params: unknown[], withCost = false) {
  const sql = await db();
  const rows = await sql.query<ProductRow>(
    `select p.id, p.name, p.slug, p.description, p.story, p.category_id, c.name as category_name,
            c.slug as category_slug, p.tags, p.seo_title, p.seo_description, p.status, p.published_at
     from products p
     join categories c on c.id = p.category_id
     ${whereSql}
     order by p.published_at desc nulls last, p.name`,
    params,
  );
  if (rows.length === 0) return [];
  const ids = JSON.stringify(rows.map((row) => row.id));
  const variants = await sql.query<VariantRow>(
    `select * from product_variants where product_id in (select jsonb_array_elements_text($1::jsonb)) order by position`,
    [ids],
  );
  const images = await sql.query<ImageRow>(
    `select id, product_id, url, alt, position, is_cover from product_images
     where product_id in (select jsonb_array_elements_text($1::jsonb)) order by position`,
    [ids],
  );
  return assemble(rows, variants, images, withCost);
}

export async function loadPublished() {
  return loadProducts(`where p.status = 'published'`, [], false);
}

export async function loadAllProducts() {
  return loadProducts("", [], true);
}

async function unitsByProduct() {
  const sql = await db();
  const rows = await sql<{ product_id: string; units: number }>`
    select i.product_id, coalesce(sum(i.qty - i.refunded_qty), 0)::int as units
    from order_items i
    join orders o on o.id = i.order_id
    where o.payment_status in ('paid', 'partially_refunded', 'refunded')
      and i.product_id is not null
    group by i.product_id
  `;
  return new Map(rows.map((row) => [row.product_id, num(row.units)]));
}

export async function loadChrome() {
  const settings = await readSettings();
  return {
    announcement: settings.announcement,
    brandName: settings.brandName,
    footerBlurb: settings.footerBlurb,
    supportEmail: settings.supportEmail,
  };
}

export async function loadHome() {
  const [settings, products, categories, units] = await Promise.all([
    readSettings(),
    loadPublished(),
    loadCategories(),
    unitsByProduct(),
  ]);
  const ranked = [...products].sort((a, b) => (units.get(b.id) ?? 0) - (units.get(a.id) ?? 0));
  const featured = products.filter((product) => product.tags.includes("featured"));
  const topUnits = ranked[0] ? (units.get(ranked[0].id) ?? 0) : 0;
  return {
    settings: publicSettings(settings),
    categories,
    featured: (featured.length > 0 ? featured : products).slice(0, 4),
    leaders: topUnits > 0 ? ranked.slice(0, 4) : [],
    newArrivals: [...products]
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, 4),
  };
}

function publicSettings(settings: Awaited<ReturnType<typeof readSettings>>): PublicSettings {
  return {
    brandName: settings.brandName,
    tagline: settings.tagline,
    announcement: settings.announcement,
    supportEmail: settings.supportEmail,
    currency: settings.currency,
    shippingFlatCents: settings.shippingFlatCents,
    expressShippingCents: settings.expressShippingCents,
    freeShippingThresholdCents: settings.freeShippingThresholdCents,
    hero: settings.hero,
    benefits: settings.benefits,
    editorial: settings.editorial,
    footerBlurb: settings.footerBlurb,
    socials: settings.socials,
  };
}

export async function loadCategories(): Promise<CategoryCard[]> {
  const sql = await db();
  const rows = await sql<{
    id: string;
    name: string;
    slug: string;
    description: string;
    url: string | null;
    alt: string | null;
  }>`
    select c.id, c.name, c.slug, c.description,
      (select i.url from product_images i
        join products p on p.id = i.product_id
        where p.category_id = c.id and p.status = 'published'
        order by i.is_cover desc, i.position
        limit 1) as url,
      (select i.alt from product_images i
        join products p on p.id = i.product_id
        where p.category_id = c.id and p.status = 'published'
        order by i.is_cover desc, i.position
        limit 1) as alt
    from categories c
    order by c.sort_order, c.name
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    image: row.url,
    alt: row.alt || row.name,
  }));
}

export async function loadShop(input: {
  q?: string;
  category?: string;
  pet?: string;
  sort?: string;
  min?: number;
  max?: number;
  inStock?: boolean;
}) {
  const [settings, products, categories] = await Promise.all([
    readSettings(),
    loadPublished(),
    loadCategories(),
  ]);
  const units = await unitsByProduct();
  const q = (input.q ?? "").trim().toLowerCase();
  let items = products.filter((product) => {
    if (input.category && product.categorySlug !== input.category) return false;
    if ((input.pet === "dog" || input.pet === "cat") && !product.tags.includes(input.pet)) return false;
    if (input.inStock && product.soldOut) return false;
    if (input.min && product.priceCents < input.min) return false;
    if (input.max && product.priceCents > input.max) return false;
    if (!q) return true;
    const hay = [product.name, product.description, product.categoryName, ...product.tags, ...product.variants.map((variant) => variant.sku)]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  const sort = input.sort || "featured";
  if (sort === "newest") items = [...items].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  else if (sort === "price-asc") items = [...items].sort((a, b) => a.priceCents - b.priceCents);
  else if (sort === "price-desc") items = [...items].sort((a, b) => b.priceCents - a.priceCents);
  else items = [...items].sort((a, b) => (units.get(b.id) ?? 0) - (units.get(a.id) ?? 0));
  return { settings: publicSettings(settings), categories, products: items };
}

export async function loadProduct(slug: string) {
  const products = await loadProducts(`where p.slug = $1 and p.status = 'published'`, [slug], false);
  const product = products[0];
  if (!product) return null;
  const related = (await loadPublished())
    .filter((item) => item.categoryId === product.categoryId && item.id !== product.id)
    .slice(0, 3);
  const settings = publicSettings(await readSettings());
  return { product, related, settings };
}

export async function quoteLines(lines: { variantId: string; qty: number }[]) {
  const settings = await readSettings();
  const sql = await db();
  if (lines.length === 0) {
    return {
      lines: [],
      subtotalCents: 0,
      standardCents: settings.shippingFlatCents,
      expressCents: settings.expressShippingCents,
      thresholdCents: settings.freeShippingThresholdCents,
      currency: settings.currency,
    };
  }
  const ids = JSON.stringify(lines.map((line) => line.variantId));
  const rows = await sql.query<{
    id: string;
    sku: string;
    title: string;
    price_cents: number;
    inventory_qty: number;
    product_name: string;
    product_id: string;
    slug: string;
    status: string;
    image: string | null;
    alt: string | null;
  }>(
    `select v.id, v.sku, v.title, v.price_cents, v.inventory_qty, p.name as product_name, p.id as product_id,
            p.slug, p.status,
            (select i.url from product_images i where i.product_id = p.id order by i.is_cover desc, i.position limit 1) as image,
            (select i.alt from product_images i where i.product_id = p.id order by i.is_cover desc, i.position limit 1) as alt
     from product_variants v
     join products p on p.id = v.product_id
     where v.id in (select jsonb_array_elements_text($1::jsonb))`,
    [ids],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const detailed = lines.map((line) => {
    const row = byId.get(line.variantId);
    if (!row || row.status !== "published") {
      return {
        variantId: line.variantId,
        qty: line.qty,
        available: false,
        name: "Unavailable",
        title: "",
        sku: "",
        slug: "",
        image: null as string | null,
        alt: "",
        priceCents: 0,
        inventoryQty: 0,
        productId: "",
        warning: "This piece is no longer for sale.",
      };
    }
    const qty = Math.min(Math.max(line.qty, 1), 10);
    const warning = num(row.inventory_qty) < qty ? `Only ${num(row.inventory_qty)} left.` : null;
    return {
      variantId: row.id,
      qty,
      available: num(row.inventory_qty) > 0,
      name: row.product_name,
      title: row.title,
      sku: row.sku,
      slug: row.slug,
      image: row.image,
      alt: row.alt || row.product_name,
      priceCents: num(row.price_cents),
      inventoryQty: num(row.inventory_qty),
      productId: row.product_id,
      warning,
    };
  });
  const subtotalCents = detailed.reduce(
    (sum, line) => sum + (line.available ? line.priceCents * line.qty : 0),
    0,
  );
  return {
    lines: detailed,
    subtotalCents,
    standardCents: shippingQuote(subtotalCents, "standard", {
      flatCents: settings.shippingFlatCents,
      expressCents: settings.expressShippingCents,
      thresholdCents: settings.freeShippingThresholdCents,
    }),
    expressCents: settings.expressShippingCents,
    thresholdCents: settings.freeShippingThresholdCents,
    currency: settings.currency,
  };
}

export async function subscribeEmail(email: string) {
  const sql = await db();
  const clean = email.trim().toLowerCase();
  const rows = await sql<{ email: string }>`
    insert into newsletter_subscribers (email) values (${clean})
    on conflict (email) do nothing
    returning email
  `;
  return { ok: true as const, already: rows.length === 0 };
}

export async function trackEvent(input: { productId: string; event: string; sessionKey: string }) {
  const allowed = new Set(["view", "add_to_cart", "checkout_started"]);
  if (!allowed.has(input.event)) return { ok: false };
  const sessionKey = input.sessionKey.slice(0, 80);
  if (!sessionKey || sessionKey.startsWith("seed")) return { ok: false };
  const sql = await db();
  await sql`
    insert into product_events (product_id, event, session_key, qty, occurred_on, is_demo)
    select ${input.productId}, ${input.event}, ${sessionKey}, 1, (now() at time zone 'utc')::date, false
    where exists (select 1 from products where id = ${input.productId} and status = 'published')
    on conflict (product_id, event, session_key, occurred_on) do nothing
  `;
  return { ok: true };
}

export async function loadOrderAccess(input: { number: string; email?: string; token?: string }) {
  const number = input.number.trim().toUpperCase();
  const email = input.email?.trim().toLowerCase() ?? "";
  const token = input.token?.trim() ?? "";
  if (!number || (!email && !token)) return null;
  const sql = await db();
  const orders = await sql<Record<string, unknown>>`
    select * from orders
    where number = ${number}
      and (
        (${token} <> '' and access_token = ${token})
        or (${email} <> '' and email = ${email})
      )
    limit 1
  `;
  const order = orders[0];
  if (!order) return null;
  const items = await sql<Record<string, unknown>>`
    select product_name, variant_title, sku, qty, unit_price_cents
    from order_items where order_id = ${String(order.id)} order by id
  `;
  return {
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
    isDemo: Boolean(order.is_demo),
    createdAt: iso(order.created_at),
    provider: "demonstration",
    items: items.map((item) => ({
      name: String(item.product_name),
      title: String(item.variant_title),
      sku: String(item.sku),
      qty: num(item.qty),
      unitPriceCents: num(item.unit_price_cents),
    })),
  };
}
