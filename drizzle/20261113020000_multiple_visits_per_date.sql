-- Preserve every visit row and ID while allowing multiple requests/appointments per date.
create index if not exists visit_requests_active_date_idx
  on prayer_app.visit_requests(visit_date) where status <> 'cancelled';
drop index if exists prayer_app.visit_requests_active_date_uq;
