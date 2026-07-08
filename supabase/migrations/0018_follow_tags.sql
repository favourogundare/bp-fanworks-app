-- Follow a tag (MILESTONES §2), part 1 of 2: add the notification enum value.
--
-- This is deliberately the ONLY statement in this migration: a value added by
-- `alter type ... add value` cannot be referenced later in the same
-- transaction, and each migration file runs as one transaction. The table,
-- RLS, and trigger that use 'tagged_post' live in 0019_follow_tags_hardening.
--
-- Numbered after 0017 (post_follows, already merged) on purpose: the develop
-- branch DB already has 0017 applied, so a lower number here would be an
-- out-of-order migration that `supabase db push` skips.

alter type notification_type add value if not exists 'tagged_post';
