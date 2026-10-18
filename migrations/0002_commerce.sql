-- ORRIS commerce schema. Amounts are integer cents. Orders snapshot price and cost.

create table if not exists store_settings (
  id int primary key default 1 check (id = 1),
  brand_name text not null,
  tagline text not null,
  announcement text not null,
  support_email text not null,
  currency text not null default 'USD',
  shipping_flat_cents int not null,
  express_shipping_cents int not null,
  free_shipping_threshold_cents int not null,
  low_stock_threshold int not null,
  slow_cover_days int not null,
  replenish_cover_days int not null,
  min_views int not null,
  high_margin_bps int not null,
  low_margin_bps int not null,
  low_conversion_bps int not null,
  judgement_days int not null,
  hero jsonb not null,
  benefits jsonb not null,
  editorial jsonb not null,
  footer_blurb text not null,
  socials jsonb not null,
  seeded boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists store_members (
  user_id text primary key,
  role text not null check (role in ('administrator')),
  email text,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text not null default '',
  sort_order int not null default 0
);

create table if not exists products (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text not null,
  story text not null default '',
  category_id text not null references categories (id),
  status text not null check (status in ('draft', 'published', 'archived')),
  tags jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists products_status_idx on products (status);
create index if not exists products_category_idx on products (category_id);

create table if not exists product_variants (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  sku text not null unique,
  title text not null,
  option1_name text,
  option1_value text,
  option2_name text,
  option2_value text,
  price_cents int not null check (price_cents >= 0),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents >= 0),
  cost_cents int not null check (cost_cents >= 0),
  barcode text,
  inventory_qty int not null default 0 check (inventory_qty >= 0),
  position int not null default 0
);

create index if not exists product_variants_product_idx on product_variants (product_id);

create table if not exists product_images (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  url text not null,
  alt text not null default '',
  position int not null default 0,
  is_cover boolean not null default false
);

create index if not exists product_images_product_idx on product_images (product_id, position);

create table if not exists customers (
  id text primary key,
  user_id text unique,
  email text not null unique,
  name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  number text not null unique,
  access_token text not null unique,
  idempotency_key text unique,
  customer_id text references customers (id),
  email text not null,
  customer_name text not null,
  status text not null check (status in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded', 'partially_refunded')),
  payment_status text not null check (payment_status in ('unpaid', 'paid', 'refunded', 'partially_refunded', 'failed')),
  fulfillment_status text not null check (fulfillment_status in ('unfulfilled', 'partial', 'fulfilled', 'cancelled')),
  subtotal_cents int not null,
  discount_cents int not null default 0,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null,
  refunded_cents int not null default 0,
  currency text not null default 'USD',
  shipping_method text not null,
  shipping_address jsonb not null,
  is_demo boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_idx on orders (created_at);
create index if not exists orders_email_idx on orders (email);

create sequence if not exists order_number_seq start with 18420;

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  product_id text,
  variant_id text,
  product_name text not null,
  variant_title text not null,
  sku text not null,
  qty int not null check (qty > 0),
  refunded_qty int not null default 0 check (refunded_qty >= 0),
  unit_price_cents int not null,
  unit_cost_cents int not null,
  discount_cents int not null default 0
);

create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_product_idx on order_items (product_id);

create table if not exists payments (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  provider text not null,
  status text not null,
  amount_cents int not null,
  provider_ref text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists refunds (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  reason text,
  restocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists fulfillments (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  carrier text,
  tracking text,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id text primary key,
  variant_id text not null references product_variants (id),
  qty_delta int not null,
  reason text not null,
  reference text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_variant_idx on inventory_movements (variant_id, created_at desc);

create table if not exists product_events (
  id bigserial primary key,
  product_id text not null,
  event text not null check (event in ('view', 'add_to_cart', 'checkout_started', 'purchase')),
  session_key text not null,
  qty int not null default 1 check (qty > 0),
  occurred_on date not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists product_events_dedupe
  on product_events (product_id, event, session_key, occurred_on);

create table if not exists newsletter_subscribers (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_id text,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
