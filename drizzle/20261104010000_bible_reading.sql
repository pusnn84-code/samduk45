create table if not exists prayer_app.bible_reading_entries (
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  reading_date date not null,
  completed boolean not null default false,
  sharing varchar(150),
  primary key (user_id, reading_date),
  constraint bible_reading_entries_plan_year
    check (reading_date >= date '2027-01-01' and reading_date < date '2028-01-01')
);

create index if not exists bible_reading_entries_date_idx
  on prayer_app.bible_reading_entries (reading_date);

alter table prayer_app.bible_reading_entries enable row level security;
revoke all on prayer_app.bible_reading_entries from public, anon, authenticated;
