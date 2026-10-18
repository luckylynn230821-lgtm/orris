alter table orders drop constraint if exists orders_fulfillment_status_check;
alter table orders add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('unfulfilled', 'partial', 'shipped', 'fulfilled', 'cancelled'));

create table if not exists order_events (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_idx on order_events (order_id, created_at);

create table if not exists order_reviews (
  id text primary key,
  order_id text not null unique references orders (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists service_requests (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  reason text not null,
  status text not null check (status in ('open', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists service_requests_order_idx on service_requests (order_id, created_at desc);
