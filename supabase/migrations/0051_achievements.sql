-- 0051 achievements engine (MILESTONES §8)
-- Reddit-shaped: 10 tracks x 4 tiers, grouped in categories, each member pins
-- up to 3 to their profile. Rules live in `achievements` as data, awards in
-- `user_achievements`.
-- No triggers: sync_achievements() recomputes one profile on demand.
-- Idempotent, no backfill needed. Safe to re-run. Run after 0001-0050.

-- Rules. `metric` is plain text: valid names are the keys in
-- sync_achievements() below; an unknown one just never qualifies.
-- A track is one ladder (poster I-IV); tier is the rung.
create table if not exists achievements (
  slug        text primary key,
  name        text not null,
  description text not null,
  icon        text not null default '🏆',
  metric      text not null,
  threshold   integer not null check (threshold > 0),
  sort_order  integer not null default 0
);

-- Added after the flat first cut; `if not exists` so a re-run is a no-op.
alter table achievements add column if not exists category text not null default 'Community';
alter table achievements add column if not exists track    text not null default 'misc';
alter table achievements add column if not exists tier     smallint not null default 1;

-- Awards. Written only by the definer functions below (no insert grant).
create table if not exists user_achievements (
  profile_id uuid not null references profiles(id)      on delete cascade,
  slug       text not null references achievements(slug) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (profile_id, slug)
);

-- Trophy case: up to 3 badges the member shows on their profile.
alter table user_achievements add column if not exists pinned boolean not null default false;

-- Counting a member's comments was a seq scan (0001 indexes post + parent only).
create index if not exists comments_author_idx on comments (author_id);

alter table achievements      enable row level security;
alter table user_achievements enable row level security;

-- Badges are public on profiles.
drop policy if exists achievements_public_read on achievements;
create policy achievements_public_read on achievements for select using (true);

drop policy if exists user_achievements_public_read on user_achievements;
create policy user_achievements_public_read on user_achievements for select using (true);

