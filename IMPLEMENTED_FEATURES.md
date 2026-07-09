# Implemented Features — bp-fanworks-app

A record of milestone features that are **shipped to production** (`working` branch → blackpantherfanworks.com), as of **2026-07-08**.

This is the "done" companion to [MILESTONES.md](MILESTONES.md) (the full backlog/plan). Each item links the PR that delivered it. Themes match the milestone doc.

> **Status:** 30+ feature PRs merged. Production DB is at migration `0023`. Everything below is live on the apex domain.

---

## 1. Appearance & UX

| Feature | What shipped | PR |
|---------|--------------|----|
| **Dark mode toggle** | Persistent light/dark switch defaulting to OS `prefers-color-scheme`, remembered across sessions. | [#29](https://github.com/favourogundare/bp-fanworks-app/pull/29) |
| **Mobile responsive pass** | Site resizes correctly on small screens. | [#35](https://github.com/favourogundare/bp-fanworks-app/pull/35) |

## 2. Feeds, sorting & discovery

| Feature | What shipped | PR |
|---------|--------------|----|
| **Sorting: Hot / Top / New / Rising** | Feed sorts + time filters and comment sorting. | [#30](https://github.com/favourogundare/bp-fanworks-app/pull/30) |
| **Reading history + "Continue Reading"** | Tracks viewed posts; homepage shelf; clearable/disableable. | [#51](https://github.com/favourogundare/bp-fanworks-app/pull/51) |
| **Follow a tag** | Follow/unfollow tags; matching posts surface in feed, with notifications. | [#45](https://github.com/favourogundare/bp-fanworks-app/pull/45) |
| **Spoiler-free mode** | Site-wide toggle hiding posts/comments carrying chosen spoiler tags; editable list. | [#42](https://github.com/favourogundare/bp-fanworks-app/pull/42) |
| **Personal mute / block tags** | Permanently mute any tag so those posts never appear, with "show anyway." | [#52](https://github.com/favourogundare/bp-fanworks-app/pull/52) |

## 3. Search, tags & filtering

| Feature | What shipped | PR |
|---------|--------------|----|
| **Tagging & filtering system + Search** | Tag posts by type/character/ship; filter bar; real post search wired to the search bar. Foundation for follow-tag, spoiler-free, and mute-tags. | [#32](https://github.com/favourogundare/bp-fanworks-app/pull/32) |
| **Content warning system** | Flag posts with warnings; others blur/hide until clicked. | [#56](https://github.com/favourogundare/bp-fanworks-app/pull/56) |

## 4. Posting & composing

| Feature | What shipped | PR |
|---------|--------------|----|
| **Spoiler tags in comments** | Markdown `>!spoiler!<` — blurred by default, revealed on hover/tap. | [#37](https://github.com/favourogundare/bp-fanworks-app/pull/37) |
| **Working polls** | Poll post type with real options input and voting. | [#43](https://github.com/favourogundare/bp-fanworks-app/pull/43) |

## 5. Comments & threads

| Feature | What shipped | PR |
|---------|--------------|----|
| **Edit & delete your own posts/comments** | The "⋯" menu wired up (RLS already allowed it). | [#28](https://github.com/favourogundare/bp-fanworks-app/pull/28) |
| **Collapse child comments** | Tap a parent to collapse its thread, with persisted state. | [#33](https://github.com/favourogundare/bp-fanworks-app/pull/33) |
| **Comment permalinks + "load more" pagination** | Direct links to a comment; pagination for large threads. | [#54](https://github.com/favourogundare/bp-fanworks-app/pull/54) |

## 6. Saving & collections

| Feature | What shipped | PR |
|---------|--------------|----|
| **Save / bookmark posts** | Personal "saved" list. | [#38](https://github.com/favourogundare/bp-fanworks-app/pull/38) |
| **Bookmark folders** | Named folders; save into one/many; move between; browse by folder. | [#44](https://github.com/favourogundare/bp-fanworks-app/pull/44) · fix [#50](https://github.com/favourogundare/bp-fanworks-app/pull/50) |
| **Reading lists / collections** | User-created named, public collections; create/edit/delete, add/remove posts, shown on profiles, browsable and **followable**. | [#55](https://github.com/favourogundare/bp-fanworks-app/pull/55) |

## 7. Profiles & identity

| Feature | What shipped | PR |
|---------|--------------|----|
| **Profile editing / settings panel** | Editable display name, bio, avatar/banner, and links (AO3 / Ko-fi), plus the home for spoiler/mute-tag settings. | [#31](https://github.com/favourogundare/bp-fanworks-app/pull/31) |
| **User hover cards** | Hovering a username shows a lightweight preview (avatar, flair, join date, quick follow). | [#34](https://github.com/favourogundare/bp-fanworks-app/pull/34) |

## 8. Notifications & engagement

| Feature | What shipped | PR |
|---------|--------------|----|
| **Notifications / inbox** | Reply notifications, @mentions, upvote notices. Foundation for follow-tag/list-follow alerts. | [#41](https://github.com/favourogundare/bp-fanworks-app/pull/41) |
| **Persist Follow / mute on a post** | Post "Follow" state saved so it survives reload. | [#46](https://github.com/favourogundare/bp-fanworks-app/pull/46) |

## 9. Moderation & community

| Feature | What shipped | PR |
|---------|--------------|----|
| **Sidebar bookmarks as real links** | Sidebar bookmarks made clickable. | [#47](https://github.com/favourogundare/bp-fanworks-app/pull/47) |
| **Community stats + cleanup** | Community stats surfaced; assorted cleanup. | [#20](https://github.com/favourogundare/bp-fanworks-app/pull/20) |
| **Mod actions foundation** | Baseline moderation actions (migration `0007_mod_actions`). | *(baseline)* |

## 11. SEO & web discoverability

| Feature | What shipped | PR |
|---------|--------------|----|
| **SEO basics** | Client-side canonical + meta tags, sitemap, robots. | [#26](https://github.com/favourogundare/bp-fanworks-app/pull/26) |
| **Dynamic meta tags for bots** (the #1 SEO win) | Vercel Edge Middleware (`middleware.ts`) detects crawlers and injects real `<title>`/OG tags server-side for posts, profiles, and feeds. | [#39](https://github.com/favourogundare/bp-fanworks-app/pull/39) · fix [#40](https://github.com/favourogundare/bp-fanworks-app/pull/40) |
| **Structured data (JSON-LD)** | `Article`/`ProfilePage`/`BreadcrumbList`/`WebSite` structured data for rich results. | [#48](https://github.com/favourogundare/bp-fanworks-app/pull/48) · polish [#49](https://github.com/favourogundare/bp-fanworks-app/pull/49) |
| **Image SEO** | Descriptive `alt` text, meaningful file names, `og:image` on posts with covers. | [#53](https://github.com/favourogundare/bp-fanworks-app/pull/53) |

---

## Database migrations backing these features

Production DB (`hvafigyajyujqwpvdfou`) applied through `0023`:

| Migration | Feature |
|-----------|---------|
| `0008_comment_soft_delete` | Edit/delete own content |
| `0009_profile_editing` | Profile editing (AO3/Ko-fi links, blur-media) |
| `0010_post_search` | Search + tagging |
| `0011_saved_items` | Save / bookmark |
| `0012_notifications` | Notifications inbox |
| `0013_spoiler_free_mode` | Spoiler-free mode |
| `0014_poll_votes` | Working polls |
| `0015_bookmark_folders` | Bookmark folders |
| `0017_post_follows` | Persist post follow |
| `0018_follow_tags` / `0019_follow_tags_hardening` | Follow a tag |
| `0020_mute_tags` | Mute / block tags |
| `0022_reading_lists` | Reading lists / collections |
| `0023_content_warnings` | Content warning system |

---

## Not yet shipped (branches open, not merged to production)

- **Username change (30-day cooldown)** — branch `feature/username-cooldown` (no `username_changed_at` in production yet).
- **Pinned profile posts** — branch `feature/pinned-profile-posts`.

Everything else in [MILESTONES.md](MILESTONES.md) not listed above remains backlog.
