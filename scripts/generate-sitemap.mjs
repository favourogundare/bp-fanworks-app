// Generates public/sitemap.xml from the live data: home, every public community
// post, and every member profile. Runs automatically before `npm run build`
// (see the "prebuild" script), so each deploy ships a fresh sitemap.
//
// Reads Supabase creds from env (SUPABASE_URL / VITE_SUPABASE_URL and the anon
// key), falling back to .env locally. If creds are missing or the query fails,
// it still writes a home-only sitemap rather than breaking the build.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const SITE_URL = (process.env.SITE_URL || 'https://blackpantherfanworks.com').replace(/\/$/, '')

function fromEnvFile(key) {
  try {
    const env = readFileSync(join(root, '.env'), 'utf8')
    const m = env.match(new RegExp('^\\s*' + key + '\\s*=\\s*(.+)\\s*$', 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined
  } catch {
    return undefined
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fromEnvFile('VITE_SUPABASE_URL')
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || fromEnvFile('VITE_SUPABASE_ANON_KEY')

const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))

const urls = [{ loc: SITE_URL + '/', priority: '1.0' }]

if (url && anon) {
  try {
    const sb = createClient(url, anon)
    const [posts, profiles, flairs] = await Promise.all([
      sb.from('posts').select('id, created_at').eq('surface', 'community').order('created_at', { ascending: false }).limit(5000),
      sb.from('profiles').select('username').limit(5000),
      sb.from('flairs').select('slug').eq('scope', 'post'),
    ])
    for (const f of flairs.data ?? []) urls.push({ loc: `${SITE_URL}/t/${encodeURIComponent(f.slug)}`, priority: '0.6' })
    for (const p of posts.data ?? []) urls.push({ loc: `${SITE_URL}/post/${p.id}`, lastmod: p.created_at, priority: '0.7' })
    for (const pr of profiles.data ?? []) urls.push({ loc: `${SITE_URL}/user/${encodeURIComponent(pr.username)}`, priority: '0.5' })
  } catch (e) {
    console.warn('sitemap: skipping dynamic URLs —', e.message)
  }
} else {
  console.warn('sitemap: no Supabase creds in env/.env; writing home-only sitemap.')
}

const body = urls
  .map((u) => {
    const lastmod = u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''
    return `  <url><loc>${xmlEscape(u.loc)}</loc>${lastmod}<priority>${u.priority}</priority></url>`
  })
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`

writeFileSync(join(root, 'public', 'sitemap.xml'), xml)
console.log(`sitemap: wrote ${urls.length} url(s) to public/sitemap.xml`)
