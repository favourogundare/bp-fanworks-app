-- Profile editing panel: creator links, content preference, and username change.
--
-- New columns:
--   ao3_url / kofi_url — optional creator links shown on the profile sidebar.
--   blur_media         — personal preference: blur NSFW/spoiler media in feeds
--                        (defaults on, matching current behavior).
--
-- Username change: username was intentionally left out of the column grant in
-- 0001 (immutable). The profile editing panel now allows changing it; the
-- existing citext unique constraint rejects collisions, and the client
-- validates format (3-20 chars, alphanumeric + underscore). The
-- profiles_update_own RLS policy already restricts updates to your own row.

alter table profiles add column if not exists ao3_url    text;
alter table profiles add column if not exists kofi_url   text;
alter table profiles add column if not exists blur_media boolean not null default true;

grant update (username, ao3_url, kofi_url, blur_media) on profiles to authenticated;
