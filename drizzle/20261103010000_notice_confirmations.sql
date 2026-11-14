-- Explicit acknowledgements are separate from opening a notice (notice_reads).
-- Existing records are deliberately not backfilled as confirmations.
alter table prayer_app.member_roster
  add column if not exists is_notice_officer boolean not null default false;

create table if not exists prayer_app.notice_confirmations (
  notice_id uuid not null references prayer_app.notices(id) on delete cascade,
  roster_id uuid not null references prayer_app.member_roster(id) on delete cascade,
  notice_revision varchar(32) not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by_user_id uuid references prayer_app.users(id) on delete set null,
  primary key (notice_id, roster_id)
);

alter table prayer_app.notice_confirmations enable row level security;
revoke all on prayer_app.notice_confirmations from public, anon, authenticated;
