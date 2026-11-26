begin;
alter table prayer_app.member_roster add column if not exists notice_officer_title varchar(30) not null default '';
create table if not exists prayer_app.autumn_card_authors (
 person_id uuid not null references prayer_app.autumn_people(id) on delete cascade,
 roster_id uuid not null references prayer_app.member_roster(id) on delete cascade,
 primary key(person_id,roster_id)
);
-- Resolve imported single/joint authors by exact names. Prefer the source sam;
-- ambiguous same-name matches are never granted access.
with names as (
 select p.id,regexp_replace(s.name,'샘$','') sam,upper(regexp_replace(btrim(n.name),'\s','','g')) name
 from prayer_app.autumn_people p join prayer_app.sams s on s.id=p.sam_id
 cross join lateral regexp_split_to_table(p.source_author_name,'[,，·/]') n(name)
 where p.source_author_name is not null
), candidates as (
 select n.id,n.name,r.id roster_id,
  (case when regexp_replace(r.sam_label,'샘$','')=n.sam then 0 else 2 end)+
  (case when upper(regexp_replace(r.source_name,'\s','','g'))=n.name then 0 else 1 end) score
 from names n join prayer_app.member_roster r on r.is_active and
 (upper(regexp_replace(r.source_name,'\s','','g'))=n.name or upper(regexp_replace(r.canonical_name,'\s','','g'))=n.name)
), ranked as (
 select *,min(score) over(partition by id,name) best from candidates
), unambiguous as (
 select id,name,(array_agg(roster_id))[1] roster_id from ranked where score=best group by id,name having count(*)=1
) insert into prayer_app.autumn_card_authors(person_id,roster_id)
 select distinct id,roster_id from unambiguous on conflict do nothing;
alter table prayer_app.autumn_card_authors enable row level security;
revoke all on prayer_app.autumn_card_authors from public,anon,authenticated;
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
