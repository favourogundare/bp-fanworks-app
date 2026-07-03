-- Spoiler-free mode (MILESTONES §2): a per-member toggle that hides posts
-- carrying any flair the member has marked as a spoiler tag.
--
--   spoiler_free — master on/off, so the tag list survives toggling the mode off.
--   spoiler_tags — flair slugs to hide when the mode is on.
--
-- Both are presentational prefs on the member's own row, same shape and RLS
-- path as blur_media (migration 0009): profiles_update_own already restricts
-- writes to your own row; we just extend the column-level update grant.

alter table profiles add column if not exists spoiler_free boolean not null default false;
alter table profiles add column if not exists spoiler_tags text[] not null default '{}';

grant update (spoiler_free, spoiler_tags) on profiles to authenticated;
