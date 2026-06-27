// =============================================================================
// Black Panther Fanworks — seed 25+ real, sign-in-able demo accounts
// -----------------------------------------------------------------------------
// Creates real Supabase Auth users (via the admin API), then gives each a themed
// profile, a couple of community posts, nested comments on other people's posts,
// and real votes. Post vote_score and member karma are recomputed automatically
// by the DB triggers from the votes this script casts — nothing is faked.
//
// This is NOT a SQL migration: creating auth users requires the service-role key
// and the admin API, so it runs as a one-off Node script.
//
// USAGE (PowerShell):
//   $env:SUPABASE_URL="https://<project>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service-role key from Supabase dashboard>"
//   node scripts/seed-demo-accounts.mjs            # create + seed
//   node scripts/seed-demo-accounts.mjs --dry-run  # show the plan, write nothing
//
// USAGE (bash / Git Bash):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo-accounts.mjs
//
// Notes:
//  * SUPABASE_URL falls back to VITE_SUPABASE_URL in your .env if not set.
//  * The service-role key bypasses Row Level Security — keep it secret, never
//    commit it. Get it from: Supabase dashboard -> Project Settings -> API ->
//    "service_role" secret.
//  * Safe to re-run: existing accounts are reused, and content seeding is skipped
//    if it has already run (pass --force to seed content again).
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ----- Config ---------------------------------------------------------------
const NUM_USERS = 25;
const EMAIL_DOMAIN = 'bpfanworks.test'; // non-delivering; clearly marks seed accounts
const QA_PASSWORD = 'bpfanworks@12';    // shared password for all seed accounts (QA)
const EMAIL_PATTERN = (i) => `test-user-${String(i).padStart(2, '0')}@${EMAIL_DOMAIN}`;

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// "Today" in the app is 2026-06-27; spread post/comment dates over the prior ~2 weeks.
const NOW = new Date('2026-06-27T12:00:00Z');
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// ----- Deterministic RNG (so repeated runs produce the same content) --------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260627);
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}
const dateWithin = () => new Date(NOW.getTime() - Math.floor(rng() * TWO_WEEKS_MS)).toISOString();

// ----- Themed content -------------------------------------------------------
const DISPLAY_NAMES = [
  'Wakanda Forever', 'Shuri Stan', 'Dora Devotee', 'Jabari Heart', 'Vibranium Vibes',
  'Golden Jaguar', 'Nakia Nation', "M'Baku My King", 'Ancestral Plane', 'Ramonda Rules',
  'Okoye Spear', 'Zuri Scrolls', "W'Kabi Herd", 'Bast Worshipper', 'Panther Goddess',
  'River Tribe', 'Border Tribe', 'Mining Tribe', 'Merchant Tribe', 'Griot Tales',
  'Heart-Shaped Herb', 'Warrior Falls', 'Talokan Tide', 'Golden City', 'Mount Bashenga',
];

const MEMBER_FLAIR_SLUGS = ['dora-milaje', 'wakandan-council', 'jabari', 'outrider', 'wkabi-stan'];

// Post templates: { title, body, type, flairSlug }
const POST_TEMPLATES = [
  { title: 'Just finished my first Shuri-centric fanfic — feedback welcome', body: "Six chapters in and I finally feel like I've got her voice down. It's a post-Wakanda Forever story where she's rebuilding the design group. Would love crit from other writers here.", type: 'text', flair: 'fanfiction' },
  { title: '[OC] Okoye spear study, ink and gold', body: 'Spent the week on the engraving detail. Trying to get the vibranium sheen right with just two colors. Crit welcome!', type: 'image', flair: 'art' },
  { title: 'My Nakia cosplay for the con this weekend', body: 'Three months of beadwork. The ring blades are foam but I am very proud of them. Wakanda forever 🛡️', type: 'image', flair: 'cosplay' },
  { title: "Unpopular opinion: M'Baku has the best arc in the whole franchise", body: 'Hear me out. He goes from challenger to ally to the man who shelters the royal family. The Jabari deserve a whole series.', type: 'text', flair: 'discussion' },
  { title: 'Lore question: how does the Heart-Shaped Herb actually work in comics canon?', body: "I've only seen the films. Trying to keep my fic accurate. Is the strength boost permanent or does it fade?", type: 'text', flair: 'question' },
  { title: 'Made a playlist for writing Wakandan court scenes', body: 'Mostly drums and strings. Drop your own writing music below, always looking for more.', type: 'text', flair: 'music' },
  { title: 'The ancestral plane is the most underused setting in the MCU', body: 'Every time we go there it is breathtaking and then we leave in two minutes. Give me a whole act there.', type: 'text', flair: 'discussion' },
  { title: '[OC] Ramonda portrait — "A queen never falls"', body: 'Wanted to honor her. Charcoal and a little gold leaf. This one got emotional to make.', type: 'image', flair: 'art' },
  { title: 'Started a Dora Milaje training-regimen headcanon doc', body: 'Building out how recruits are selected and trained. Sharing the first section, would love lore nerds to poke holes in it.', type: 'text', flair: 'fanfiction' },
  { title: 'News: rewatching the films in release order for the book club', body: 'We start Friday. Drop your hot takes in advance so we have something to argue about.', type: 'text', flair: 'news' },
  { title: 'Talokan vs Wakanda — who actually wins a full war?', body: 'No Namor restraint, no plot armor. Pure logistics. I think the water gives Talokan the edge but convince me otherwise.', type: 'text', flair: 'discussion' },
  { title: '[OC] Border Tribe blanket-armor concept', body: 'Trying to design what a modern ceremonial version would look like. Pattern study attached.', type: 'image', flair: 'art' },
];

