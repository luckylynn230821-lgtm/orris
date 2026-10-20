-- Order holds, demonstration payments, checkout rate limits, and a bound owner.
-- Additive. Existing rows keep their status. New columns use defaults.
-- Rollback: docs/audit/rollback-0006.sql

alter table orders add column if not exists reserve_until timestamptz;
alter table orders add column if not exists stock_held boolean not null default false;
alter table orders add column if not exists payment_source text not null default 'none';

alter table orders drop constraint if exists orders_payment_source_check;
alter table orders add constraint orders_payment_source_check
  check (payment_source in ('none', 'demonstration', 'gateway'));

alter table store_settings add column if not exists owner_email text;

create table if not exists rate_buckets (
  bucket text primary key,
  hits int not null,
  window_start timestamptz not null
);
