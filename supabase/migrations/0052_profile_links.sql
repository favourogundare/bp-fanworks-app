-- Profile links (§7): optional Tumblr and Twitter/X links on the profile sidebar.
--
-- Mirrors the ao3_url / kofi_url creator links from 0009 — nullable text columns
-- shown as external links on the public profile, with https-only validation
-- enforced client-side at the trust boundary (they render as hrefs). The
-- profiles_update_own RLS policy (0001) already restricts updates to your own
-- row; this only extends the column-level update grant to the two new columns,
-- matching how 0013/0027/0035 each granted update on just their own columns.
-- Idempotent; run after 0001-0050.

alter table profiles add column if not exists tumblr_url  text;
alter table profiles add column if not exists twitter_url text;

grant update (tumblr_url, twitter_url) on profiles to authenticated;