const COMMENT_BODIES = [
  'This is incredible, the detail on the engraving is unreal.',
  "Hard agree. People sleep on this take and I don't know why.",
  'Saving this for later, thank you for writing it up.',
  'The voice work here is so good, you really nailed the character.',
  'Okay you have convinced me, I was on the fence before this.',
  'Would read a whole series of this honestly.',
  'The ancestral plane point is so real. Most underused setting in the movie.',
  'Crit: maybe more contrast in the shadows? Otherwise flawless.',
  'Joined the book club, see you all Friday.',
  'This made my whole day, thank you for sharing your work.',
  'Counterpoint: the logistics favor Wakanda because of the comms tech.',
  'The beadwork on this cosplay is on another level. Wakanda forever 🛡️',
  'Bookmarking this lore doc, super helpful for my own fic.',
  'Respectfully I think you are underrating the River Tribe here.',
  'The gold leaf was the right call, it sells the whole piece.',
];

const REPLY_BODIES = [
  'Thank you so much, that means a lot coming from this community.',
  'Good point, I had not thought about it that way.',
  'Fair! I might revise that section based on this.',
  'Exactly my thinking, glad someone else sees it.',
  'Appreciate the crit, I will push the shadows further on the next pass.',
];

// ----- Env / client setup ---------------------------------------------------
function loadEnvUrl() {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const env = readFileSync(join(here, '..', '.env'), 'utf8');
    const m = env.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* no .env, fine */ }
  return null;
}

const SUPABASE_URL = loadEnvUrl();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('✖ Missing SUPABASE_URL (or VITE_SUPABASE_URL in .env).');
  process.exit(1);
}
if (!SERVICE_KEY && !DRY_RUN) {
  console.error('✖ Missing SUPABASE_SERVICE_ROLE_KEY. Get it from Supabase dashboard -> Project Settings -> API -> service_role. Never commit it.');
  process.exit(1);
}

const supabase = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

function die(label, error) {
  console.error(`✖ ${label}:`, error?.message || error);
  process.exit(1);
}

// ----- Steps ----------------------------------------------------------------
async function ensureAuthUsers() {
  // Map existing seed emails -> auth user id (paginate to be safe).
  const existing = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) die('listUsers', error);
    for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }

  const users = []; // { email, id }
  let created = 0, reused = 0;
  for (let i = 1; i <= NUM_USERS; i++) {
    const email = EMAIL_PATTERN(i);
    const known = existing.get(email.toLowerCase());
    if (known) { users.push({ email, id: known }); reused++; continue; }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: QA_PASSWORD,
      email_confirm: true, // auto-confirm: usable immediately, no email sent
      user_metadata: { seed: true },
    });
    if (error) die(`createUser ${email}`, error);
    users.push({ email, id: data.user.id });
    created++;
  }
  console.log(`  accounts: ${created} created, ${reused} reused (${users.length} total)`);
  return users;
}

async function flairMaps() {
  const { data, error } = await supabase.from('flairs').select('id, scope, slug');
  if (error) die('load flairs', error);
  const post = new Map(), member = new Map();
  for (const f of data) (f.scope === 'post' ? post : member).set(f.slug, f.id);
  return { post, member };
}

// The signup trigger derives username from the email local-part (non-alnum stripped),
// e.g. test-user-01 -> testuser01. We look profiles up by user_id to be safe.
async function profileFor(userId) {
  const { data, error } = await supabase.from('profiles').select('id, username').eq('user_id', userId).single();
  if (error) die(`profile for ${userId}`, error);
  return data;
}

