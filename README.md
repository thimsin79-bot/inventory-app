# inventory-app

Inventory management system built with Next.js 16 (App Router) and Supabase.

All data access is client-side through `services/inventoryService.ts`.

**There is no authentication.** See [Access control](#access-control) below before you deploy
this anywhere.

## Requirements

- Node.js 20.9 or newer (Node 18 is not supported by Next.js 16)
- A Supabase project with `supabase/schema.sql` applied

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Every page is reachable — there is no
login screen and no session to create.

## Environment variables

`.env.local` is gitignored. Vercel does not read it, so each variable must also be set in the
Vercel project's environment settings.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Browser-safe key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Legacy alias, still read by `lib/supabase/{client,server}.ts` |

The publishable key is designed to be public and ships in the client bundle. There is no
server-side secret: no `SUPABASE_SERVICE_ROLE_KEY`, and nothing in the repo reads one.

## Access control

This application has **no authentication, no sessions, no roles and no server-side user.** It
holds one credential — the publishable key — and every request it makes reaches PostgREST as the
`anon` role.

`supabase/schema.sql` grants `anon` full read and write on all eleven tables. **Those policies are
not a security boundary.** They exist so the app functions. Anyone who reaches the Supabase
project directly can read and write everything, because the key is public by design.

The only gate is **Vercel Deployment Protection** (Project Settings → Deployment Protection),
which 302s anonymous traffic to Vercel SSO:

- while it is **on**, only users with an account in your Vercel team can open the app at all
- if anyone turns it **off** to share a link, the inventory becomes world-writable at that URL,
  and the Supabase project is reachable directly with the public key

There is no per-user identity, so `transactions.created_by` and `requests.requested_by` are free
text the UI types in — nothing validates or attributes them.

Two limits do survive in the schema:

- `DELETE` is withheld at the grant on `purchases`, `transactions`, `requests` and `audits`,
  because no screen deletes them. `items` and the reference tables keep it.
- `authenticated` is revoked on every table, so an account left over from before is not a way in.

## Database setup

Run `supabase/schema.sql` in the Supabase SQL Editor, then `supabase/seed.sql` for sample data.

The script generates two policies per table (`read`, `write`) inside one `DO` block rather than
hand-writing thirty-six, and is re-runnable: it drops its own policies by name and retires the
older role-ladder and public-access ones.

Running it makes the boundary match this repo. Until then, the live project holds whatever the
previous run created — measured 2026-10-06, anon *can* read rows, but only `items` still has any
data (2 rows; the other eight tables are empty), so also run `supabase/seed.sql` if you want a
populated app.

Run `npm run check` before deploying. `check:rls` reads the policies back out of
`supabase/schema.sql` and fails if a table is left uncovered, if the grants and the policies
disagree, if `DELETE` leaks onto a table nothing deletes from, or if a role-ladder construct or a
`FOR ALL` catch-all comes back.

## Deploying to Vercel

See [deploy.md](deploy.md) for the full ordered checklist.

Push to GitHub, then import the repository at [vercel.com/new](https://vercel.com/new). The
framework preset, build command (`npm run build`), and output directory are all detected
automatically.

Set the environment variables above in the project settings before the first deploy. Tick both
**Production** and **Preview** so preview builds get them too.

Leave **Deployment Protection on** while deciding how this is meant to be shared — it is the only
thing standing between a public URL and a fully open inventory. If it must go off for non-Vercel
users to see the app, an authentication layer has to be built first; configuration alone cannot
replace it, because row level security has no identity to check.

### Automatic deployments

Git integration needs no further configuration once the repository is imported:

- every push to `main` produces a new production deployment
- every pull request gets an isolated preview URL
- the Node version comes from `engines.node` in `package.json`

## Verifying a release

```bash
npm run check    # check:env + check:rls
npm run lint
npx tsc --noEmit
npm run build
```

`GET /api/supabase-test` reports connectivity and row counts against the configured project.
It is unauthenticated and returns sample rows, so do not treat it as something to leave exposed
for long — nothing in the app calls it.
