begin;
alter table prayer_app.member_roster add column if not exists notice_officer_title varchar(30) not null default '';
alter table prayer_app.autumn_people add column if not exists source_author_roster_id uuid references prayer_app.member_roster(id) on delete set null;
-- Bind imported authors only when the exact source name and sam identify one active member.
with matches as (
 select p.id,(array_agg(r.id))[1] roster_id from prayer_app.autumn_people p
 join prayer_app.sams s on s.id=p.sam_id
 join prayer_app.member_roster r on r.is_active
  and upper(regexp_replace(r.source_name,'\s','','g'))=upper(regexp_replace(p.source_author_name,'\s','','g'))
  and regexp_replace(r.sam_label,'샘$','')=regexp_replace(s.name,'샘$','')
 where p.source_author_roster_id is null and p.source_author_name is not null
 group by p.id having count(*)=1
) update prayer_app.autumn_people p set source_author_roster_id=m.roster_id from matches m where p.id=m.id;
create table if not exists prayer_app.autumn_comments (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references prayer_app.autumn_people(id) on delete cascade,
 user_id uuid not null references prayer_app.users(id),
 body text not null check(length(btrim(body)) between 1 and 10000),
 submission_key uuid not null,
 created_at timestamptz not null default now(),
 unique(person_id,user_id,submission_key)
);
create index if not exists autumn_comments_person_idx on prayer_app.autumn_comments(person_id,created_at,id);
alter table prayer_app.autumn_comments enable row level security;
revoke all on prayer_app.autumn_comments from public,anon,authenticated;
commit;
