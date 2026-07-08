-- Follow a tag (MILESTONES §2), part 1 of 2: add the notification enum value.
--
-- This is deliberately the ONLY statement in this migration: a value added by
-- `alter type ... add value` cannot be referenced later in the same
-- transaction, and each migration file runs as one transaction. The table,
-- RLS, and trigger that use 'tagged_post' live in 0018_follow_tags_hardening.

alter type notification_type add value if not exists 'tagged_post';
