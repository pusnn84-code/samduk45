begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
-- PostgreSQL requires column-specific triggers to be detached during a type change.
-- Restore every user trigger and its enabled state within the same transaction.
create temporary table meditation_trigger_restore on commit drop as
 select tgname,pg_get_triggerdef(oid) as definition,tgenabled from pg_trigger
 where tgrelid='prayer_app.bible_reading_entries'::regclass and not tgisinternal;
do $ declare t record; begin
 for t in select * from meditation_trigger_restore loop
 execute format('drop trigger %I on prayer_app.bible_reading_entries',t.tgname);
 end loop;
end $;
alter table prayer_app.bible_reading_entries alter column sharing type text;
do $ declare t record; begin
 for t in select * from meditation_trigger_restore loop
 execute t.definition;
 if t.tgenabled='D' then execute format('alter table prayer_app.bible_reading_entries disable trigger %I',t.tgname);
 elsif t.tgenabled='R' then execute format('alter table prayer_app.bible_reading_entries enable replica trigger %I',t.tgname);
 elsif t.tgenabled='A' then execute format('alter table prayer_app.bible_reading_entries enable always trigger %I',t.tgname);
 end if;
 end loop;
end $;
create table prayer_app.bible_reading_shares(
 sharing_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references prayer_app.users(id) on delete cascade,
 reading_date date not null,sharing text,
 sharing_anonymous boolean not null default false,anonymous_number integer,
 sharing_updated_at timestamptz not null default clock_timestamp(),created_at timestamptz not null default now(),
 constraint meditation_anonymous_has_number check(not sharing_anonymous or anonymous_number is not null)
);
create index meditation_date_updated_idx on prayer_app.bible_reading_shares(reading_date,sharing_updated_at,sharing_id);
create unique index meditation_anonymous_number_uq on prayer_app.bible_reading_shares(reading_date,anonymous_number) where anonymous_number is not null;
insert into prayer_app.bible_reading_shares(sharing_id,user_id,reading_date,sharing,sharing_anonymous,anonymous_number,sharing_updated_at)
 select sharing_id,user_id,reading_date,sharing,sharing_anonymous,anonymous_number,coalesce(sharing_updated_at,now()) from prayer_app.bible_reading_entries;
alter table prayer_app.bible_reading_shares enable row level security;
revoke all on prayer_app.bible_reading_shares from public,anon,authenticated;
create policy deny_non_backend_access on prayer_app.bible_reading_shares as restrictive for all to public using(false) with check(false);
do $$ declare fk record; begin
 for fk in select conname from pg_constraint where conrelid='prayer_app.bible_sharing_empathy'::regclass and confrelid='prayer_app.bible_reading_entries'::regclass and contype='f'
 loop execute format('alter table prayer_app.bible_sharing_empathy drop constraint %I',fk.conname);end loop;
end $$;
alter table prayer_app.bible_sharing_empathy add constraint bible_empathy_meditation_fk foreign key(sharing_id) references prayer_app.bible_reading_shares(sharing_id) on delete cascade;
create function prayer_app.sync_legacy_reading_share() returns trigger language plpgsql set search_path=pg_catalog,prayer_app as $$
begin
 if tg_op='UPDATE' and old.sharing_id is distinct from new.sharing_id then update prayer_app.bible_reading_shares set sharing=null,sharing_anonymous=false,anonymous_number=null where sharing_id=old.sharing_id;end if;
 insert into prayer_app.bible_reading_shares(sharing_id,user_id,reading_date,sharing,sharing_anonymous,anonymous_number,sharing_updated_at)
 values(new.sharing_id,new.user_id,new.reading_date,new.sharing,new.sharing_anonymous,new.anonymous_number,coalesce(new.sharing_updated_at,clock_timestamp()))
 on conflict(sharing_id) do update set sharing=excluded.sharing,sharing_anonymous=excluded.sharing_anonymous,anonymous_number=excluded.anonymous_number;
 return new;
end $$;
create trigger meditation_legacy_sync after insert or update of sharing,sharing_anonymous,anonymous_number on prayer_app.bible_reading_entries for each row execute function prayer_app.sync_legacy_reading_share();
create function prayer_app.stamp_meditation() returns trigger language plpgsql set search_path=pg_catalog,prayer_app as $$
begin
 if tg_op='INSERT' then new.sharing_updated_at=clock_timestamp();
 elsif new.sharing is distinct from old.sharing or new.sharing_anonymous is distinct from old.sharing_anonymous then new.sharing_updated_at=clock_timestamp();end if;
 return new;
end $$;
create trigger meditation_stamp before insert or update on prayer_app.bible_reading_shares for each row execute function prayer_app.stamp_meditation();
create function prayer_app.capture_meditation() returns trigger language plpgsql set search_path=pg_catalog,prayer_app as $$
begin
 if tg_op='UPDATE' and old.sharing is not null and new.sharing is null then delete from prayer_app.bible_sharing_empathy where sharing_id=new.sharing_id;end if;
 if nullif(btrim(new.sharing),'') is not null and (tg_op='INSERT' or nullif(btrim(old.sharing),'') is null) then
 perform prayer_app.enqueue_mobile_push('reading',new.sharing_id::text,'reading:'||new.sharing_id,new.user_id);end if;
 return new;
end $$;
create trigger meditation_capture after insert or update of sharing on prayer_app.bible_reading_shares for each row execute function prayer_app.capture_meditation();
revoke all on function prayer_app.sync_legacy_reading_share(),prayer_app.stamp_meditation(),prayer_app.capture_meditation() from public,anon,authenticated;
commit;

