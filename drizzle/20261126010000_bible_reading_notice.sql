begin;
set local lock_timeout='3s';
create table prayer_app.bible_reading_notice (
 id integer primary key check(id=1),
 title text not null default '',
 body text not null default '',
 updated_at timestamptz not null default now()
);
alter table prayer_app.bible_reading_notice enable row level security;
revoke all on prayer_app.bible_reading_notice from public,anon,authenticated;
create policy deny_non_backend_access on prayer_app.bible_reading_notice as restrictive for all to public using(false) with check(false);
commit;
