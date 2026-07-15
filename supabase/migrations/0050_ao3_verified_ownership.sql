-- =============================================================================
-- Black Panther Fanworks — 0050 mod-verified AO3 ownership
-- AO3 *linking* already shipped (0009: profiles.ao3_url). This adds a
-- moderator-confirmed "verified" flag on top: a mod eyeballs the linked AO3
-- account and flips the flag; the profile then shows a "verified by mods"
-- indicator next to the AO3 link.
--
-- ao3_verified / ao3_verified_at are NOT in the profiles column-level update
-- grant (0001), so only the definer RPC below can set them — a member cannot
-- self-verify via a raw API call. Mirrors the banned_at pattern in 0044.
-- Every write logs to the mod action log (0042). Idempotent throughout, per
-- DB health rules. Run after 0001-0049.
-- =============================================================================

alter table profiles add column if not exists ao3_verified    boolean not null default false;
alter table profiles add column if not exists ao3_verified_at timestamptz;

-- Set (or clear) a profile's mod-verified AO3 flag. Refuses to verify a profile
-- with no AO3 account linked — you can't vouch for an account that isn't there.
-- The acting mod is recorded by log_mod_action (mod_actions.mod_id), matching
-- how 0044 handles bans; the verified AO3 URL goes in `detail` for audit context.
create or replace function mod_set_ao3_verified(p_profile uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_ao3 text;
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;

  select ao3_url into v_ao3 from profiles where id = p_profile;
  if p_verified and v_ao3 is null then
    raise exception 'Cannot verify: no AO3 account linked';
  end if;

  update profiles set
    ao3_verified    = p_verified,
    ao3_verified_at = case when p_verified then now() else null end
  where id = p_profile;

  perform log_mod_action(
    case when p_verified then 'verify_ao3' else 'unverify_ao3' end,
    'profile', p_profile,
    case when p_verified then coalesce(v_ao3, '') else '' end);
end;
$$;
