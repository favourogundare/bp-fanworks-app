#!/usr/bin/env node
// Social-card checker (MILESTONES §11 #7). Fetches routes as a crawler and
// asserts the Open Graph / Twitter tags that Discord, Facebook, Slack, and
// Twitter/X need for a rich unfurl. Run against any deploy:
//
//   node scripts/check-social-cards.mjs https://blackpantherfanworks.com
//   node scripts/check-social-cards.mjs http://localhost:5173 <postId> <username>
//
// Exits non-zero if any required tag is missing, so it can gate CI later.

const base = (process.argv[2] || 'https://blackpantherfanworks.com').replace(/\/$/, '')
const postId = process.argv[3] // optional: a real post id to check /post/:id
const username = process.argv[4] // optional: a real username to check /user/:username

const UA = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discord.com)'

// Tags every unfurled page must carry, plus per-type extras.
const BASE_REQUIRED = [
  'og:title', 'og:description', 'og:type', 'og:url', 'og:image',
  'og:image:alt', 'og:image:width', 'og:image:height', 'og:locale', 'og:site_name',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt',
]

function parseTags(html) {
  const tags = {}
  const re = /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g
  let m
  while ((m = re.exec(html))) tags[m[1]] = m[2]
  return tags
}

async function checkRoute(path, required) {
  const url = base + path
  const res = await fetch(url, { headers: { 'user-agent': UA } })
  const html = await res.text()
  const tags = parseTags(html)
  const missing = required.filter((t) => !(t in tags) || tags[t] === '')
  // A post cover may be an uploaded image of unknown size; width/height are only
  // promised for the default share image. Treat them as soft on /post/ pages.
  const hard = path.startsWith('/post/')
    ? missing.filter((t) => t !== 'og:image:width' && t !== 'og:image:height')
    : missing
  const ok = hard.length === 0
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${path}`)
  if (missing.length) console.log(`      missing: ${missing.join(', ')}${hard.length === 0 ? ' (soft — uploaded cover)' : ''}`)
  return ok
}

const routes = [['/', BASE_REQUIRED]]
if (postId) routes.push([`/post/${postId}`, [...BASE_REQUIRED, 'article:published_time', 'article:author']])
if (username) routes.push([`/user/${username}`, [...BASE_REQUIRED, 'profile:username']])

let allOk = true
for (const [path, req] of routes) allOk = (await checkRoute(path, req)) && allOk
if (!postId || !username) {
  console.log('\nTip: pass a real <postId> and <username> to also check article/profile cards.')
}
process.exit(allOk ? 0 : 1)
