-- Widen photo capacity without modifying existing posts, files or drafts.
begin;
alter table prayer_app.community_files drop constraint community_files_slot_check;
alter table prayer_app.community_files add constraint community_files_slot_check check(slot between 0 and 9);
alter table prayer_app.community_post_edits drop constraint community_post_edits_files_check;
alter table prayer_app.community_post_edits add constraint community_post_edits_files_check check(jsonb_typeof(files)='array' and jsonb_array_length(files)<=10);
alter table prayer_app.community_post_edits drop constraint community_post_edits_check;
alter table prayer_app.community_post_edits add constraint community_post_edits_check check(keep_slots <@ array[0,1,2,3,4,5,6,7,8,9]::smallint[] and cardinality(keep_slots)+jsonb_array_length(files)<=10);
alter table prayer_app.community_edit_chunks drop constraint community_edit_chunks_slot_check;
alter table prayer_app.community_edit_chunks add constraint community_edit_chunks_slot_check check(slot between 0 and 9);
commit;
