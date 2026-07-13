-- Post archive / vault (MILESTONES §4): authors archive their own posts
-- (AO3-style) — hidden from feeds, tag pages, and search, but still
-- viewable by direct link, and listed in an "Archived" tab on the
-- author's own profile.
--
-- archived_at doubles as flag and sort key (null = not archived).
-- Hiding is query-level (clients filter archived_at is null), NOT RLS:
-- posts_select stays world-readable so direct links keep working, and
-- authors set/clear archived_at through the existing posts_update_own
-- path — their own rows only. No new policies, no grant changes.
-- Idempotent.

alter table posts add column if not exists archived_at timestamptz;
