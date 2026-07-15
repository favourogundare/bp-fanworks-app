-- Scheduled posts (MILESTONES §9 mod toolkit): an author schedules a post to
-- go live later. Infra-free — no cron. A scheduled post is inserted normally
-- but hidden from everyone except its author until its time; it "publishes"
-- automatically once now() >= scheduled_at, because the SELECT policy starts
-- letting it through. One RLS policy covers every read path (feeds, tag,
-- profile, search, single post, collections, and the crawler middleware via the
-- anon key). Idempotent.
--
-- NOTE: this runs after 0041_circles_p2, which set posts_select to enforce
-- private-circle visibility via can_see_circle(circle_id). We must preserve
-- that check, so the policy ANDs circle visibility with the scheduling gate —
-- dropping either would leak private-circle or not-yet-published posts.

alter table posts add column if not exists scheduled_at timestamptz;

drop policy if exists posts_select on posts;
create policy posts_select on posts for select using (
  can_see_circle(circle_id)
  and (
    scheduled_at is null
    or scheduled_at <= now()
    or author_id = current_profile_id()   -- the author always sees their own
  )
);
