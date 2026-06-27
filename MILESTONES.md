# Feature Milestones — bp-fanworks-app

The feature backlog for the site. **Phase 0** is the agreed next-up work. After that, features are grouped by **theme**; within each theme they're ordered **easiest → hardest**, and every item carries an effort estimate so you can still pick "quick wins first."

> The site is in active development. This is the working plan, not a commitment to build everything.

## How to read this

**Effort legend** (build effort, assuming Claude Code does the build and you review + run migrations):

| | Difficulty | Rough time |
|---|------------|-----------|
| 🟢 | Easy | a few hours – 1 day |
| 🟡 | Moderate | 2 – 5 days |
| 🟠 | Hard | ~1 week |
| 🔴 | Major | multiple weeks (and/or external cost) |

Anything touching the database ships as a **migration you run in the Supabase SQL Editor** (exactly as Claude provides it). Many features **depend on a foundation** (e.g. the tagging system, the profile-settings panel, notifications) — those dependencies are called out so you build in a sensible order.

---

## Phase 0 — Next up (build in this order)

The immediate, agreed items. Build the seed-data feature **first** (it makes the others — like the real stats — meaningful). **We are NOT clearing test/demo data** — we're adding more.

| # | Feature | What it delivers | Effort |
|---|---------|------------------|--------|
| A | **Seed a populated community (25+ real accounts)** | At least 25 **real, sign-in-able** accounts, each with posts, comments, and votes. Real auth users → ships as an **admin-API seed script** (`auth.admin.createUser()` + content inserts), not SQL. Emails `test-user-01@bpfanworks.test`…`-25`, shared QA password, emails auto-confirmed. ✅ **Built & verified** (`scripts/seed-demo-accounts.mjs`); run against production when ready. | 🟡 ~1 day |
| B | **Real "weekly" stats** | `visitors: "45K"` / `contributions: "1.2K"` are hardcoded ([App.tsx:55-56](src/App.tsx#L55), shown at :317-318). Replace with **live counts** (members, contribution posts). Relabel if "Weekly" no longer fits. Depends on A. | 🟢 ~½ day |
| C | **Community created date → 06/27/2026** | `created: "Feb 16, 2018"` ([App.tsx:54](src/App.tsx#L54)) → **Jun 27, 2026**. | 🟢 ~min |
| D | **Remove the "Promote" button** | Delete the Rocket/"Promote" (advertise-a-post) action ([App.tsx:282](src/App.tsx#L282)). *(Not the mod "promote member" action — that's in Moderation.)* | 🟢 ~min |
| E | **Update the home-page top icon** | Swap the header/home icon for a new image (**provided when this is built**). | 🟢 ~1 hr |

---

## 1. Appearance & UX

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Dark mode toggle** | Persistent light/dark switch in the nav / user menu. Defaults to the OS `prefers-color-scheme`; remembers the user's choice across sessions. Separate from any future reading-mode/typography work. | 🟢 ~½–1 day |
| **Mobile responsive pass** | Site resizes properly on small screens. | 🟡 2–4 days |

---

## 2. Feeds, sorting & discovery

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Sorting: Hot / Top / New / Rising** | Only "Newest" today. Add feed sorts + time filters (Top: today/week/all) and comment sorting (top/new). Folds in **trending / "rising"** posts. **The #1 "feels like Reddit" win.** | 🟡 3–5 days |
| **Reading history + "Continue Reading"** | Track viewed posts; show a "Continue Reading" shelf on the homepage. Users can clear or disable tracking. | 🟡 2–3 days |
| **Follow a tag or ship** | Follow/unfollow tags or ships; matching posts surface in the feed; optional notifications for new tagged posts. *Needs the tagging system + notifications.* | 🟡 2–3 days |
| **Spoiler-free mode** | Site-wide toggle that hides posts/comments carrying user-chosen spoiler tags (e.g. "Wakanda Forever spoilers"). Hidden-tag list editable in settings. *Needs tagging.* | 🟡 2–3 days |
| **Personal mute / block tags** | Permanently mute any tag (not just spoilers) so those posts never appear in a user's feed, with an optional "show anyway." Editable list. *Needs tagging.* | 🟡 2–3 days |

---

## 3. Search, tags & filtering

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Search (post title/body)** | The search bar does nothing today. Wire up real post search; extend to tag/site-wide search once tagging lands. | 🟡 3–4 days |
| **Content warning system** | Flag posts with warnings; others can blur/hide until clicked. | 🟡 2–3 days |
| **Tagging & filtering system** | Tag posts by content type (fanart/fanfic/cosplay/discussion/meme), characters, ships, trigger warnings; filter bar to find e.g. all Shuri/Namor fanart. **The #1 thing Reddit lacks for fandom** — and the foundation for follow-tag, spoiler-free mode, and mute-tags above. | 🟠 ~1 wk |

---

## 4. Posting & composing

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Spoiler tags in comments** | Markdown spoiler syntax `>!spoiler!<` — blurred by default, revealed on hover (desktop) / tap (mobile). Works in comments and previews. | 🟢 ~½–1 day |
| **Working polls** | Poll is a listed post type but has no options input or voting. Make it real. | 🟡 2–3 days |
| **Rich embeds for fanworks** | Turn a pasted AO3 / YouTube / DeviantArt link into a visual card (title, preview image, description) via Open Graph / oEmbed. | 🟡 2–4 days |
| **Inline fanart embeds in comments** | Upload or paste image links in comments; render as thumbnails that expand on click. Respects moderation rules. | 🟡 2–3 days |
| **Fan soundtrack / playlist linking** | A playlist field on posts/profiles for Spotify / YouTube Music / Apple Music — embedded player where supported, link fallback otherwise. For fic mood playlists, character playlists, etc. | 🟡 2–3 days |
| **Post archive / vault** | Authors can "archive" their own older posts (AO3-style): removed from feeds/tags/search but still viewable by direct link. Profile shows an "Archived" tab (optionally to visitors). | 🟡 2–3 days |
| **Rich-text editor + reading mode** | Markdown/HTML composer, plus a clean "reading mode" (typography, light/dark, font size) so fanfic readers stay on-site. | 🟠 3–5 days |
| **Specialized post templates** | AMA / TIL / Ask / Debate / Vent currently all become plain text. Build proper templates for the set. | 🟠 ~1 wk |
| **Post collaboration (co-authors)** | Credit 2+ users as co-authors; joint works appear on all their profiles; co-authors added/removed with permission; collaboration shown on the post page. | 🟠 ~1 wk |

---

## 5. Comments & threads

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Edit & delete your own posts/comments** | Wire up the decorative "⋯" menu. RLS already allows it — just needs UI. | 🟢 ½–1 day |
| **Collapse child comments** | Tap a parent comment to collapse its whole thread, with a collapsed indicator and persisted state while on the page. Standard Reddit behaviour. | 🟢 ~½ day |
| **Collapse AutoMod messages** | AutoMod sticky comments collapsed by default, easily expandable, so notices don't clutter discussion. *Pairs with the mod toolkit.* | 🟢 ~½ day |
| **Comment permalinks + "load more" pagination** | Direct links to a comment, and pagination for large threads. | 🟡 2–3 days |

---

## 6. Saving & collections

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Save / bookmark posts & comments** | A personal "saved" list. Standard Reddit expectation and the base for the two below. | 🟡 1–2 days |
| **Bookmark folders** | Named folders ("To Read," "Favourites," "Recs"); save items into one or many; move between folders; browse by folder. *Extends Save.* | 🟡 2–3 days |
| **Reading lists / collections** | User-created **named, public** collections of posts (e.g. "Shuri-Centric Longfics"). Create/edit/delete, add/remove posts, shown on profiles, browsable and **followable** by others; followed lists can appear in feeds. | 🟠 ~1 wk |

---

## 7. Profiles & identity

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Ko-fi / Patreon link** | A clean "support me" link on profiles. Folds into profile editing. | 🟢 ~2 hrs |
| **Username change (30-day cooldown)** | `username_changed_at` column + `SECURITY DEFINER` RPC enforcing the rule in the DB. Editable display name (no cooldown) included. | 🟢 ~½ day |
| **Photo-upload avatar** | Upload a profile picture to Supabase Storage (gradient stays as fallback). | 🟢 ~½ day |
| **Pinned profile posts** | Users pin their own posts to the top of their profile; multiple pins, newest pin first; unpin anytime. | 🟢🟡 ~1 day |
| **Profile editing / settings panel** | The home for display name, avatar, banner, bio, member flair, username cooldown, Ko-fi/AO3 links, and the spoiler/mute-tag settings. Nothing is editable today — several items above live inside this. | 🟡 2–4 days |
| **AO3 linking (manual)** | Profile fields for AO3 username + featured work links. No AO3 API needed; respects fandom norms (no scraping). | 🟡 ~½ day |
| **User hover cards** | Hovering a username shows a lightweight preview: avatar, flair, join date, kudos given/received, quick follow. Cuts profile-page round-trips. | 🟡 2–3 days |
| **Custom profile themes** | Light personalization: preset color palettes + custom header/banner image. | 🟡 2–3 days |
| **Post analytics for creators** | **Opt-in, private** per-post metrics: total views, unique readers, average read time (if scroll tracking on), kudos, comment stats. Never shown publicly. | 🟡 3–5 days |
| **Profile galleries / showcase + badges** | Pin best works to a showcase, link AO3/Tumblr/Twitter, display badges ("Top Fanartist of the Month"). | 🟠 ~1 wk |
| **Beta reader matching** | A lightweight directory: beta profiles (fandoms, ships, strengths, availability); browse/search; send beta-match requests. No recommendation algorithm. | 🟠 ~1 wk |
| **AO3 verified ownership** | Prove AO3 ownership: generate a code, user pastes it in their AO3 bio, an Edge Function checks it. Add only if impersonation becomes a problem. | 🟠 1–2 days |
| **Avatar builder (DiceBear / Avataaars)** | Composable cartoon avatars using an open-source SVG library — the "Reddit look" for ~5% of custom-art effort. Config stored as JSON; gradient fallback. | 🟠 3–5 days |
| **Custom Wakanda-themed avatar art** | Bespoke composable parts (Dora Milaje, Killmonger, panther motifs). Code moderate; **art is the cost** (weeks + commission budget). Do the DiceBear builder first. | 🔴 weeks + art $$ |

---

## 8. Notifications & engagement

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Persist Follow / mute on a post** | The post "Follow" button is cosmetic (local state) — save it so it survives reload. | 🟢 ~1 day |
| **Notifications / inbox** | Reply notifications, @mentions, "your post got upvotes," plus optional weekly **email digests**. Zero notifications today; high retention value. Foundation for follow-tag and list-follow alerts. | 🟠 ~1–1.5 wk |
| **Achievements engine** | Profiles show "No achievements yet." A rules engine that grants/tracks achievements. | 🔴 ~1 wk+ |
| **Awards / coins / "Gold" economy** | Award buttons + stats exist but are non-functional. A real economy needs a coin ledger **and payments** (Stripe) — the big lift. | 🔴 multi-week |

---

## 9. Moderation & community

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Make sidebar bookmarks real links** | Sidebar bookmarks (e.g. "Fanfic Archive") aren't clickable — make them real links. | 🟢 1–2 hrs |
| **Mod-editable sidebar / rules** | Sidebar blurb, rules, and bookmarks are hardcoded (`const community`) — move to the DB so mods can edit them. | 🟡 2–3 days |
| **Real Join/subscribe + user-selectable flair** | The Join button is cosmetic and users can't pick flair. Persist membership + flair choice. | 🟡 2–3 days |
| **Reporting content → mod report queue** | Users flag rule-breaking content into a queue mods action. (The flag icon is currently "Block.") | 🟡 3–5 days |
| **Moderation toolkit (depth)** | Builds on `0007_mod_actions`. Add: **promote/remove mods**, ban from community, lock comments, removal reasons, **mod action log / mod mail**, distinguish/sticky mod comments, saved responses, scheduled posts/events, and a **Flooding Assistant** (post rate-limit). Ship in slices. | 🟠 ~1.5–2 wk |
| **Community wiki (`/wiki`)** | Collaborative wiki: character bios, ship manifestos, lore deep-dives, resources. Simplified editor, page history/revisions, mod-controlled edit permissions. | 🟠 ~1.5 wk |
| **Commission board** | Dedicated area for commission requests + artist slots, with guidelines to prevent drama. | 🟠 ~1 wk |
| **Circles (separate feeds / sub-communities)** | Anyone can create a Circle; posts live in a Circle or the General feed. Migration `0008_circles.sql` (tables + visibility RLS), `/circles` directory, per-Circle pages/mods, composer "Post to:" selector, spam guardrail in `create_circle`. Phase 1 (public) ~1.5 wk · Phase 2 (private/invite) ~1–1.5 wk. | 🔴 ~2.5–3 wk |

---

## 10. Auth & accounts

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Social login (Discord + Google)** | Supabase built-in OAuth. You register the apps (~15 min each); code is tiny. Discord fits this audience; free. | 🟡 ~½–1 day (+ provider setup) |
| **Account switching** | Hold several accounts and toggle between them (Instagram-style). Custom work — one session/browser, rotating refresh tokens are the hard edge. *(Separate logins vs. Netflix-style personas — the latter is a schema change but easier on auth.)* | 🟠 a few days |
| **SMS / phone login** | Supabase OTP, but needs a paid SMS provider (Twilio) + toll-fraud protection. Social login is cheaper/better — **build only if you need phone identity.** | 🟠 ~½ day + 💵 ongoing |

---

## 11. SEO & web discoverability

Search/social visibility for a client-rendered React app. Ordered by impact (the first item is the biggest win). Most are small and can be done incrementally.

| # | Improvement | What it delivers | Effort |
|---|-------------|------------------|--------|
| 1 | **Dynamic meta tags for bots** | **The #1 win.** Social crawlers (Discord/Twitter/Facebook) don't run JS, so every shared link currently shows generic tags. Use **Vercel Edge Middleware** to detect crawlers, fetch the post/profile from Supabase server-side, and inject real `<title>`, `<meta description>`, and Open Graph tags. Per page: post (title + 160-char body, author, cover), profile (name + bio, avatar), feed (community name + blurb). No full SSR migration. | 🟡 2–3 days |
| 2 | **Client-side title + meta on route change** | Set `document.title` and update description/OG tags (e.g. `react-helmet-async`) immediately on navigation — helps Google's renderer and the browser tab. | 🟢 ~½ day |
| 3 | **Structured data (JSON-LD)** | `Article`/`SocialMediaPosting` on posts (author, datePublished, upvote/comment counts), `ProfilePage` on profiles, `BreadcrumbList` for nav, `WebSite` + `SearchAction`. Enables rich results. | 🟢 1–2 days |
| 4 | **`sitemap.xml` + `robots.txt`** | Dynamic sitemap listing public posts, profiles, tags, and the wiki; `robots.txt` allowing crawl + pointing to it. Submit to Google Search Console + Bing. | 🟢 ~½ day |
| 5 | **Canonical URLs** | `<link rel="canonical">` on every page to avoid duplicate-content issues when posts are reachable via multiple feeds. | 🟢 ~hours |
| 6 | **Image SEO** | Descriptive `alt` text (e.g. "Shuri fanart by username"), meaningful file names, `og:image` on posts with a cover. | 🟡 1–2 days |
| 7 | **Pagination handling** | Make "page 2" of feeds/tags reachable via paginated URLs (`?page=2`) with canonical + `rel="next"/"prev"`, since infinite scroll alone is bad for crawlers. *Do alongside Sorting.* | 🟡 1–2 days |
| 8 | **Core Web Vitals** | LCP (preload/`fetchpriority` hero images), CLS (reserve space for images/embeds), INP (code-split route bundles), `font-display: swap`, WebP/AVIF via Supabase image transforms. | 🟡 1–2 days initial, then ongoing |
| 9 | **Internal link architecture** | Posts link to author + tag pages; sidebar/footer link to key tags, wiki, static pages; breadcrumbs; no orphan pages. | 🟢 ongoing review |
| 10 | **Social sharing embeds** | Verify rich unfurl cards on Discord/Tumblr/Twitter — relies on #1; test thoroughly. Fandom lives on social, so good cards drive referral traffic. | 🟢 testing after #1 |

---

## 12. Integrations — tjadaka.com (WordPress)

| Feature | What it delivers | Effort |
|---------|------------------|--------|
| **Cross-link tjadaka.com ↔ community** | "Discuss"/"Community" nav button + "Discuss this chapter" links on tjadaka.com → the community; a community bookmark back to the fiction. Mostly WordPress-side. | 🟢 ~30 min |
| **"Latest from T'Jadaka" widget** | Pull your latest WordPress posts (public REST API) into a community sidebar widget — title, excerpt, cover, "Read on tjadaka.com." Read-only; drives clicks back. | 🟡 ~½–1 day |
| **Auto-create discussion thread per WP chapter** | New WordPress post → webhook → Supabase function inserts a matching community discussion post. You add the trigger (Zapier/Make or a WP snippet); Claude builds the Supabase side. | 🟠 2–4 days |

---

## Recommended build order (highest impact first)

1. **Edit/delete own content** — quick, expected.
2. **Sorting: Hot/Top/New** — biggest "feels like Reddit" win.
3. **Profile editing panel** — unlocks username change, avatars, AO3/Ko-fi, and the spoiler/mute settings home.
4. **Tagging & filtering** — foundation for search, follow-tag, spoiler-free mode, and mute-tags.
5. **Search**.
6. **Notifications / inbox** — highest retention value; foundation for follow alerts.
7. **Reporting + mod toolkit** — community health as the user base grows.
8. **SEO #1–#5** — cheap, high-leverage; do the quick ones early so shared links look good from day one.

Then layer in fandom wins (rich embeds, reading lists, avatar builder, collaboration) and the big bets (Circles, wiki).

---

## Out of scope (deliberate non-goals)

Not "missing" — intentionally not built:

- **r/all, custom feeds / multireddits** (note: **Circles** is the chosen approach to multiple feeds).
- **Public API**, **federation**, **native mobile apps**.
- **Full AutoModerator rules engine** (a lightweight keyword/spam filter is in scope under the mod toolkit; a full engine is not).
- **AO3 auto-sync / scraping** — against AO3 ToS and fandom norms; do manual/verified linking instead.
- **Enterprise SSO (SAML/Okta)** — paid B2B feature, irrelevant here. (Social login is the right "SSO.")
- **Iframe-embedding the community into WordPress** — clunky; cross-linking is better.
- **WordPress single sign-on / shared accounts** — tjadaka.com has no user accounts, nothing to sync.
