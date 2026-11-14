begin;
alter table prayer_app.member_roster add column if not exists birth_date date;
alter table prayer_app.member_roster add column if not exists is_deputy_admin boolean not null default false;
create index if not exists member_roster_birthday_idx on prayer_app.member_roster ((extract(month from birth_date)::int*100+extract(day from birth_date)::int)) where is_active and birth_date is not null;
commit;
