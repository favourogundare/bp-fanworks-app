-- 0051 achievements engine (MILESTONES §8)
-- Rules live in `achievements` as data, awards in `user_achievements`.
-- No triggers: sync_achievements() recomputes one profile on profile load.
-- Idempotent, no backfill needed. Run after 0001-0050.

-- Rules. `metric` is plain text: the valid names are the keys in
-- sync_achievements() below; an unknown one just never qualifies.
create table if not exists achievements (
  slug        text primary key,
  name        text not null,
  description text not null,
  icon        text not null default '🏆',
  metric      text not null,
  threshold   integer not null check (threshold > 0),
  sort_order  integer not null default 0
);

-- Awards. Written only by the definer function below (no insert grant).
create table if not exists user_achievements (
  profile_id uuid not null references profiles(id)      on delete cascade,
  slug       text not null references achievements(slug) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (profile_id, slug)
);

-- Counting a member's comments was a seq scan (0001 indexes post + parent only).
create index if not exists comments_author_idx on comments (author_id);

alter table achievements      enable row level security;
alter table user_achievements enable row level security;

-- Badges are public on profiles.
drop policy if exists achievements_public_read on achievements;
create policy achievements_public_read on achievements for select using (true);

drop policy if exists user_achievements_public_read on user_achievements;
create policy user_achievements_public_read on user_achievements for select using (true);

-- Rule set. do update so re-running refreshes copy/thresholds.
insert into achievements (slug, name, description, icon, metric, threshold, sort_order) values
  ('first-post',       'First Post',        'Published your first post.',          '📝', 'posts',            1,   10),
  ('storyteller',      'Storyteller',       'Published 10 posts.',                 '📚', 'posts',            10,  11),
  ('prolific',         'Prolific',          'Published 50 posts.',                 '🖋️', 'posts',            50,  12),
  ('conversationalist','Conversationalist', 'Left 10 comments.',                   '💬', 'comments',         10,  20),
  ('community-voice',  'Community Voice',   'Left 100 comments.',                  '📣', 'comments',         100, 21),
  ('rising-star',      'Rising Star',       'Earned 100 karma.',                   '⭐', 'karma',            100, 30),
  ('community-pillar', 'Community Pillar',  'Earned 1,000 karma.',                 '🏛️', 'karma',            1000,31),
  ('gathering-crowd',  'Gathering a Crowd', 'Reached 10 followers.',               '👥', 'followers',        10,  40),
  ('beloved',          'Beloved',           'Reached 100 followers.',              '💛', 'followers',        100, 41),
  ('supporter',        'Supporter',         'Voted on 50 posts or comments.',      '🤝', 'votes_given',      50,  50),
  ('lore-keeper',      'Lore Keeper',       'Made 5 edits to the community wiki.', '📖', 'wiki_edits',       5,   60),
  ('circle-founder',   'Circle Founder',    'Founded a Circle.',                   '🔵', 'circles_created',  1,   70),
  ('one-year',         'One Year In',       'A member for a full year.',           '🎂', 'account_age_days', 365, 80)
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  icon        = excluded.icon,
  metric      = excluded.metric,
  threshold   = excluded.threshold,
  sort_order  = excluded.sort_order;

-- Awards what's newly earned, returns the whole rule set: earned rows carry
-- earned_at, the rest carry the member's current value (progress).
-- security definer so members can't write their own badge rows.
create or replace function sync_achievements(p_profile uuid)
returns table (
  slug        text,
  name        text,
  description text,
  icon        text,
  threshold   integer,
  value       integer,
  earned_at   timestamptz
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare m jsonb;
begin
  if p_profile is null or not exists (select 1 from profiles where id = p_profile) then
    return;
  end if;

  -- These keys are the vocabulary of achievements.metric.
  select jsonb_build_object(
    'posts',            (select count(*) from posts          where author_id = p_profile),
    'comments',         (select count(*) from comments       where author_id = p_profile),
    'karma',            greatest(pr.karma, 0),
    'followers',        (select count(*) from relationships  where target_id = p_profile and type = 'follow'),
    'votes_given',      (select count(*) from votes          where voter_id  = p_profile),
    'wiki_edits',       (select count(*) from wiki_revisions where editor_id = p_profile),
    'circles_created',  (select count(*) from circles        where creator_id = p_profile),
    'account_age_days', floor(extract(epoch from now() - pr.created_at) / 86400)
  ) into m
  from profiles pr where pr.id = p_profile;

  insert into user_achievements (profile_id, slug)
  select p_profile, a.slug from achievements a
  where coalesce((m ->> a.metric)::numeric, 0) >= a.threshold
  on conflict do nothing;

  return query
    select a.slug, a.name, a.description, a.icon, a.threshold,
           coalesce((m ->> a.metric)::numeric, 0)::integer,
           ua.earned_at
    from achievements a
    left join user_achievements ua on ua.slug = a.slug and ua.profile_id = p_profile
    order by a.sort_order, a.threshold;
end;
$$;

grant select on achievements      to anon, authenticated;
grant select on user_achievements to anon, authenticated;
grant execute on function sync_achievements(uuid) to anon, authenticated;
