-- Optional directory fields only. No credentials, permissions or existing values change.
ALTER TABLE prayer_app.member_roster
  ADD COLUMN IF NOT EXISTS directory_age integer,
  ADD COLUMN IF NOT EXISTS directory_gender text,
  ADD COLUMN IF NOT EXISTS directory_family text,
  ADD COLUMN IF NOT EXISTS directory_group_role text;
