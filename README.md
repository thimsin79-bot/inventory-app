# inventory-app

Inventory management system built with Next.js 16 (App Router) and Supabase.

All data access is client-side through `services/inventoryService.ts`, so the RLS policies in
`supabase/schema.sql` are the only data boundary. Session reads go through `lib/supabase/dal.ts`.

## Requirements

- Node.js 20.9 or newer (Node 18 is not supported by Next.js 16)
- A Supabase project with `supabase/schema.sql` applied

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Every page except `/login` and `/signup`
requires a session and will redirect there.

## Environment variables

`.env.local` is gitignored. Vercel does not read it, so each variable must also be set in the
Vercel project's environment settings or every server-rendered page will fail.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Browser-safe key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Legacy alias, still read by `lib/supabase/{client,server}.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only admin access, required by `/admin/users`. Bypasses RLS — never prefix with `NEXT_PUBLIC_` |

The publishable key is designed to be public and ships in the client bundle. It is not a secret;
row level security is what protects your data.

## Accounts

Sign-up and sign-in take a **username and password only**. There is no email address and nothing is
ever emailed. Supabase still requires an email-shaped identity, so the username is mapped internally
to `<username>@users.invalid` — a reserved TLD that can never receive mail.

That means no email confirmation and no self-service password reset. If someone forgets their
password, an admin resets it at `/admin/users`, which needs `SUPABASE_SERVICE_ROLE_KEY` set. **Confirm
email must be off** under Authentication → Sign In / Providers, or new accounts are created that can
never sign in.

## Database setup

Run `supabase/schema.sql` in the Supabase SQL Editor, then `supabase/seed.sql` for sample data.

Policies are gated on a role claim in `raw_app_meta_data`, so an account with no role sees nothing
at all. There are four roles:

| Role | Can do |
| --- | --- |
| `viewer` | read everything, change nothing |
| `staff` | plus record movements, requests, audits and purchases |
| `manager` | plus edit categories, warehouses, suppliers and departments |
| `admin` | plus manage accounts and reset passwords |

Assign a role by hand:

```sql
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"role":"staff"}'
WHERE email = 'alice@users.invalid';
```

Use `"role":"admin"` for your own account. The user must sign in again afterwards, because the
claim is issued into their JWT at token creation.

`/admin/users` does the same thing through a form, and also resets forgotten passwords. Both need
`SUPABASE_SERVICE_ROLE_KEY`, which bypasses row-level security — that is why the page checks for the
admin role before the service-role client is ever constructed.

Keep open sign-up **enabled** under Authentication → Sign In / Providers. This app has no invite
flow and no mailbox, so public sign-up is the only way to create an account; with it off nobody can
register at all.

**A new signup starts with no role.** Sign-up runs on the anon key, which cannot write
`app_metadata`, so the account matches no policy until an admin assigns a role. That is harmless —
it sees no rows — and the app says so explicitly rather than showing empty screens, since an
unexplained blank app is indistinguishable from a broken one. Until then there is nothing to reach,
so the nav is hidden as well.

Run `npm run check` before deploying. `check:rls` diffs the policy matrix in `supabase/schema.sql`
against the role model in `lib/roles.ts` and fails if they drift.

## Deploying to Vercel

See [deploy.md](deploy.md) for the full ordered checklist, including the Supabase-side redirect
configuration that a Vercel deploy cannot complete on its own.

Push to GitHub, then import the repository at [vercel.com/new](https://vercel.com/new). The
framework preset, build command (`npm run build`), and output directory are all detected
automatically.

Set the environment variables above in the project settings before the first deploy. Tick both
**Production** and **Preview** so preview builds get them too.

Add the deployment domain to Supabase under Authentication → URL Configuration → Redirect URLs,
or sign-in will succeed and then 404 on the callback:

```
https://your-project.vercel.app/auth/callback
https://*.vercel.app/auth/callback
```

The wildcard covers preview deployments, which get a unique hostname per pull request.

### Automatic deployments

Git integration needs no further configuration once the repository is imported:

- every push to `main` produces a new production deployment
- every pull request gets an isolated preview URL
- the Node version comes from `engines.node` in `package.json`

## Verifying a release

```bash
npm run lint
npx tsc --noEmit
npm run build
```

`GET /api/supabase-test` reports connectivity and row counts against the configured project.
It only reports whether a query errored, so it does not by itself prove that RLS is applied.