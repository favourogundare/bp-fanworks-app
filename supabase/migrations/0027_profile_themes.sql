-- 0027_profile_themes.sql
-- Custom profile themes: a member picks one of a small curated set of accent
-- presets for their own profile page; visitors see it too (profiles are
-- world-readable via profiles_select).
--
-- profile_theme holds a preset slug, null = default look. The CHECK is the
-- server-side "presets only" rule (no arbitrary values even via raw API).
-- The existing profiles_update_own RLS policy already scopes writes to your
-- own row; we just extend the column-level update grant (same pattern as
-- 0013 spoiler prefs and 0020 muted tags). Idempotent.

alter table profiles add column if not exists profile_theme text;

alter table profiles drop constraint if exists profiles_profile_theme_check;
alter table profiles add constraint profiles_profile_theme_check
  check (profile_theme is null
         or profile_theme in ('vibranium', 'gold', 'dora', 'river', 'herb'));

grant update (profile_theme) on profiles to authenticated;
