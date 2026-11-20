begin;
alter table prayer_app.visit_requests add column if not exists end_date date;
alter table prayer_app.visit_requests add column if not exists all_day boolean not null default false;
alter table prayer_app.visit_requests add column if not exists recipient_leader_name varchar(100);
alter table prayer_app.visit_requests add constraint visit_request_end_range_check check (end_date is null or (end_date>=visit_date and end_date<=visit_date+365));
create index if not exists visit_requests_end_date_idx on prayer_app.visit_requests(end_date);
-- Existing end_date on ministry_schedules means recurrence cutoff. Preserve it.
alter table prayer_app.ministry_schedules add column if not exists event_end_date date;
alter table prayer_app.ministry_schedules add column if not exists all_day boolean not null default false;
alter table prayer_app.ministry_schedules add constraint ministry_event_end_range_check check (event_end_date is null or (event_end_date>=start_date and event_end_date<=start_date+365));
commit;
