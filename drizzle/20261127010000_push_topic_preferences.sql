begin;
create or replace function prayer_app.enqueue_mobile_push(k text,src text,ev text,actor uuid,owner_id uuid default null) returns void language plpgsql set search_path=pg_catalog,prayer_app as $$
declare category text; pastor_id uuid;
begin
 category:=case k when 'notice' then 'notices' when 'community' then 'community' when 'reading' then 'reading' when 'admin_report' then 'reports' when 'admin_visit' then 'visits' when 'admin_prayer' then 'prayers' when 'admin_question' then 'questions' when 'admin_notice_confirmation' then 'confirmations' else 'personal' end;
 select s.pastor_user_id into pastor_id from prayer_app.question_settings s where s.id=1;
 insert into prayer_app.push_delivery_queue(subscription_id,recipient_id,kind,source_key,event_key,topic)
 select p.id,p.user_id,k,src,ev,category from prayer_app.push_subscriptions p join prayer_app.push_devices d on d.subscription_id=p.id join prayer_app.users u on u.id=p.user_id and u.is_active
 where (case when k like 'admin_%' then coalesce((d.preferences->>'pastoral')::boolean,false) and coalesce((d.preferences->>category)::boolean,true) else coalesce((d.preferences->>category)::boolean,false) end)
 and p.user_id is distinct from actor
 and (case when k like 'admin_%' then u.id=pastor_id and u.role='admin' when k like 'own_%' then u.id=owner_id else true end)
 on conflict(subscription_id,event_key) do nothing;
end $$;
revoke all on function prayer_app.enqueue_mobile_push(text,text,text,uuid,uuid) from public,anon,authenticated;
commit;
