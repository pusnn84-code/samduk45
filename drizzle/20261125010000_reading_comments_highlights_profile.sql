begin;
set local lock_timeout='3s';
alter table prayer_app.member_roster add column phone_private boolean not null default false;
create table prayer_app.meditation_comments(
 id uuid primary key default gen_random_uuid(),
 sharing_id uuid not null references prayer_app.bible_reading_shares(sharing_id) on delete cascade,
 user_id uuid not null references prayer_app.users(id) on delete cascade,
 body text not null check(length(btrim(body))>0),
 created_at timestamptz not null default now()
);
create index meditation_comments_parent_idx on prayer_app.meditation_comments(sharing_id,created_at,id);
create table prayer_app.scripture_highlights(
 user_id uuid not null references prayer_app.users(id) on delete cascade,
 book integer not null check(book between 1 and 66),
 chapter integer not null check(chapter between 1 and 150),
 verse integer not null check(verse between 1 and 176),
 color text not null check(color in ('yellow','green','pink')),
 updated_at timestamptz not null default now(),
 primary key(user_id,book,chapter,verse)
);
alter table prayer_app.meditation_comments enable row level security;
alter table prayer_app.scripture_highlights enable row level security;
revoke all on prayer_app.meditation_comments,prayer_app.scripture_highlights from public,anon,authenticated;
create policy deny_non_backend_access on prayer_app.meditation_comments as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.scripture_highlights as restrictive for all to public using(false) with check(false);
commit;