-- Catalog: 10 tracks x 4 tiers. do update refreshes copy/thresholds on re-run;
-- the delete drops rules no longer in the catalog (cascades to their awards),
-- which is how the flat 13-badge first cut gets cleaned up.
with rules (slug, name, description, icon, category, track, tier, metric, threshold) as (values
  ('poster-1',    'First Post',           'Published your first post.',              '📝', 'Posting',    'poster',           1, 'posts',            1),
  ('poster-2',    'Storyteller',          'Published 10 posts.',                     '📝', 'Posting',    'poster',           2, 'posts',            10),
  ('poster-3',    'Prolific',             'Published 50 posts.',                     '📝', 'Posting',    'poster',           3, 'posts',            50),
  ('poster-4',    'Chronicler',           'Published 200 posts.',                    '📝', 'Posting',    'poster',           4, 'posts',            200),

  ('commenter-1', 'First Word',           'Left your first comment.',                '💬', 'Commenting', 'commenter',        1, 'comments',         1),
  ('commenter-2', 'Conversationalist',    'Left 25 comments.',                       '💬', 'Commenting', 'commenter',        2, 'comments',         25),
  ('commenter-3', 'Community Voice',      'Left 100 comments.',                      '💬', 'Commenting', 'commenter',        3, 'comments',         100),
  ('commenter-4', 'Griot',                'Left 500 comments.',                      '💬', 'Commenting', 'commenter',        4, 'comments',         500),

  ('karma-1',     'Rising Star',          'Earned 100 karma.',                       '⭐', 'Karma',      'karma',            1, 'karma',            100),
  ('karma-2',     'Well Regarded',        'Earned 500 karma.',                       '⭐', 'Karma',      'karma',            2, 'karma',            500),
  ('karma-3',     'Community Pillar',     'Earned 2,500 karma.',                     '⭐', 'Karma',      'karma',            3, 'karma',            2500),
  ('karma-4',     'Legend of Wakanda',    'Earned 10,000 karma.',                    '⭐', 'Karma',      'karma',            4, 'karma',            10000),

  ('praised-1',   'Appreciated',          'Received 10 upvotes on your work.',       '🔥', 'Karma',      'praised',          1, 'votes_received',   10),
  ('praised-2',   'Crowd Favorite',       'Received 100 upvotes on your work.',      '🔥', 'Karma',      'praised',          2, 'votes_received',   100),
  ('praised-3',   'Fan Favorite',         'Received 1,000 upvotes on your work.',    '🔥', 'Karma',      'praised',          3, 'votes_received',   1000),
  ('praised-4',   'Wakanda''s Finest',    'Received 5,000 upvotes on your work.',    '🔥', 'Karma',      'praised',          4, 'votes_received',   5000),

  ('followed-1',  'Noticed',              'Reached 5 followers.',                    '👥', 'Community',  'followed',         1, 'followers',        5),
  ('followed-2',  'Gathering a Crowd',    'Reached 25 followers.',                   '👥', 'Community',  'followed',         2, 'followers',        25),
  ('followed-3',  'Beloved',              'Reached 100 followers.',                  '👥', 'Community',  'followed',         3, 'followers',        100),
  ('followed-4',  'Icon',                 'Reached 500 followers.',                  '👥', 'Community',  'followed',         4, 'followers',        500),

  ('supporter-1', 'Supporter',            'Voted on 10 posts or comments.',          '🤝', 'Community',  'supporter',        1, 'votes_given',      10),
  ('supporter-2', 'Booster',              'Voted on 100 posts or comments.',         '🤝', 'Community',  'supporter',        2, 'votes_given',      100),
  ('supporter-3', 'Champion',             'Voted on 500 posts or comments.',         '🤝', 'Community',  'supporter',        3, 'votes_given',      500),
  ('supporter-4', 'Hype Squad',           'Voted on 2,000 posts or comments.',       '🤝', 'Community',  'supporter',        4, 'votes_given',      2000),

  ('wiki-1',      'Scribe',               'Made your first wiki edit.',              '📖', 'Community',  'wiki',             1, 'wiki_edits',       1),
  ('wiki-2',      'Lore Keeper',          'Made 10 wiki edits.',                     '📖', 'Community',  'wiki',             2, 'wiki_edits',       10),
  ('wiki-3',      'Archivist',            'Made 50 wiki edits.',                     '📖', 'Community',  'wiki',             3, 'wiki_edits',       50),
  ('wiki-4',      'Loremaster',           'Made 200 wiki edits.',                    '📖', 'Community',  'wiki',             4, 'wiki_edits',       200),

  ('circles-1',   'Circle Founder',       'Founded a Circle.',                       '🔵', 'Community',  'circles',          1, 'circles_created',  1),
  ('circles-2',   'Circle Builder',       'Founded 3 Circles.',                      '🔵', 'Community',  'circles',          2, 'circles_created',  3),
  ('circles-3',   'Circle Architect',     'Founded 5 Circles.',                      '🔵', 'Community',  'circles',          3, 'circles_created',  5),
  ('circles-4',   'Circle Visionary',     'Founded 10 Circles.',                     '🔵', 'Community',  'circles',          4, 'circles_created',  10),

  ('coauthor-1',  'Collaborator',         'Credited on a joint work.',               '✍️', 'Posting',    'coauthor',         1, 'coauthored',       1),
  ('coauthor-2',  'Co-Creator',           'Credited on 5 joint works.',              '✍️', 'Posting',    'coauthor',         2, 'coauthored',       5),
  ('coauthor-3',  'Creative Partner',     'Credited on 20 joint works.',             '✍️', 'Posting',    'coauthor',         3, 'coauthored',       20),
  ('coauthor-4',  'Dream Team',           'Credited on 50 joint works.',             '✍️', 'Posting',    'coauthor',         4, 'coauthored',       50),

  ('tenure-1',    'Newcomer',             'A member for 30 days.',                   '🎂', 'Membership', 'tenure',           1, 'account_age_days', 30),
  ('tenure-2',    'Regular',              'A member for 6 months.',                  '🎂', 'Membership', 'tenure',           2, 'account_age_days', 180),
  ('tenure-3',    'One Year In',          'A member for a full year.',               '🎂', 'Membership', 'tenure',           3, 'account_age_days', 365),
  ('tenure-4',    'Elder',                'A member for 3 years.',                   '🎂', 'Membership', 'tenure',           4, 'account_age_days', 1095)
),
upsert as (
  insert into achievements (slug, name, description, icon, category, track, tier, metric, threshold, sort_order)
  select slug, name, description, icon, category, track, tier, metric, threshold, threshold from rules
  on conflict (slug) do update set
    name        = excluded.name,
    description = excluded.description,
    icon        = excluded.icon,
    category    = excluded.category,
    track       = excluded.track,
    tier        = excluded.tier,
    metric      = excluded.metric,
    threshold   = excluded.threshold,
    sort_order  = excluded.sort_order
  returning 1
)
delete from achievements where slug not in (select slug from rules);

