-- Roll back 0006_integrity.sql. Run only on a copy, or after a backup.
-- This does not delete orders, items, or customers.

alter table orders drop constraint if exists orders_payment_source_check;
alter table orders drop column if exists payment_source;
alter table orders drop column if exists stock_held;
alter table orders drop column if exists reserve_until;
alter table store_settings drop column if exists owner_email;
drop table if exists rate_buckets;
delete from _migrations where name = '0006_integrity.sql';
