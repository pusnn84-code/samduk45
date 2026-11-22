begin;
create table prayer_app.samji_documents(
 id uuid primary key,author_user_id uuid not null references prayer_app.users(id),issue_date date not null,title varchar(120) not null,
 content jsonb not null check(jsonb_typeof(content)='array'),source_name text not null,source_sha256 varchar(64) not null,
 source_data bytea not null check(octet_length(source_data) between 5 and 3145728),
 created_at timestamptz not null default now(),unique(issue_date,source_sha256)
);
create index samji_document_date_idx on prayer_app.samji_documents(issue_date desc,created_at desc);
create table prayer_app.samji_records(
 document_id uuid not null references prayer_app.samji_documents(id),owner_user_id uuid not null references prayer_app.users(id) on delete cascade,
 answers jsonb not null default '{}',notes jsonb not null default '[]',version integer not null default 1 check(version>0),updated_at timestamptz not null default now(),
 primary key(document_id,owner_user_id),check(jsonb_typeof(answers)='object'),check(jsonb_typeof(notes)='array')
);
create index samji_owner_updated_idx on prayer_app.samji_records(owner_user_id,updated_at desc);
alter table prayer_app.samji_documents enable row level security;
alter table prayer_app.samji_records enable row level security;
create policy deny_non_backend_access on prayer_app.samji_documents as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.samji_records as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.samji_documents,prayer_app.samji_records from public,anon,authenticated;
commit;
