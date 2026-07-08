-- Personal mute / block tags (MILESTONES §2): flair slugs the member never
-- wants in their feeds, independent of spoiler-free mode (always on, with a
-- per-post "show anyway").
--
-- Same shape and RLS path as spoiler_tags (migration 0013): a presentational
-- pref on the member's own profiles row; profiles_update_own already restricts
-- writes to your own row, we just extend the column-level update grant.
-- Idempotent so re-running (SQL editor or integration) is always safe.

alter table profiles add column if not exists muted_tags text[] not null default '{}';

grant update (muted_tags) on profiles to authenticated;
