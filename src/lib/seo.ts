// Client-side per-route SEO: updates <title>, meta description, Open Graph /
// Twitter tags, and the canonical <link> on navigation. This helps Google's
// renderer and the browser tab. (Social crawlers don't run JS — that needs the
// server-side bot meta tags, tracked separately as SEO #1.)

const SITE = 'Black Panther Fanworks'
const DEFAULT_IMAGE = '/bpf-home.png'

// Canonical URLs must always point at the production host: built from
// window.location.origin they'd emit *.vercel.app (or localhost) canonicals on
// preview deploys, splitting search-index signals across hosts.
const CANONICAL_ORIGIN = 'https://blackpantherfanworks.com'

type PageMeta = {
  title: string
  description?: string
  image?: string
  /** Path or absolute URL; defaults to the current path. */
  url?: string
  type?: 'website' | 'article' | 'profile'
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Collapse whitespace and clip to `n` chars for a meta description. */
export function clip(s: string, n = 160): string {
  const clean = (s || '').replace(/\s+/g, ' ').trim()
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + '…' : clean
}

function absolute(u: string): string {
  try {
    return new URL(u, CANONICAL_ORIGIN).toString()
  } catch {
    return CANONICAL_ORIGIN + '/'
  }
}

/** Set the document title + canonical + OG/Twitter tags for the current route. */
export function setPageMeta({ title, description, image, url, type = 'website' }: PageMeta) {
  document.title = title
  const canonical = absolute(url ?? window.location.pathname)
  const img = absolute(image ?? DEFAULT_IMAGE)

  if (description) upsertMeta('name', 'description', description)
  upsertLink('canonical', canonical)

  upsertMeta('property', 'og:site_name', SITE)
  upsertMeta('property', 'og:title', title)
  if (description) upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:type', type)
  upsertMeta('property', 'og:url', canonical)
  upsertMeta('property', 'og:image', img)

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', title)
  if (description) upsertMeta('name', 'twitter:description', description)
  upsertMeta('name', 'twitter:image', img)
}
