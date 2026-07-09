-- Content warning system (MILESTONES §3): authors flag posts with warnings
-- ("Violence", "Character death", …); everyone else sees the body and media
-- gated behind a warning box until they click through. Title and flairs stay
-- visible so readers can decide.
--
-- One text[] on posts — same posture as poll_options. Authors write it at
-- compose time; posts already carry default table grants (RLS posts_insert_own
-- / posts_update_own scope writes), so no grant changes. Idempotent.

alter table posts add column if not exists content_warnings text[] not null default '{}';
