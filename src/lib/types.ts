// UI-facing shapes. These mirror what the prototype's components already expect,
// so the rendering code barely changes — only the data source does (now Supabase).

export interface UiComment {
  id: string
  author: string
  when: string
  flair: string | null // "OP" when the commenter is the post's author
  body: string
  votes: number
  deleted?: boolean // soft-deleted: body/author blanked, thread preserved
  replies: UiComment[]
}

export interface UiPost {
  id: string
  author: string
  when: string
  title: string
  flairs: string[] // flair slugs (e.g. "discussion", "art")
  type: string
  body: string
  votes: number
  views?: string
  image?: boolean
  media: string[] // uploaded media URLs (may be empty; demo seed uses placeholders)
  links?: string[]
  pollOptions: string[] // poll choice labels (empty unless type === 'poll')
  warnings: string[] // content warnings; body/media gate behind them when non-empty
  pinned: boolean
  locked: boolean // comments locked by a mod; DB policy blocks non-mod comments
  profilePinned: boolean // pinned to the author's profile (distinct from mod community pin)
  archived: boolean // author-archived: hidden from feeds/tags/search, direct link still works
  commentCount: number
  comments: UiComment[] // populated on the post page; empty in the feed
  circle: { slug: string; name: string } | null // sub-community, or null = General feed
  coauthors: string[] // credited co-authors' usernames (empty for solo posts)
}

// Circles Phase 1 (MILESTONES §9): public sub-communities.
export interface UiCircle {
  id: string
  slug: string
  name: string
  description: string
  creatorId: string
  visibility: 'public' | 'private'
  members: number
  joined: boolean // is the signed-in member a member of this circle
  myRole: 'member' | 'mod' | null // the signed-in member's role, null if not a member
  createdAt: string
}

// A member of a circle, for the per-circle mod panel.
export interface UiCircleMember {
  profileId: string
  username: string
  displayName: string
  role: 'member' | 'mod'
  isCreator: boolean
  joinedAt: string
}

// Community wiki (MILESTONES §9): collaborative pages with revision history.
export interface UiWikiPageMeta {
  slug: string
  title: string
  editLocked: boolean
  updatedBy: string | null // username of the last editor
  updatedAt: string
}

export interface UiWikiPage extends UiWikiPageMeta {
  id: string
  body: string
  createdBy: string | null
  createdAt: string
}

export interface UiWikiRevision {
  id: string
  title: string
  body: string
  summary: string
  editor: string | null // username, or null if the account is gone
  createdAt: string
}

export interface UiPinned {
  id: string
  title: string
  votes: number
  comments: number
}

// A community-sidebar bookmark. Targets either an internal route (`route`) or a
// pinned post matched by title regex (`pinnedMatch`) — never a hardcoded post
// id. Exactly one of route/pinnedMatch is set. Mod-editable (see 0029).
export interface UiBookmark {
  id: string
  label: string
  route: string | null
  pinnedMatch: string | null // regex source, matched case-insensitively
  position: number
}

// Lean fields for the username hover card — a subset of UiProfile that a
// preview needs, without a full profile-page fetch (posts, follower counts).
export interface UiUserPreview {
  id: string
  username: string
  display: string
  flair: string | null
  age: string
  isMod: boolean
}

// Commission board (MILESTONES §9): artists advertising open slots.
export interface UiCommissionListing {
  id: string
  artistId: string
  artist: string // username
  artistDisplay: string
  title: string
  description: string
  priceInfo: string
  contactUrl: string
  slotsTotal: number
  slotsFilled: number
  status: 'open' | 'waitlist' | 'closed'
  createdAt: string
}

// Commission board: members posting requests for an artist.
export interface UiCommissionRequest {
  id: string
  requesterId: string
  requester: string // username
  requesterDisplay: string
  title: string
  description: string
  budget: string
  status: 'open' | 'fulfilled' | 'closed'
  createdAt: string
}

export interface UiProfile extends UiUserPreview {
  banned: boolean // banned from the community (mods see a chip; DB blocks their posts/comments)
  flairSlug: string | null // own member-flair slug, for the self-flair picker
  banner: string
  avatarUrl: string | null
  ao3: string | null // AO3 profile link
  ao3Works: string[] // featured AO3 work URLs
  kofi: string | null // Ko-fi link
  blurMedia: boolean // personal pref: blur NSFW/spoiler media
  spoilerFree: boolean // spoiler-free mode toggle
  spoilerTags: string[] // flair slugs to hide when spoiler-free mode is on
  mutedTags: string[] // flair slugs muted everywhere (independent of spoiler mode)
  profileTheme: string | null // preset slug for the profile-page accent theme (see PROFILE_THEMES)
  usernameChangedAt: string | null // last username change; 30-day cooldown anchor
  followers: number
  karma: string
  contributions: number
  gold: number
  achievements: string
  unlocked: number
  posts: UiPost[]
}
