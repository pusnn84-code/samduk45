begin;
do $$ begin
if exists(select 1 from prayer_app.bible_reading_entries old join prayer_app.bible_reading_entries current on current.user_id=old.user_id and current.reading_date=old.reading_date-350
  where old.reading_date between date '2027-01-11' and date '2027-11-13') then raise exception 'READING_DATE_COLLISION'; end if;
end $$;
-- Same reading unit, 350 days earlier; completion and sharing are retained.
update prayer_app.bible_reading_entries set reading_date=reading_date-350 where reading_date between date '2027-01-11' and date '2027-11-13';
commit;
