begin;
alter table prayer_app.push_delivery_queue drop constraint push_delivery_queue_kind_check;
alter table prayer_app.push_delivery_queue add constraint push_delivery_queue_kind_check check(kind in ('notice','community','reading','admin_prayer','admin_visit','admin_report','admin_question','own_visit','own_question','admin_notice_confirmation'));
create function prayer_app.capture_notice_confirmation_push() returns trigger language plpgsql set search_path=pg_catalog,prayer_app as $$
declare source text;
begin
 if new.confirmed_by_user_id is not null and (tg_op='INSERT' or new.notice_revision is distinct from old.notice_revision) then
  source:=new.notice_id::text||':'||new.roster_id::text||':'||new.notice_revision;
  perform prayer_app.enqueue_mobile_push('admin_notice_confirmation',source,'notice-confirmed:'||source,new.confirmed_by_user_id);
 end if;
 return new;
end $$;
revoke all on function prayer_app.capture_notice_confirmation_push() from public,anon,authenticated;
create trigger mobile_push_notice_confirmation after insert or update on prayer_app.notice_confirmations for each row execute function prayer_app.capture_notice_confirmation_push();
commit;
