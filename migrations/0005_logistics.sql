alter table store_settings add column if not exists vat_bps int not null default 0;
alter table store_settings add column if not exists import_tax_bps int not null default 0;

create table if not exists carriers (
  id text primary key,
  name text not null,
  tracking_url text not null default '',
  cost_cents int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table fulfillments add column if not exists carrier_id text;
alter table fulfillments add column if not exists tracking_url text not null default '';
alter table fulfillments add column if not exists logistics_cost_cents int not null default 0;

create table if not exists outbound_messages (
  id text primary key,
  kind text not null,
  order_id text,
  email text not null,
  subject text not null,
  body text not null,
  status text not null,
  created_at timestamptz not null default now()
);
