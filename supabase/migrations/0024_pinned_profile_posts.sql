-- Pinned profile posts (MILESTONES §7): members pin their own posts to the
-- top of their profile; multiple pins, newest pin first, unpin anytime.
--
-- profile_pinned_at doubles as flag and sort key (null = not pinned).
-- Distinct from posts.pinned, which is the MOD community-highlights pin.
-- Authors write it through the existing posts_update_own RLS path — their
-- own rows only, no grant changes. Idempotent.

alter table posts add column if not exists profile_pinned_at timestamptz;
