begin;
alter table prayer_app.community_folders add column if not exists text_only boolean not null default false;
update prayer_app.community_folders set name='기도해요',text_only=true,sort_order=1 where name='자유게시판';
insert into prayer_app.community_folders(name,sort_order,text_only) select '우리의 이야기',0,false where not exists(select 1 from prayer_app.community_folders where name='우리의 이야기');
-- Preserve existing photos and drafts in the photo-and-text section.
update prayer_app.community_posts p set folder_id=(select id from prayer_app.community_folders where name='우리의 이야기'),version=version+1
where exists(select 1 from prayer_app.community_folders f where f.id=p.folder_id and f.text_only)
  and exists(select 1 from prayer_app.community_files x where x.post_id=p.id);
alter table prayer_app.bible_reading_entries add column if not exists sharing_anonymous boolean not null default false;
alter table prayer_app.bible_reading_entries add column if not exists anonymous_number integer;
create unique index if not exists bible_reading_anonymous_number_uq on prayer_app.bible_reading_entries(reading_date,anonymous_number) where anonymous_number is not null;
alter table prayer_app.bible_reading_entries add constraint bible_reading_anonymous_has_number check(not sharing_anonymous or anonymous_number is not null);
alter table prayer_app.bible_reading_entries drop constraint if exists bible_reading_entries_plan_year;
alter table prayer_app.bible_reading_entries add constraint bible_reading_entries_plan_year check(reading_date>=date '2026-01-01' and reading_date<date '2028-01-01');
commit;
