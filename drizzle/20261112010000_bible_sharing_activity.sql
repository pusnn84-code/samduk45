alter table prayer_app.bible_reading_entries add column if not exists sharing_updated_at timestamptz;
create table if not exists prayer_app.bible_sharing_views (
 user_id uuid not null references prayer_app.users(id) on delete cascade,
 reading_date date not null, viewed_at timestamptz not null,
 primary key(user_id,reading_date)
);
alter table prayer_app.bible_sharing_views enable row level security;
revoke all on prayer_app.bible_sharing_views from public,anon,authenticated;
create or replace function prayer_app.stamp_bible_sharing() returns trigger language plpgsql set search_path=pg_catalog,prayer_app as $$
begin
 if TG_OP='INSERT' then
   if NEW.sharing is not null then NEW.sharing_updated_at=clock_timestamp(); end if;
 elsif NEW.sharing is distinct from OLD.sharing or NEW.sharing_anonymous is distinct from OLD.sharing_anonymous then
   NEW.sharing_updated_at=clock_timestamp();
 end if;
 return NEW;
end $$;
drop trigger if exists bible_sharing_stamp on prayer_app.bible_reading_entries;
create trigger bible_sharing_stamp before insert or update on prayer_app.bible_reading_entries for each row execute function prayer_app.stamp_bible_sharing();
