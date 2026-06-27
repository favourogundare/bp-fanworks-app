-- =============================================================================
-- Black Panther Fanworks — 0002 demo content (OPTIONAL)
-- Seeds themed demo members, the prototype's sample posts, nested comments, and
-- the pinned community highlights so the feed isn't empty while wiring up.
--
-- These demo members have no login (user_id is null). Safe to wipe before launch:
--   delete from profiles where user_id is null;   -- cascades to their posts/comments
--
-- Note: the vote_score / karma numbers below are cosmetic seed values to match the
-- prototype. They'll recompute from real votes once members start voting.
-- Run AFTER 0001, in the Supabase SQL Editor.
-- =============================================================================

do $seed$
declare
  f_discussion uuid; f_art uuid; f_cosplay uuid; f_news uuid;
  mf_wkabi uuid;
  p_white uuid; p_golden uuid; p_iposta uuid; p_art uuid; p_dora uuid; p_vibr uuid; p_wak uuid;
  post1 uuid; post2 uuid; post3 uuid; post4 uuid; post_marvel uuid;
  c_q uuid;
begin
  -- Guard against double-seeding.
  if exists (select 1 from profiles where username = 'whitemisandry') then
    raise notice 'Demo content already seeded; skipping.';
    return;
  end if;

  select id into f_discussion from flairs where scope = 'post'   and slug = 'discussion';
  select id into f_art        from flairs where scope = 'post'   and slug = 'art';
  select id into f_cosplay    from flairs where scope = 'post'   and slug = 'cosplay';
  select id into f_news       from flairs where scope = 'post'   and slug = 'news';
  select id into mf_wkabi     from flairs where scope = 'member' and slug = 'wkabi-stan';

  -- ----- demo members -------------------------------------------------------
  insert into profiles (username, display_name, role, member_flair_id, karma, gold_earned)
    values ('whitemisandry', 'All Hail King Killmonger', 'mod', mf_wkabi, 2629, 25)
    returning id into p_white;
  insert into profiles (username, display_name) values ('goldenjaguar88', 'goldenjaguar88') returning id into p_golden;
  insert into profiles (username, display_name) values ('ipostatrandom', 'ipostatrandom')   returning id into p_iposta;
  insert into profiles (username, display_name) values ('goldjaguar_art', 'goldjaguar_art') returning id into p_art;
  insert into profiles (username, display_name) values ('dora_milaje_irl', 'dora_milaje_irl') returning id into p_dora;
  insert into profiles (username, display_name) values ('vibraniumheart', 'vibraniumheart') returning id into p_vibr;
  insert into profiles (username, display_name) values ('wakanda4ever', 'wakanda4ever')     returning id into p_wak;

  -- ----- community posts ----------------------------------------------------
  insert into posts (author_id, surface, type, title, body, vote_score, view_count)
    values (p_white, 'community', 'text', 'Hot Takes: MCU Black Panther Wakanda Forever',
$b$About Me: I am a Black American Woman who was born in Nigeria before my family immigrated, who has written 60+ fanfic for BP and has an entire worldbuilding document.

Here are my hot takes — and yes, one of them is that Michael B. Jordan was miscast as Killmonger. Bite me. Reasoning in the comments if anyone actually wants to engage in good faith.$b$,
      20, 4400)
    returning id into post1;

  insert into posts (author_id, surface, type, title, body, vote_score, view_count)
    values (p_white, 'community', 'text', 'Hot Takes: MCU Black Panther 1 edition',
$b$About Me: I am a Black American Woman who was born in Nigeria before my family immigrated, who has written 60+ fanfic for BP and has an entire worldbuilding document. Round one of my hot takes — the throne fight pacing, the CIA of it all, and why the ancestral plane deserved more screen time...$b$,
      14, 5500)
    returning id into post2;

  insert into posts (author_id, surface, type, title, body, vote_score, media)
    values (p_art, 'community', 'image', '[OC] Shuri redesign — gold and obsidian armor study',
$b$Spent the weekend on a what-if armor for Shuri taking the mantle. Gold leaf over black with a little vibranium glow. Crit welcome!$b$,
      88, '["placeholder"]')
    returning id into post3;

  insert into posts (author_id, surface, type, title, body, vote_score, media)
    values (p_dora, 'community', 'image', 'My Okoye cosplay for the con this weekend!',
$b$Six months of foam-smithing for this spear. Wakanda forever 🛡️$b$,
      132, '["placeholder"]')
    returning id into post4;

  -- ----- pinned community highlights ----------------------------------------
  insert into posts (author_id, surface, type, title, body, pinned, vote_score)
    values (p_white, 'community', 'text', 'Weekly Fanfic, Art & Music Self-Promo Thread — Jun. 16, 2026',
            '', true, 6);
  insert into posts (author_id, surface, type, title, body, pinned, vote_score)
    values (p_white, 'community', 'text', 'Wakanda Lore Megathread: MCU Canon vs Comics — read before posting',
            '', true, 18);

  -- ----- a profile-surface post (lives on the member page) ------------------
  insert into posts (author_id, surface, type, title, body, links, pinned, vote_score)
    values (p_white, 'profile', 'link', 'Marvel Reddit',
$b$If you're a marvel fan, consider joining my subreddit r/BlackPantherFanworks -$b$,
            '["r/BlackPantherFanworks"]', true, 22)
    returning id into post_marvel;

  -- ----- post flairs --------------------------------------------------------
  insert into post_flairs (post_id, flair_id) values
    (post1, f_discussion),
    (post2, f_discussion),
    (post3, f_art),
    (post4, f_cosplay),
    (post_marvel, f_news);

  -- ----- comments -----------------------------------------------------------
  insert into comments (post_id, author_id, body, vote_score)
    values (post1, p_iposta, $b$Ok I'll bite. Why do you feel MBJ was not a good Killmonger?$b$, 3)
    returning id into c_q;

  insert into comments (post_id, author_id, parent_id, body, vote_score)
    values (post1, p_white, c_q,
$b$Thank you for reading. Here is my reasoning:

1. MBJ is a very attractive man. This is not a bad thing, but I do not believe he really espouses the gravitas/terror Killmonger should have. A lot of women especially (and I'm in fanfiction spaces mostly) were super attracted to him and didn't take the violence he committed in the movie at all seriously. Killmonger in MCU canon is a mass murderer committed to conquering Wakanda by his own (admittedly revolutionary) means. That's terrifying.

2. I am not implying Killmonger can't be charismatic or attractive to some. I'm just saying his character in its comic inception, and due to MCU's decision to make him a literal conqueror, means he would not be "cute." It should be clear.

3. MBJ could be a great Sam Wilson. (And is def hotter than our current one.) But not Killmonger.

4. Finally, I have some military (Marines) background, and MBJ's performance didn't carry the rigidity or strength I think a former Navy SEAL should have.

5. This is my opinion and I am available to chat further over DMs.$b$,
      1);

  insert into comments (post_id, author_id, body, vote_score)
    values (post1, p_golden, $b$Hard agree on Brian Tyree Henry. The man radiates quiet menace.$b$, 5);

  insert into comments (post_id, author_id, body, vote_score)
    values (post2, p_vibr, $b$The ancestral plane point is so real. Most underused setting in the whole movie.$b$, 7);

  insert into comments (post_id, author_id, body, vote_score)
    values (post3, p_dora, $b$The shoulder plating is incredible. Would wear.$b$, 6);

  insert into comments (post_id, author_id, body, vote_score)
    values (post_marvel, p_wak, $b$Joined! Love the banner btw.$b$, 2);

  raise notice 'Demo content seeded.';
end;
$seed$;
