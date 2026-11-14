begin;
-- Existing history is the starting baseline, not hundreds of newly joined members.
-- New users receive their own join-time baseline through these server defaults.
alter table prayer_app.users add column if not exists community_menu_seen_at timestamptz not null default now();
alter table prayer_app.users add column if not exists directory_menu_seen_at timestamptz not null default now();
create index if not exists community_posts_activity_idx on prayer_app.community_posts(published_at) where published_at is not null;
-- Existing users-table RLS and schema/table revocations remain in force.
commit;
