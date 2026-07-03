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
  pinned: boolean
  commentCount: number
  comments: UiComment[] // populated on the post page; empty in the feed
}

export interface UiPinned {
  id: string
  title: string
  votes: number
  comments: number
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

export interface UiProfile extends UiUserPreview {
  banner: string
  avatarUrl: string | null
  ao3: string | null // AO3 profile link
  kofi: string | null // Ko-fi link
  blurMedia: boolean // personal pref: blur NSFW/spoiler media
  spoilerFree: boolean // spoiler-free mode toggle
  spoilerTags: string[] // flair slugs to hide when spoiler-free mode is on
  followers: number
  karma: string
  contributions: number
  gold: number
  achievements: string
  unlocked: number
  posts: UiPost[]
}
