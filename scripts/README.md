# scripts/

One-off maintenance scripts. These are **not** part of the app bundle.

## `seed-demo-accounts.mjs` — seed 25+ real demo accounts

Creates 25 real, sign-in-able Supabase Auth users, each with a themed profile,
1–2 community posts, comments on other members' posts, and real votes. Post
`vote_score` and member `karma` are recomputed by the database triggers from the
votes the script casts — nothing is faked.

Because it creates **auth users**, it uses the Supabase **admin API + service-role
key** rather than a SQL migration.

### Run it

```bash
# bash / Git Bash
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role secret>" \
npm run seed:accounts
```

```powershell
# PowerShell
$env:SUPABASE_URL="https://<project>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service_role secret>"
npm run seed:accounts
```

- `SUPABASE_URL` falls back to `VITE_SUPABASE_URL` in `.env`.
- Get the **service_role** secret from: Supabase dashboard → Project Settings → API.
  It bypasses Row Level Security — **never commit it**.
- `--dry-run` prints the plan and writes nothing. `--force` seeds content again
  for accounts that already exist.
- Accounts: `test-user-01@bpfanworks.test … test-user-25@bpfanworks.test`,
  shared QA password `bpfanworks@12`, email auto-confirmed.

Safe to re-run: existing accounts are reused and content seeding is skipped once
it has run.
