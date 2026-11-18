-- Preserve every existing prayer and publication setting; add private+anonymous.
alter table prayer_app.prayer_requests drop constraint if exists prayer_request_visibility_check;
alter table prayer_app.prayer_requests add constraint prayer_request_visibility_check
  check (visibility in ('private','public','anonymous','private_anonymous'));
