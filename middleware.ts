// Vercel Edge Middleware: serves social/search crawlers a minimal HTML head
// with per-page Open Graph / Twitter tags so shared links render rich previews.
//
// This is NOT SSR. Real browsers (and any user-agent we don't positively
// recognise as a crawler) fall straight through to the unchanged SPA via
// next(). The middleware reads existing world-readable Supabase tables over the
// PostgREST REST endpoint using the already-configured anon key — no new
// secrets, no DB changes, no Vercel dashboard config. It is deliberately
// isolated from src/lib (which is coupled to the browser Supabase client and
// window/document), and fails open to the SPA on any error or timeout.

import { next } from '@vercel/edge'

// Only these routes need rich previews. Everything else — assets, /search,
// /saved, /t/:slug — never invokes the middleware and is served normally.
export const config = {
  matcher: ['/', '/post/:id', '/user/:username'],
}

const SITE = 'Black Panther Fanworks'

const COMMUNITY = {
  name: SITE,
  blurb:
    'A Wakanda-first community for fanfiction, art, music, cosplay, and discussion rooted in the Black Panther MCU films and comics canon. Source your artwork, flair your posts, and engage in good faith. Wakanda Forever.',
}

// Conservative allowlist of known social/search crawler user-agents. Anything
// not matched here — including every real browser — falls through to the SPA.
const CRAWLER_UA =
  /(facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|Pinterest|redditbot|Googlebot|Google-InspectionTool|AdsBot-Google|bingbot|Applebot|DuckDuckBot|Embedly|Iframely|SkypeUriPreview|vkShare|W3C_Validator|Mastodon|Threads|Bluesky)/i

function isCrawler(ua: string | null): boolean {
  return !!ua && CRAWLER_UA.test(ua)
}

// ----- isolated edge-side query layer (raw PostgREST over fetch) -----

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

/** GET a PostgREST path, returning rows or null on any failure/timeout. */
async function restGet(path: string): Promise<Row[] | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        accept: 'application/json',
      },
      // Guarantee fail-open: never hang the request waiting on Supabase.
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    return (await res.json()) as Row[]
  } catch {
    return null
  }
}

type Row = Record<string, unknown>

// ----- meta assembly (mirrors the client-side SEO logic in src/lib/seo.ts) -----

type Meta = {
  title: string
  description: string
  image: string
  url: string
  type: 'website' | 'article' | 'profile'
}

/** Collapse whitespace and clip to `n` chars for a meta description. */
function clip(s: unknown, n = 160): string {
  const clean = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + '…' : clean
}

/** First http(s) entry of a post's media array — used as the cover image. */
function coverFromMedia(media: unknown): string | null {
  if (!Array.isArray(media)) return null
  const hit = media.find((m) => typeof m === 'string' && /^https?:\/\//.test(m))
  return typeof hit === 'string' ? hit : null
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Look up per-route data and build the meta, or null if the route/row is unknown. */
async function buildMeta(url: URL): Promise<Meta | null> {
  const origin = url.origin
  const defaultImage = `${origin}/bpf-home.png`
  const path = url.pathname

  const postMatch = path.match(/^\/post\/([^/]+)\/?$/)
  if (postMatch) {
    const id = decodeURIComponent(postMatch[1])
    const rows = await restGet(
      `posts?id=eq.${encodeURIComponent(id)}&select=id,title,body,media&limit=1`,
    )
    const post = rows?.[0]
    if (!post) return null
    return {
      title: `${String(post.title)} — ${SITE}`,
      description: clip(post.body) || clip(COMMUNITY.blurb),
      image: coverFromMedia(post.media) ?? defaultImage,
      url: `${origin}/post/${String(post.id)}`,
      type: 'article',
    }
  }

  const userMatch = path.match(/^\/user\/([^/]+)\/?$/)
  if (userMatch) {
    const username = decodeURIComponent(userMatch[1])
    const rows = await restGet(
      `profiles?username=eq.${encodeURIComponent(username)}&select=username,display_name,banner,avatar_url&limit=1`,
    )
    const p = rows?.[0]
    if (!p) return null
    const display = String(p.display_name || p.username)
    return {
      title: `${display} (@${String(p.username)}) — ${SITE}`,
      description: clip(p.banner) || `${display} on ${SITE}.`,
      image: (typeof p.avatar_url === 'string' && p.avatar_url) || defaultImage,
      url: `${origin}/user/${String(p.username)}`,
      type: 'profile',
    }
  }

  if (path === '/') {
    return {
      title: `${COMMUNITY.name} — Wakanda-first fan community`,
      description: clip(COMMUNITY.blurb),
      image: defaultImage,
      url: `${origin}/`,
      type: 'website',
    }
  }

  return null
}

function renderHtml(m: Meta): string {
  const title = escapeAttr(m.title)
  const desc = escapeAttr(m.description)
  const image = escapeAttr(m.image)
  const url = escapeAttr(m.url)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${url}" />
<meta property="og:site_name" content="${escapeAttr(SITE)}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="${m.type}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${image}" />
</head>
<body></body>
</html>
`
}

export default async function middleware(request: Request): Promise<Response> {
  // Fail open: every non-crawler request (all real browsers) gets the SPA.
  if (!isCrawler(request.headers.get('user-agent'))) return next()

  try {
    const meta = await buildMeta(new URL(request.url))
    // Unknown route or missing row → let the SPA handle it unchanged.
    if (!meta) return next()
    return new Response(renderHtml(meta), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Never let a shared/CDN cache store this bot-only HTML and risk
        // serving it to a real browser. Vary is belt-and-braces for any
        // intermediary that does cache. Bot unfurl traffic is low-volume, so
        // running the middleware fresh each time costs effectively nothing.
        'cache-control': 'private, no-store',
        vary: 'User-Agent',
      },
    })
  } catch {
    // Any unexpected failure falls through to the unchanged SPA.
    return next()
  }
}
