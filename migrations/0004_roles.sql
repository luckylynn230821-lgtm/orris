-- Owner is the parent account. Manager sees the whole desk. Staff runs orders and stock.
-- Up to 10 people besides the owner, counted in application code.

alter table store_members drop constraint if exists store_members_role_check;
update store_members set role = 'owner' where role = 'administrator';
alter table store_members add constraint store_members_role_check check (role in ('owner', 'manager', 'staff'));

create table if not exists store_invites (
  email text primary key,
  role text not null check (role in ('manager', 'staff')),
  created_at timestamptz not null default now()
);
