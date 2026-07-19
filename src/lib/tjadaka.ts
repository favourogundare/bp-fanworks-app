// "Latest from T'Jadaka" sidebar widget (MILESTONES §12): read-only pull of
// the newest posts from the tjadaka.com WordPress public REST API. No auth,
// no DB — a fetch straight from the browser (the WP API sends permissive CORS
// headers). Excerpts arrive as HTML; we extract plain text via DOMParser and
// render it as text nodes, so nothing from the remote site is ever injected
// as markup.
import { timeAgo } from './time'

export interface TjadakaPost {
  id: number
  title: string
  excerpt: string // plain text, truncated
  link: string
  when: string // "3d" style, via timeAgo
  cover: string | null
}

const API = 'https://tjadaka.com/wp-json/wp/v2/posts'
const FIELDS = 'id,date,link,title,excerpt,jetpack_featured_media_url'

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

// One fetch per session — the sidebar mounts on every route change, and the
// blog updates rarely. ponytail: module memo, add TTL only if staleness bites.
let cached: Promise<TjadakaPost[]> | null = null

export function fetchLatestTjadaka(limit = 3): Promise<TjadakaPost[]> {
  if (!cached) {
    cached = fetch(`${API}?per_page=${limit}&_fields=${FIELDS}`)
      .then((r) => {
        if (!r.ok) throw new Error(`tjadaka.com responded ${r.status}`)
        return r.json()
      })
      .then((rows: any[]) =>
        rows.map((r) => {
          const excerpt = htmlToText(r.excerpt?.rendered ?? '')
          return {
            id: r.id,
            title: htmlToText(r.title?.rendered ?? '') || 'Untitled',
            excerpt: excerpt.length > 140 ? excerpt.slice(0, 140).trimEnd() + '…' : excerpt,
            link: typeof r.link === 'string' && /^https:\/\//i.test(r.link) ? r.link : 'https://tjadaka.com',
            when: timeAgo(r.date),
            cover: typeof r.jetpack_featured_media_url === 'string' && /^https:\/\//i.test(r.jetpack_featured_media_url)
              ? r.jetpack_featured_media_url
              : null,
          }
        }),
      )
      .catch((e) => {
        cached = null // allow a retry on next mount instead of caching the failure
        throw e
      })
  }
  return cached
}
