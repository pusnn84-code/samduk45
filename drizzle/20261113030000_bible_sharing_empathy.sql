alter table prayer_app.bible_reading_entries
  add column if not exists sharing_id uuid not null default gen_random_uuid();
create unique index if not exists bible_reading_sharing_id_uq
  on prayer_app.bible_reading_entries(sharing_id);

create table if not exists prayer_app.bible_sharing_empathy (
  sharing_id uuid not null references prayer_app.bible_reading_entries(sharing_id) on delete cascade,
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(sharing_id,user_id)
);
create index if not exists bible_sharing_empathy_user_idx on prayer_app.bible_sharing_empathy(user_id);
alter table prayer_app.bible_sharing_empathy enable row level security;
revoke all on prayer_app.bible_sharing_empathy from public, anon, authenticated;

-- A deleted and re-posted line is a new target. Old reactions cannot reappear on it.
create or replace function prayer_app.reset_bible_sharing_empathy()
returns trigger language plpgsql set search_path=pg_catalog,prayer_app as $$
begin
  if old.sharing is not null and new.sharing is null then
    delete from prayer_app.bible_sharing_empathy where sharing_id=old.sharing_id;
    new.sharing_id=gen_random_uuid();
  end if;
  return new;
end;
$$;
revoke all on function prayer_app.reset_bible_sharing_empathy() from public, anon, authenticated;
drop trigger if exists bible_sharing_empathy_reset on prayer_app.bible_reading_entries;
create trigger bible_sharing_empathy_reset before update of sharing on prayer_app.bible_reading_entries
  for each row execute function prayer_app.reset_bible_sharing_empathy();