-- After the catalog is in place: every rule now has a real track/tier, so the
-- one-row-per-rung rule can be enforced. (Before the seed, upgraded rows still
-- carry the 'misc' default and would collide.)
create unique index if not exists achievements_track_tier_idx on achievements (track, tier);

-- Awards what's newly earned, returns the whole catalog: earned rows carry
-- earned_at, the rest carry the member's current value (progress).
-- is_new marks what THIS call awarded, so the client can toast it.
-- security definer so members can't write their own badge rows.
-- Dropped first: the OUT params changed since the flat first cut, and
-- `create or replace` can't change a function's return type.
drop function if exists sync_achievements(uuid);
create or replace function sync_achievements(p_profile uuid)
returns table (
  slug        text,
  name        text,
  description text,
  icon        text,
  category    text,
  track       text,
  tier        smallint,
  threshold   integer,
  value       integer,
  earned_at   timestamptz,
  pinned      boolean,
  is_new      boolean
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  m jsonb;
  v_new text[];
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
    'coauthored',       (select count(*) from post_coauthors where profile_id = p_profile),
    'votes_received',   (select count(*) from votes v where v.value = 1 and (
                           (v.target_type = 'post'    and v.target_id in (select id from posts    where author_id = p_profile)) or
                           (v.target_type = 'comment' and v.target_id in (select id from comments where author_id = p_profile)))),
    'account_age_days', floor(extract(epoch from now() - pr.created_at) / 86400)
  ) into m
  from profiles pr where pr.id = p_profile;

  with ins as (
    insert into user_achievements (profile_id, slug)
    select p_profile, a.slug from achievements a
    where coalesce((m ->> a.metric)::numeric, 0) >= a.threshold
    on conflict do nothing
    returning slug
  )
  select array_agg(slug) into v_new from ins;

  return query
    select a.slug, a.name, a.description, a.icon, a.category, a.track, a.tier, a.threshold,
           coalesce((m ->> a.metric)::numeric, 0)::integer,
           ua.earned_at,
           coalesce(ua.pinned, false),
           a.slug = any(coalesce(v_new, '{}'::text[]))
    from achievements a
    left join user_achievements ua on ua.slug = a.slug and ua.profile_id = p_profile
    order by a.category, a.track, a.tier;
end;
$$;

-- Trophy case: replace the caller's pinned set. Max 3, earned badges only.
create or replace function set_pinned_achievements(p_slugs text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := current_profile_id();
begin
  if v_me is null then raise exception 'Not signed in'; end if;
  if coalesce(array_length(p_slugs, 1), 0) > 3 then
    raise exception 'You can pin at most 3 achievements';
  end if;

  update user_achievements set pinned = false where profile_id = v_me and pinned;
  update user_achievements set pinned = true
    where profile_id = v_me and slug = any(coalesce(p_slugs, '{}'::text[]));
end;
$$;

grant select on achievements      to anon, authenticated;
grant select on user_achievements to anon, authenticated;
grant execute on function sync_achievements(uuid)        to anon, authenticated;
grant execute on function set_pinned_achievements(text[]) to authenticated;
