# Feature Milestones — bp-fanworks-app

A prioritized backlog of features to implement, **ordered easiest → hardest** with effort estimates. Use this with the team to pick what to build next.

> The site is in active development. This is the working plan — pick from the top of each tier.

## How to read this

**Effort legend** (build effort, assuming Claude Code does the build and you review + run migrations):

| | Tier | Rough time |
|---|------|-----------|
| 🟢 | Easy | a few hours – 1 day |
| 🟡 | Moderate | 2 – 5 days |
| 🟠 | Hard | ~1 week |
| 🔴 | Major | multiple weeks (and/or external cost) |

Estimates are for the build itself. Anything touching the database ships as a **migration you run in the Supabase SQL Editor** (exactly as Claude provides it).

---

## 0. Next up — agreed features (build in this order)

These are the immediate, agreed items. Build the seed-data feature **first** (it makes the others — like the real stats — meaningful). **We are NOT clearing test/demo data** — we're adding more.

| # | Feature | What it delivers | Effort |
|---|---------|------------------|--------|
| A | **Seed a populated community (25+ real accounts)** | Create **at least 25 real, sign-in-able user accounts**, each with associated **posts, comments, and votes**, so the site looks alive. **Decision: these are real auth users** — so this does **not** ship as SQL in the Supabase SQL Editor. It runs as an **admin-API seed script** (Node/`@supabase/supabase-js` with the **service-role key**, or a Supabase Edge Function) that calls `auth.admin.createUser()` for each account, then inserts their profiles, posts, comments, and votes. Run it once against the project; never commit the service-role key. *Build choices to confirm at build time:* email pattern (e.g. `seed-user-01@…`), a shared known password for QA, and whether to mark them email-confirmed. **Do first.** | 🟡 ~1 day |
| B | **Real "weekly" stats (replace hardcoded numbers)** | `visitors: "45K"` and `contributions: "1.2K"` are hardcoded ([App.tsx:55-56](src/App.tsx#L55), shown at :317-318). Replace with **live counts**: members count and contribution-post count. Relabel if "Weekly" no longer fits the actual number. Depends on A. | 🟢 ~½ day |
| C | **Set community created date to 06/27/2026** | `created: "Feb 16, 2018"` ([App.tsx:54](src/App.tsx#L54)) → **Jun 27, 2026**. | 🟢 ~minutes |
| D | **Remove the "Promote" button** | Delete the Rocket/"Promote" (advertise-a-post) action ([App.tsx:282](src/App.tsx#L282)). *(Unrelated to promoting members to mod — that stays in the mod toolkit, #27.)* | 🟢 ~minutes |
| E | **Update the home-page top icon** | Swap the current header/home icon for a new image (**image to be provided when this is built**). | 🟢 ~1 hr after asset is supplied |

---

## Tier 1 — 🟢 Quick wins (hours – 1 day each)

Start here. Each is small, visible, and high-value-per-hour.

| # | Feature | What it delivers | Effort |
|---|---------|------------------|--------|
| 1 | **Edit & delete your own posts/comments** | Wire up the decorative "⋯" menu. RLS already allows it — just needs UI. Users expect this. | 🟢 ½–1 day |
| 2 | **Make sidebar bookmarks real links** | The community sidebar bookmarks (e.g. "Fanfic Archive") aren't clickable yet — make them real links (e.g. to tjadaka.com / AO3). | 🟢 1–2 hrs |
| 3 | **Username change (30-day cooldown)** | `username_changed_at` column + `SECURITY DEFINER` RPC `change_username()` enforcing the 30-day rule in the DB. Name updates everywhere automatically (posts join `profiles`). Editable display name (no cooldown) as a bonus. | 🟢 ~½ day |
| 4 | **Persist Follow / mute on a post** | Today the post "Follow" button is cosmetic (local state). Save it so it survives reload. | 🟢 ~1 day |
| 5 | **Photo-upload avatar** | Simplest avatar path: upload a profile picture to Supabase Storage (gradient stays as fallback). | 🟢 ~½ day |
| 6 | **Ko-fi / Patreon link in profile** | A clean "support me" link on profiles. Folds into profile editing. | 🟢 ~2 hrs |
| 7 | **Cross-link tjadaka.com ↔ community** | "Discuss" / "Community" nav button + "Discuss this chapter" links on tjadaka.com → the community; a community bookmark back to the fiction. Mostly WordPress-side. | 🟢 ~30 min |

---

## Tier 2 — 🟡 Core Reddit-parity (2–5 days each)

The features that make it "feel like Reddit." **Sorting and Search are the two biggest "feels different" gaps.**

| # | Feature | What it delivers | Effort |
|---|---------|------------------|--------|
| 8 | **Sorting: Hot / Top / New / Rising** | Currently only "Newest." Add feed sorts + time filters (Top: today/week/all) and comment sorting (top/new). **The #1 "feels like Reddit" win.** | 🟡 3–5 days |
| 9 | **Profile editing / Account settings panel** | The home for display name, avatar, banner, bio, member flair, the username-change cooldown, Ko-fi/AO3 links. Nothing on the profile is editable today. Several Tier-1 items live inside this. | 🟡 2–4 days |
| 10 | **Search (post title/body)** | The search bar currently does nothing. Wire up real post search; later extend to tag/site-wide search (Tier 3). | 🟡 3–4 days |
| 11 | **Save / bookmark posts & comments** | Personal "saved" list for later. Standard Reddit expectation. | 🟡 1–2 days |
| 12 | **Working polls** | Poll is listed as a post type but has no options input or voting. Make it real. | 🟡 2–3 days |
| 13 | **Mod-editable community sidebar / rules** | Sidebar blurb, rules, and bookmarks are hardcoded (`const community`) — move to the DB so mods can edit them. | 🟡 2–3 days |
| 14 | **Real Join/subscribe + user-selectable flair** | The Join button is cosmetic; users can't pick their own flair. Persist membership + let users choose flair. | 🟡 2–3 days |
| 15 | **Reporting content → mod report queue** | Users flag rule-breaking posts into a queue mods can action. (Today the flag icon is used for Block.) Pairs with the mod toolkit. | 🟡 3–5 days |
| 16 | **Comment permalinks + "load more" pagination** | Direct links to a comment, and pagination for large threads. | 🟡 2–3 days |
| 17 | **Mobile responsive pass** | Site should resize properly on small screens. | 🟡 2–4 days |
| 18 | **Social login (Discord + Google)** | Supabase built-in OAuth. You register the OAuth apps (~15 min each); code is tiny. Discord is a perfect fit for this audience. Free. | 🟡 ~½–1 day (+ your provider setup) |
| 19 | **"Latest from T'Jadaka" widget** | Pull your latest WordPress posts (REST API is public) into a community sidebar widget — title, excerpt, cover, "Read on tjadaka.com." Read-only, drives clicks back to your site. | 🟡 ~½–1 day |
| 20 | **AO3 linking (manual)** | Profile fields for AO3 username + a few featured work links, shown as an "On AO3" section. No AO3 API needed. Respects fandom norms (no scraping). | 🟡 ~½ day |
| 21 | **Content warning system** | Let users flag posts with warnings; others can blur/hide until clicked. Important for fandom content. | 🟡 2–3 days |
| 22 | **Rich embeds for fanworks** | Turn a pasted AO3 / YouTube / DeviantArt link into a visual card (title, preview image, description) via Open Graph / oEmbed. Big for art/video-heavy fandom. | 🟡 2–4 days |

---

## Tier 3 — 🟠 Larger builds (~1 week each)

| # | Feature | What it delivers | Effort |
|---|---------|------------------|--------|
| 23 | **Notifications / inbox** | Reply notifications, @mentions, "your post got upvotes." High retention value. Optionally a weekly email digest of top posts. Zero notifications exist today. | 🟠 ~1–1.5 wk |
| 24 | **Rich-text editor + reading mode** | Markdown/HTML composer for posts, plus a clean "reading mode" (typography, light/dark, font size) so fanfic readers stay on-site. | 🟠 3–5 days |
| 25 | **Tagging & filtering system** | Tag posts by content type (fanart/fanfic/cosplay/discussion/meme), characters, ships, trigger warnings; filter bar/sidebar to find e.g. all Shuri/Namor fanart. **The #1 thing Reddit lacks for fandom.** Pairs with search. | 🟠 ~1 wk |
| 26 | **Avatar builder (DiceBear / Avataaars)** | Composable cartoon avatars (hair/eyes/skin/clothes/accessories) using an open-source SVG library — the "Reddit look" for ~5% of custom-art effort. Store config as JSON; gradient stays as fallback. | 🟠 3–5 days |
| 27 | **Moderation toolkit (depth)** | Builds on `0007_mod_actions`. Add: **promote/remove mods**, ban a user from the community, lock a post's comments, removal reasons, **mod action log**, distinguish/sticky mod comments, mod mail, saved responses, scheduled posts/events, and a **Flooding Assistant** (rate-limit posts per period). Ship in slices. | 🟠 ~1.5–2 wk total |
| 28 | **Profile galleries / showcase + badges** | Pin best works to a profile showcase, link AO3/Tumblr/Twitter, display badges (e.g. "Top Fanartist of the Month"). Turns profiles into fandom home bases. | 🟠 ~1 wk |
| 29 | **Auto-create discussion thread per WP chapter** | New WordPress post → webhook → Supabase function inserts a matching community discussion post. You add the trigger (Zapier/Make or a WP snippet); Claude builds the Supabase side. | 🟠 2–4 days |
| 30 | **AO3 verified ownership** | Prove AO3 account ownership: generate a code, user pastes it in their AO3 bio, an Edge Function checks it. Add only if impersonation becomes a real problem. | 🟠 1–2 days |
| 31 | **Commission board** | A dedicated area for commission requests + artist slots, with guidelines to prevent drama. | 🟠 ~1 wk |
| 32 | **Account switching** | Hold several accounts and toggle between them (Instagram-style). Custom work — Supabase has one session/browser; juggling rotating refresh tokens is the hard edge. *(Clarify: separate logins vs. Netflix-style personas under one login — the latter is a schema change but easier on auth.)* | 🟠 a few days |
| 33 | **SMS / phone login** | Supabase OTP, but needs a paid SMS provider (Twilio: number ~$1–15/mo + per-text) and abuse/toll-fraud protection. Social login is cheaper and better — **build only if you specifically need phone identity.** | 🟠 ~½ day code + setup, 💵 ongoing cost |

---

## Tier 4 — 🔴 Major initiatives (multiple weeks / external cost)

| # | Feature | What it delivers | Effort |
|---|---------|------------------|--------|
| 34 | **Circles (separate feeds / sub-communities)** | Anyone can create a Circle; posts live in a Circle or the General feed. Migration `0008_circles.sql` (tables + visibility RLS is the security boundary), directory at `/circles`, per-Circle pages/feeds/mods, composer "Post to:" selector. **Phase 1 (public):** ~1.5 wk · **Phase 2 (private/invite):** ~1–1.5 wk. Add a spam guardrail in `create_circle` (rate limit + min account age). | 🔴 ~2.5–3 wk |
| 35 | **Awards / coins / "Gold" economy** | The Award buttons + stats exist but are non-functional. A real economy means a coin ledger **and payments** (Stripe), which is the big lift. | 🔴 multi-week |
| 36 | **Achievements engine** | Profiles show "No achievements yet." Rules engine that grants/tracks achievements. | 🔴 ~1 wk+ |
| 37 | **Custom Wakanda-themed avatar art** | Bespoke composable avatar parts (Dora Milaje, Killmonger, panther motifs). Code is moderate; the **art is the cost** — commissioning a full layered set is weeks + hundreds-to-thousands of dollars. Do the DiceBear builder (#26) first. | 🔴 weeks + art budget |

---

## Specialized post templates (your flagged "Phase 2 / later")

Currently AMA, TIL, Ask, Debate, Vent all become plain text posts. Building proper templates for each is a set:

| Feature | Effort |
|---------|--------|
| Specialized templates (AMA / TIL / Ask / Debate / Vent) | 🟠 ~1 wk for the set |
| Trending / "rising" posts | 🟡 folds into Sorting (#8) |
| Email digests | 🟡 folds into Notifications (#23) |
| Swipeable gallery polish | 🟡 2–3 days |

---

## Recommended build order (highest impact first)

1. **Edit/delete own content** (#1) — quick, expected.
2. **Sorting: Hot/Top/New** (#8) — biggest "feels like Reddit" win.
3. **Profile editing panel** (#9) — unlocks username change, avatars, AO3/Ko-fi links all at once.
4. **Search** (#10).
5. **Notifications/inbox** (#23) — highest retention value once parity is there.
6. **Reporting + mod queue** (#15, #27) — community health as the user base grows.

Then layer in fandom-specific wins (tagging/filtering #25, rich embeds #22, avatar builder #26) and the big bets (Circles #34).

---

## Out of scope (deliberate non-goals)

Not "missing" — intentionally not built:

- **r/all, custom feeds / multireddits** (note: **Circles** #34 is the chosen approach to multiple feeds).
- **Public API**, **federation**, **native mobile apps**.
- **Full AutoModerator rules engine** (a lightweight keyword/spam filter is in scope under #27; a full engine is not).
- **AO3 auto-sync / scraping** — against AO3 ToS and fandom norms; do manual/verified linking instead (#20/#30).
- **Enterprise SSO (SAML/Okta)** — paid B2B feature, irrelevant here. (Social login #18 is the right "SSO.")
- **Iframe-embedding the community into WordPress** — clunky; cross-linking (#7) is better.
- **WordPress single sign-on / shared accounts** — tjadaka.com has no user accounts, nothing to sync.
