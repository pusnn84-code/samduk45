begin;
create table if not exists prayer_app.autumn_people (
 id uuid primary key default gen_random_uuid(),
 source_key text unique,
 person_name varchar(120) not null check(length(btrim(person_name))>0),
 sam_id uuid not null references prayer_app.sams(id),
 source_author_name varchar(120),
 created_by_user_id uuid references prayer_app.users(id) on delete set null,
 submission_key uuid,
 prayer text not null check(length(btrim(prayer)) between 1 and 10000),
 visited boolean not null default false,
 registered boolean not null default false,
 active boolean not null default true,
 version integer not null default 1,
 updated_by_user_id uuid references prayer_app.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint autumn_people_submission_uq unique(created_by_user_id,submission_key)
);
create index if not exists autumn_people_sam_idx on prayer_app.autumn_people(sam_id,person_name,id) where active;
create table if not exists prayer_app.autumn_daily (
 prayer_date date primary key,
 person_id uuid not null references prayer_app.autumn_people(id),
 created_at timestamptz not null default now()
);
create table if not exists prayer_app.autumn_prayers (
 person_id uuid not null references prayer_app.autumn_people(id) on delete cascade,
 user_id uuid not null references prayer_app.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(person_id,user_id)
);
alter table prayer_app.autumn_people enable row level security;
alter table prayer_app.autumn_daily enable row level security;
alter table prayer_app.autumn_prayers enable row level security;
revoke all on prayer_app.autumn_people,prayer_app.autumn_daily,prayer_app.autumn_prayers from public,anon,authenticated;
commit;
