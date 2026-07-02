-- Soft-delete for comments.
-- Hard-deleting a comment cascades to its child replies (on delete cascade on
-- comments.parent_id), which destroys other members' replies. Instead we keep
-- the row and blank its content, so the thread below it survives.
--
-- The existing comments_update_own RLS policy already lets an author update
-- their own row, so no new policy is needed — the author sets deleted_at via
-- the same path as an edit.

alter table comments add column if not exists deleted_at timestamptz;
