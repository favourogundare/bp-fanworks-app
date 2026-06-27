// UI-facing shapes. These mirror what the prototype's components already expect,
// so the rendering code barely changes — only the data source does (now Supabase).

export interface UiComment {
  id: string
  author: string
  when: string
  flair: string | null // "OP" when the commenter is the post's author
  body: string
  votes: number
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

export interface UiProfile {
  id: string
  username: string
  display: string
  flair: string | null
  banner: string
  followers: number
  karma: string
  contributions: number
  age: string
  gold: number
  achievements: string
  unlocked: number
  isMod: boolean
  posts: UiPost[]
}
