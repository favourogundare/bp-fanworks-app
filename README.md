# bp-fanworks-app

Black Panther Fanworks — a single-community social site (React + TypeScript + Vite,
backed by Supabase, deployed on Vercel).

Live: https://blackpantherfanworks.com

## Develop

```bash
npm install
npm run dev      # local dev server (http://localhost:5173)
npm run build    # production build (tsc + vite)
```

Environment: copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`.

## Database migrations

Schema changes are tracked as SQL files in `supabase/migrations/` and managed with
the Supabase CLI:

```bash
npx supabase migration new my_change   # create a new migration file
#  → edit the generated file in supabase/migrations/ with your SQL
npx supabase db push                   # apply it to the linked project
```

Pushing to `develop` deploys the app (Vercel) and applies new migrations (Supabase
GitHub integration).

## Contributors

- [@favourogundare](https://github.com/favourogundare)
- [@rishii-hub](https://github.com/rishii-hub)
- [@Zaid1287](https://github.com/Zaid1287)
- [@maricorper](https://github.com/maricorper)
