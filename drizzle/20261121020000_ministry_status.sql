begin;
alter table prayer_app.ministry_schedules add column if not exists status varchar(20) not null default 'confirmed';
alter table prayer_app.ministry_schedules add constraint ministry_schedule_status_check check (status in ('requested','confirmed'));
commit;
