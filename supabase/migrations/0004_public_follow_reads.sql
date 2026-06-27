-- =============================================================================
-- Black Panther Fanworks — 0004 public follow reads
-- Follows are public (so follower counts are accurate for everyone), but mute
-- and block rows stay visible only to the two parties involved. Run in the
-- Supabase SQL Editor.
-- =============================================================================

drop policy if exists relationships_select_own on relationships;

create policy relationships_select on relationships for select
  using (
    type = 'follow'
    or actor_id = current_profile_id()
    or target_id = current_profile_id()
  );
