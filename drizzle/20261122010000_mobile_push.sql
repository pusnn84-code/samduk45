begin;
create table prayer_app.web_push_settings(id integer primary key check(id=1),public_key text not null,private_key_ciphertext text not null,subject text not null);
create table prayer_app.push_devices(
 subscription_id uuid primary key references prayer_app.push_subscriptions(id) on delete cascade,
 preferences jsonb not null default '{"notices":true,"community":false,"reading":false,"pastoral":true,"personal":true}',
 last_test_at timestamptz,created_at timestamptz not null default now()
);
create table prayer_app.push_delivery_queue(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references prayer_app.push_subscriptions(id) on delete cascade,
 recipient_id uuid not null references prayer_app.users(id) on delete cascade,
 kind text not null check(kind in ('notice','community','reading','admin_prayer','admin_visit','admin_report','admin_question','own_visit','own_question')),
 source_key text not null,event_key text not null,topic text not null,
 state text not null default 'pending' check(state in ('pending','working','sent','cancelled','failed')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease uuid,lease_until timestamptz,
 created_at timestamptz not null default now(),finished_at timestamptz,
 unique(subscription_id,event_key)
);
create index push_delivery_due_idx on prayer_app.push_delivery_queue(next_attempt_at) where state in ('pending','working');
alter table prayer_app.web_push_settings enable row level security;
alter table prayer_app.push_devices enable row level security;
alter table prayer_app.push_delivery_queue enable row level security;
revoke all on prayer_app.web_push_settings,prayer_app.push_devices,prayer_app.push_delivery_queue from public,anon,authenticated;
create policy deny_non_backend_access on prayer_app.web_push_settings as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.push_devices as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.push_delivery_queue as restrictive for all to public using(false) with check(false);

create function prayer_app.enqueue_mobile_push(k text,src text,ev text,actor uuid,owner_id uuid default null) returns void language plpgsql set search_path=pg_catalog,prayer_app as $$
declare category text; pastor_id uuid;
begin
 category:=case when k='notice' then 'notices' when k='community' then 'community' when k='reading' then 'reading' when k like 'admin_%' then 'pastoral' else 'personal' end;
 select s.pastor_user_id into pastor_id from prayer_app.question_settings s where s.id=1;
 insert into prayer_app.push_delivery_queue(subscription_id,recipient_id,kind,source_key,event_key,topic)
 select p.id,p.user_id,k,src,ev,category from prayer_app.push_subscriptions p join prayer_app.push_devices d on d.subscription_id=p.id
 join prayer_app.users u on u.id=p.user_id and u.is_active
 where coalesce((d.preferences->>category)::boolean,false) and p.user_id is distinct from actor
 and (case when k like 'admin_%' then u.id=pastor_id and u.role='admin' when k like 'own_%' then u.id=owner_id else true end)
 on conflict(subscription_id,event_key) do nothing;
end $$;
revoke all on function prayer_app.enqueue_mobile_push(text,text,text,uuid,uuid) from public,anon,authenticated;

create function prayer_app.capture_mobile_push() returns trigger language plpgsql set search_path=pg_catalog,prayer_app as $$
declare q prayer_app.questions%rowtype; p uuid;
begin
 if tg_table_name='notices' then
  if new.status='published' and (tg_op='INSERT' or old.status is distinct from 'published') then perform prayer_app.enqueue_mobile_push('notice',new.id::text,'notice:'||new.id,new.author_user_id);end if;
 elsif tg_table_name='community_posts' then
  if new.published_at is not null and (tg_op='INSERT' or old.published_at is null) then perform prayer_app.enqueue_mobile_push('community',new.id::text,'community:'||new.id,new.author_user_id);end if;
 elsif tg_table_name='bible_reading_entries' then
  if nullif(btrim(new.sharing),'') is not null and (tg_op='INSERT' or nullif(btrim(old.sharing),'') is null) then perform prayer_app.enqueue_mobile_push('reading',new.sharing_id::text,'reading:'||new.sharing_id,new.user_id);end if;
 elsif tg_table_name='prayer_requests' then
  perform prayer_app.enqueue_mobile_push('admin_prayer',new.id::text,'prayer:'||new.id,new.user_id);
 elsif tg_table_name='visit_requests' then
  if tg_op='INSERT' and new.status='requested' then perform prayer_app.enqueue_mobile_push('admin_visit',new.id::text,'visit:'||new.id,new.requester_user_id);end if;
  if new.status='confirmed' and (tg_op='INSERT' or old.status is distinct from 'confirmed') then perform prayer_app.enqueue_mobile_push('own_visit',new.id::text,'visit-confirmed:'||new.id||':'||coalesce(new.confirmed_at,now())::text,null,new.requester_user_id);end if;
 elsif tg_table_name='pastoral_reports' then
  if new.submitted_at is not null and (tg_op='INSERT' or old.submitted_at is null) then perform prayer_app.enqueue_mobile_push('admin_report',new.id::text,'report:'||new.id,new.author_user_id);end if;
 elsif tg_table_name='question_messages' then
  select * into q from prayer_app.questions where id=new.question_id;
  select pastor_user_id into p from prayer_app.question_settings where id=1;
  if new.sender='member' then perform prayer_app.enqueue_mobile_push('admin_question',new.id::text,'question:'||new.id,q.owner_user_id);
  else perform prayer_app.enqueue_mobile_push('own_question',new.id::text,'question:'||new.id,p,q.owner_user_id);end if;
 end if;
 return new;
end $$;
revoke all on function prayer_app.capture_mobile_push() from public,anon,authenticated;
create trigger mobile_push_notice after insert or update of status on prayer_app.notices for each row execute function prayer_app.capture_mobile_push();
create trigger mobile_push_community after insert or update of published_at on prayer_app.community_posts for each row execute function prayer_app.capture_mobile_push();
create trigger mobile_push_reading after insert or update of sharing on prayer_app.bible_reading_entries for each row execute function prayer_app.capture_mobile_push();
create trigger mobile_push_prayer after insert on prayer_app.prayer_requests for each row execute function prayer_app.capture_mobile_push();
create trigger mobile_push_visit after insert or update of status on prayer_app.visit_requests for each row execute function prayer_app.capture_mobile_push();
create trigger mobile_push_report after insert or update of submitted_at on prayer_app.pastoral_reports for each row execute function prayer_app.capture_mobile_push();
create trigger mobile_push_question after insert on prayer_app.question_messages for each row execute function prayer_app.capture_mobile_push();
commit;
