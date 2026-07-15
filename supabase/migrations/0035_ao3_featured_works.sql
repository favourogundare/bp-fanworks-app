-- AO3 linking (MILESTONES §7): the AO3 profile link (ao3_url) already ships
-- from 0009; this adds a member's featured AO3 work links. Same posture as the
-- other presentational profile prefs: a text[] on the member's own row, behind
-- the existing profiles_update_own RLS with the column added to the update
-- grant. Idempotent.

alter table profiles add column if not exists ao3_works text[] not null default '{}';

grant update (ao3_works) on profiles to authenticated;
