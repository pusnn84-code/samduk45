-- Keep all existing posts, photos, drafts, likes and comments in the unified feed.
-- Retain the storage references for older links and clients.
update prayer_app.community_folders set text_only=false where text_only;