async function main() {
  console.log(`\nBlack Panther Fanworks — seed demo accounts`);
  console.log(`  target: ${SUPABASE_URL}`);
  console.log(`  plan: ${NUM_USERS} accounts (${EMAIL_PATTERN(1)} … ${EMAIL_PATTERN(NUM_USERS)}), password "${QA_PASSWORD}", email-confirmed`);
  console.log(`  each gets: a themed profile, 1–2 posts, comments on others' posts, and real votes\n`);

  if (DRY_RUN) {
    console.log('  --dry-run: no changes written. Re-run without --dry-run to apply.');
    return;
  }

  console.log('› Ensuring auth accounts…');
  const users = await ensureAuthUsers();

  console.log('› Loading flairs…');
  const flairs = await flairMaps();

  console.log('› Resolving profiles…');
  const members = [];
  for (let i = 0; i < users.length; i++) {
    const prof = await profileFor(users[i].id);
    members.push({ ...prof, displayName: DISPLAY_NAMES[i % DISPLAY_NAMES.length] });
  }

  // Idempotency guard: if these accounts already have seeded posts, stop here.
  const ids = members.map((m) => m.id);
  const { count, error: cErr } = await supabase
    .from('posts').select('id', { count: 'exact', head: true }).in('author_id', ids);
  if (cErr) die('count existing posts', cErr);
  if (count > 0 && !FORCE) {
    console.log(`\n✓ Accounts exist and already have ${count} posts — content seeding skipped (pass --force to add more).`);
    console.log('  Done.');
    return;
  }

  console.log('› Updating profiles (display name + member flair)…');
  for (const m of members) {
    const { error } = await supabase.from('profiles')
      .update({ display_name: m.displayName, member_flair_id: flairs.member.get(pick(MEMBER_FLAIR_SLUGS)) })
      .eq('id', m.id);
    if (error) die(`update profile ${m.username}`, error);
  }

  console.log('› Creating posts…');
  const posts = []; // { id, author_id, flair }
  let tmpl = 0;
  for (const m of members) {
    const n = randInt(1, 2);
    for (let k = 0; k < n; k++) {
      const t = POST_TEMPLATES[tmpl % POST_TEMPLATES.length]; tmpl++;
      const { data, error } = await supabase.from('posts').insert({
        author_id: m.id,
        surface: 'community',
        type: t.type,
        title: t.title,
        body: t.body,
        media: t.type === 'image' ? ['placeholder'] : [],
        view_count: randInt(40, 5200),
        created_at: dateWithin(),
      }).select('id').single();
      if (error) die(`insert post for ${m.username}`, error);
      posts.push({ id: data.id, author_id: m.id, flair: t.flair });
    }
  }
  console.log(`  ${posts.length} posts created`);

  console.log('› Tagging posts with flairs…');
  const flairRows = posts
    .map((p) => ({ post_id: p.id, flair_id: flairs.post.get(p.flair) }))
    .filter((r) => r.flair_id);
  if (flairRows.length) {
    const { error } = await supabase.from('post_flairs').insert(flairRows);
    if (error) die('insert post_flairs', error);
  }

  console.log('› Creating comments (with some nested replies)…');
  const comments = []; // { id, post_id, author_id }
  for (const p of posts) {
    // 1–4 top-level comments from members other than the author
    const commenters = sample(members.filter((m) => m.id !== p.author_id), randInt(1, 4));
    for (const c of commenters) {
      const { data, error } = await supabase.from('comments').insert({
        post_id: p.id, author_id: c.id, body: pick(COMMENT_BODIES), created_at: dateWithin(),
      }).select('id').single();
      if (error) die('insert comment', error);
      comments.push({ id: data.id, post_id: p.id, author_id: c.id });

      // ~40% chance the post author replies
      if (rng() < 0.4) {
        const { data: r, error: rErr } = await supabase.from('comments').insert({
          post_id: p.id, author_id: p.author_id, parent_id: data.id,
          body: pick(REPLY_BODIES), created_at: dateWithin(),
        }).select('id').single();
        if (rErr) die('insert reply', rErr);
        comments.push({ id: r.id, post_id: p.id, author_id: p.author_id });
      }
    }
  }
  console.log(`  ${comments.length} comments created`);

  console.log('› Casting votes (triggers recompute vote_score + karma)…');
  const voteRows = [];
  // Posts: each gets upvotes from a chunk of members, plus a few downvotes.
  for (const p of posts) {
    const others = members.filter((m) => m.id !== p.author_id);
    voteRows.push({ voter_id: p.author_id, target_type: 'post', target_id: p.id, value: 1 }); // self-upvote
    for (const v of sample(others, randInt(3, 18))) voteRows.push({ voter_id: v.id, target_type: 'post', target_id: p.id, value: 1 });
    for (const v of sample(others, randInt(0, 2))) voteRows.push({ voter_id: v.id, target_type: 'post', target_id: p.id, value: -1 });
  }
  // Comments: lighter voting.
  for (const c of comments) {
    const others = members.filter((m) => m.id !== c.author_id);
    for (const v of sample(others, randInt(0, 7))) voteRows.push({ voter_id: v.id, target_type: 'comment', target_id: c.id, value: 1 });
  }
  // De-dupe (unique voter+target+type) — keep the first value seen per key.
  const seen = new Set();
  const uniqueVotes = voteRows.filter((r) => {
    const key = `${r.voter_id}|${r.target_type}|${r.target_id}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
  // Insert in batches to keep each request small.
  for (let i = 0; i < uniqueVotes.length; i += 500) {
    const batch = uniqueVotes.slice(i, i + 500);
    const { error } = await supabase.from('votes').insert(batch);
    if (error) die('insert votes', error);
  }
  console.log(`  ${uniqueVotes.length} votes cast`);

  console.log(`\n✓ Done. Seeded ${members.length} accounts, ${posts.length} posts, ${comments.length} comments, ${uniqueVotes.length} votes.`);
  console.log(`  Sign in with any of: ${EMAIL_PATTERN(1)} … ${EMAIL_PATTERN(NUM_USERS)}  /  password: ${QA_PASSWORD}`);
}

main().catch((e) => die('unexpected', e));
