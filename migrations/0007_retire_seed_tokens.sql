-- Retire public demonstration credentials.
--
-- Impact (measured read-only on 2026-10-20, before this file existed):
--   123 orders, all is_demo, 0 live orders, 123 tokens matching seed-token-<digits>.
--   0 stock holds, 0 unpaid orders, owner_email unset, 0 users, 0 desk members.
-- This statement changes access_token only. It does not change amounts, status,
-- payment, inventory, email, or address. The replacement is generated inside
-- the database and is not returned to the migration log.
-- Rows that are not demonstration orders are left untouched even if a token matched.

update orders
set access_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where is_demo = true
  and access_token ~ '^seed-token-[0-9]+$';
