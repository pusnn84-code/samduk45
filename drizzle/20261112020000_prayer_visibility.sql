alter table prayer_app.prayer_requests add column if not exists visibility text not null default 'private';
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='prayer_app.prayer_requests'::regclass and conname='prayer_request_visibility_check') then
  alter table prayer_app.prayer_requests add constraint prayer_request_visibility_check check (visibility in ('private','public','anonymous'));
 end if;
end $$;
create index if not exists prayer_requests_public_created_idx on prayer_app.prayer_requests(created_at desc,id desc) where visibility in ('public','anonymous');
