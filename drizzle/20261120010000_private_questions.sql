-- Private conversations have a designated pastor, never an implicit all-admin grant.
create table prayer_app.question_settings (
 id integer primary key check (id = 1),
 pastor_user_id uuid references prayer_app.users(id) on delete restrict
);
insert into prayer_app.question_settings(id) values (1);
create table prayer_app.questions (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references prayer_app.users(id) on delete restrict,
 title text not null check (char_length(title) between 1 and 100),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 owner_read_id bigint not null default 0,
 pastor_read_id bigint not null default 0
);
create index questions_owner_updated_idx on prayer_app.questions(owner_user_id, updated_at desc);
create index questions_updated_idx on prayer_app.questions(updated_at desc);
create table prayer_app.question_messages (
 id bigint generated always as identity primary key,
 question_id uuid not null references prayer_app.questions(id) on delete cascade,
 sender text not null check (sender in ('member','pastor')),
 content text not null check (char_length(content) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index question_messages_thread_idx on prayer_app.question_messages(question_id,id desc);
alter table prayer_app.question_settings enable row level security;
alter table prayer_app.questions enable row level security;
alter table prayer_app.question_messages enable row level security;
revoke all on prayer_app.question_settings, prayer_app.questions, prayer_app.question_messages from public, anon, authenticated;
revoke all on sequence prayer_app.question_messages_id_seq from public, anon, authenticated;
