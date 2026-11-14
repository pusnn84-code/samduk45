begin;
alter table prayer_app.visit_requests add column if not exists recipient_name varchar(120);
alter table prayer_app.visit_requests add column if not exists recipient_sam varchar(100);
alter table prayer_app.visit_requests add column if not exists is_unavailable boolean not null default false;
create index if not exists visit_requests_active_date_idx on prayer_app.visit_requests(visit_date) where status <> 'cancelled';
drop index if exists prayer_app.visit_requests_active_date_uq;
create table if not exists prayer_app.ministry_schedules (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references prayer_app.users(id),
 title varchar(120) not null,
 start_date date not null,
 end_date date,
 time varchar(5) not null,
 location varchar(500) not null default '',
 repeat varchar(10) not null default 'none' check (repeat in ('none','weekly')),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 check (end_date is null or end_date >= start_date)
);
create index if not exists ministry_schedules_date_idx on prayer_app.ministry_schedules(start_date);
alter table prayer_app.ministry_schedules enable row level security;
revoke all on prayer_app.ministry_schedules from public, anon, authenticated;
commit;
