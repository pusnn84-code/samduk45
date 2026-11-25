begin;
set local lock_timeout='3s';
alter table prayer_app.ministry_schedules drop constraint ministry_schedules_repeat_check;
alter table prayer_app.ministry_schedules add constraint ministry_schedules_repeat_check check (repeat in ('none','weekly','biweekly'));
commit;
