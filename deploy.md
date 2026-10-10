# Deploying

Runbook for shipping this app to Vercel and verifying it. `README.md` covers local setup and a
summary of the Vercel flow; this file is the ordered checklist, including the Supabase-side
configuration that a Vercel deploy cannot complete on its own.

Authentication was removed on 2026-10-06 — no login, no sessions, no roles, no server-side user.
Two decisions therefore have to be made by hand before anything real goes out: who can reach the
URL (step 2) and whether the live database has been moved onto the new policies (step 4).

## 1. Prerequisites

- Node.js 20.9 or newer. `engines.node` in `package.json` pins the version Vercel builds with.
- A Supabase project with `supabase/schema.sql` applied. If it has not been re-run since
  2026-10-06, see step 4 — that is a blocker, not a formality.
- A Vercel account able to import the GitHub repository, plus a decision about who in the team
  gets a Vercel account (step 2).

## 2. Decide who can reach the app

**Deployment Protection is the only access control this application has, and it has to be
consciously decided. Nothing below — environment variables, schema, headers — substitutes for it.**

The app holds exactly one credential: the Supabase publishable key, which ships to the browser by
design. Every database request therefore reaches PostgREST as the `anon` role, and
`supabase/schema.sql` grants `anon` read and write on all ten tables. Those grants exist so the
app functions; they are **not** a security boundary, and row level security cannot tighten them,
because there is no identity for it to check.

The one gate is **Vercel Deployment Protection** (Project Settings → Deployment Protection), which
302s anonymous traffic to Vercel SSO. It is currently **on**, and both settings have a cost:

- **On:** only people with an account in your Vercel team can open the app at all. Ordinary staff
  need a Vercel account in the team to see anything — probably not what a school wants, but it is
  the only arrangement the current code supports.
- **Off:** the inventory becomes world-writable at that URL, and the Supabase project is reachable
  directly from any browser with the public key. Anyone who can load the page can write to every
  table.

Turning it off to share a link is therefore a deliberate, recorded decision, not a routine toggle.
Sharing with people who have no Vercel account means building an authentication layer again; no
dashboard setting can stand in for one. Step 6 assumes the gate is on.

## 3. Environment variables

Set these in the Vercel project under **Settings → Environment Variables**, not in a committed
file. Tick both **Production** and **Preview**, or a preview deployment is built without them and
every screen reports a missing variable.

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | yes | Project URL, e.g. `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | yes | Browser-safe key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | yes | Legacy alias; `lib/supabase/env.ts` accepts it when the publishable key is unset |

That is the whole list. There is no server-side secret: nothing in the repo reads a service-role
or `sb_secret_` key, and there is no privileged client to leak.

Rules that are easy to get wrong:

- `.env.local` is gitignored and **Vercel never reads it**. A variable that exists only locally
  is a variable the deployment does not have.
- Any `NEXT_PUBLIC_*` value is inlined into the client bundle at build time. Only the
  publishable key may be used there.
- Changing a `NEXT_PUBLIC_*` variable requires a **rebuild**, not just a restart, because the
  value is already baked into the client chunks.

`.env.example` is committed and is the source of truth for this list. Keep it in sync when the
code starts reading a new variable.

## 4. Supabase configuration

Do this before the first deploy. A deploy succeeds even when it is missing, because nothing in the
build touches the database — the gap only shows up as a boundary that does not match the repo.

### Re-run `supabase/schema.sql` (blocking)

`supabase/schema.sql` was rewritten on 2026-10-06 when authentication was removed, and it has
**not been run against the live project yet**, so the live policies are whatever the previous run
created rather than what this repo describes.

Measured on 2026-10-06 with the publishable key straight against PostgREST (`select=*&count=exact`
per table, read-only):

| | categories | items | warehouses | suppliers | departments | purchases | transactions | requests | audits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| observed | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

So anon **can** read — the app is not blank today — but only `items` has any data left. Two
practical consequences: running this file is about making the boundary match the repo, and the
row counts this project once had are gone, so run `supabase/seed.sql` too if you want a populated
app.

Paste the whole file into the Supabase dashboard → **SQL Editor** → new query and run it. It is
re-runnable: it drops its own policies by name, retires the older role-ladder and public-access
policies, drops `private.current_role()` and the `private` schema itself, then generates
`TO anon USING (true)` / `WITH CHECK (true)` policies on all ten tables and grants `anon`
SELECT, INSERT, UPDATE and DELETE.

**No script in the repo executes SQL.** There is no migration runner and no CLI step; nothing in
`npm run build` or the Vercel deploy touches the database. Running the file in the SQL editor is
a manual step, and nothing reminds you it is outstanding.

Two details in the new script worth knowing:

- `DELETE` is withheld at the grant on `purchases`, `transactions`, `requests` and `audits`,
  because nothing in the app deletes them. `items` and the four reference tables keep it.
- `authenticated` is revoked on every table, so an account left over from before the removal is
  not a way in.

Re-run the probe above after the script finishes. The one outcome that matters — and that
`npm run check` cannot see, because it only reads the file — is anon losing its rows: a run that
leaves every screen empty while `/api/supabase-test` still reports `"status":"ready"`.

Once the schema is applied, run `supabase/seed.sql` for sample data if the project is new.

## 5. Import and deploy

1. Push the repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new). The framework preset, build command
   (`npm run build`), and output settings are all detected; leave them alone.
3. Add the environment variables from step 3 before the first deploy.
4. Deploy.

With Git integration enabled, no further configuration is needed:

- every push to `main` produces a new production deployment
- every pull request gets an isolated preview URL
- the Node version comes from `engines.node`

Check which projects are wired to the repository, because a repo can be connected to more than
one and every push then builds each of them:

```powershell
Invoke-RestMethod https://api.github.com/repos/<owner>/<repo>/deployments `
  -Headers @{ 'User-Agent' = 'opencode'; Accept = 'application/vnd.github+json' }
```

To confirm the link from your machine:

```powershell
npx vercel ls
npx vercel inspect <deployment-url>
```

### What `vercel.json` sets

The repo pins only what is worth pinning. Anything left to Vercel's autodetection stays that
way, so a dashboard override cannot drift away from the repository.

| Key | Value | Why |
| --- | --- | --- |
| `framework` | `nextjs` | Explicit, so a renamed repo cannot be misdetected as a static site |
| `regions` | `["syd1"]` | Sydney (`ap-southeast-2`), the same region as the Supabase project. Vercel defaults to `iad1` (Washington, D.C.), which puts every function call a continent away from the database. Vercel's own guidance is to run functions in the same region as the database |
| `headers` | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` | Baseline hardening; the app embeds nothing and makes no cross-origin reads |

Deliberately **not** set:

- `buildCommand` / `installCommand` / `outputDirectory`. These are detected correctly, and pinning
  them means a later change to `package.json` gets silently overridden.
- `proxy`. There is no middleware to detect: `proxy.ts` was deleted again on 2026-10-09 (an
  auth layer had been added and then removed a second time), and the build output has no
  `ƒ Proxy (Middleware)` line.
- `cleanUrls` / `trailingSlash`. Handled by Next.js routing.
- A Content-Security-Policy. Next.js hydration emits inline scripts and the browser Supabase
  client needs `connect-src` pointed at whichever project URL is configured, so a static CSP in
  `vercel.json` would break the app. Add one only if you template it from the env var.

Changing `regions` takes effect on the next deployment, and only for new deployments.

## 6. Verify a release

Run these locally before pushing:

```bash
npm run check    # check:env + check:rls + check:gate, 22 / 53 / 22 assertions
npm run lint
npx tsc --noEmit
npm run build
```

The build output should list the eleven app screens plus `/admin/users` as `○ Static` and the API
routes as `ƒ (Dynamic)`.

Then locally, with a dev server on `:3000`:

```powershell
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" http://localhost:3000/       # 200, no redirect
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/login                     # 404
curl.exe -s http://localhost:3000/api/supabase-test                                  # {"status":"ready",...}
```

And against the deployed origin:

```powershell
$site = "https://inventory-app-thimsin.vercel.app"
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" $site/
curl.exe -s -o NUL -w "%{http_code}" "$site/login"
curl.exe -s "$site/api/supabase-test"
```

While Deployment Protection is on, **every production curl returns `302` to Vercel SSO**. That is
the expected answer and confirms the gate from step 2 is working — it is not a fault. To check
the app itself, either sign in through a browser with a Vercel team account or deliberately turn
the gate off (step 2), and remember it is on again afterwards.

Checklist:

- Locally `/` returns `200` with no redirect. A redirect to `/sign-in` would mean the session
  gate is back.
- `/login`, `/signup`, `/auth/callback` and `/warehouses` all return `404` — those routes were
  deleted. A `200` on any of them means a stale build. `/admin/users` returns `200`: the Admin
  Console lives there now, behind its shared-secret lock.
- `/api/supabase-test` returns `"status":"ready"`. `unconfigured` means the env vars from step 3
  are missing or still placeholders; `connected_with_schema_missing` means the tables do not
  exist at all.
- `/inventory` shows rows with no sign-in, because there is nothing to sign in to. As measured in
  step 4, only `items` has data — the other eight screens are empty because the project has no
  rows, not because a policy is refusing them. Running `supabase/seed.sql` is what fills them.
  A "Database schema not applied" panel means `schema.sql` has never run on that project at all.

## 7. Troubleshooting

**"Every table except items is empty."** That is the state measured on 2026-10-06: `items` had 2
rows and the other eight tables had none. It is missing data, not a policy refusing you — anon
reads rows fine. Run `supabase/seed.sql`. To tell data from a policy problem, compare against
`/api/supabase-test`: if it reports `"ready"` and the screens are still empty, the rows are not
there. A policy that matches nothing returns empty rather than an error, so neither surface
distinguishes them on its own — use the probe in step 4.

**Every screen shows `Supabase is not configured: …`.** The variable named in the message is
unset or still holds the `.env.example` placeholder in the environment that built the page —
`.env.local` locally, project environment variables on Vercel. See *What happens when the
variables are missing* below.

**The page loads but every screen sits in an error state while `/api/supabase-test` says
`unconfigured`.** Not a contradiction: the ten screens are static shells and the data fetch
happens in the browser. Every consumer shares `supabaseEnvProblems()` in `lib/supabase/env.ts`,
so the diagnostic cannot disagree with the app about which variable is wrong.

**Curl against production always returns `302`.** That is Deployment Protection (step 2), and it
is working as intended. Verify locally instead, or use a browser signed in to the Vercel team.

**`totalItemsInDb` is far lower than expected.** The database is genuinely under-seeded;
`/api/supabase-test` counts real rows. Re-apply `supabase/seed.sql`.

**A variable exists but the deployment cannot see it.** It was set only in `.env.local`, which
Vercel never reads. Set it in the project environment settings, then rebuild — `NEXT_PUBLIC_*`
values are inlined at build time, so a restart is not enough.

**`check:rls` fails after editing `supabase/schema.sql`.** It reads the file back and fails if a
table is left uncovered, if grants and policies disagree, if `DELETE` leaks onto one of the four
tables nothing deletes from, or if a role ladder or `FOR ALL` catch-all comes back. Fix the
script, not the assertion.

## What happens when the variables are missing

There is no proxy to fail closed any more (`proxy.ts` was deleted again on 2026-10-09), so a missing
variable surfaces inside the running app instead of as a `503`:

| Request | Response |
| --- | --- |
| any app screen | `ErrorState` naming the missing or placeholder variable; the header badge reads `Supabase Not configured` |
| `/api/supabase-test` | `200` with `"status":"unconfigured"` and the variable names in `details` |
| `/login`, `/signup`, `/warehouses` | `404`; the routes no longer exist |
| `/admin/users` | `200`; the Admin Console renders its lock screen, and unlocks only with the shared secret |

`lib/supabase/env.ts` treats a blank variable and an unedited `.env.example` as unconfigured. Both
were previously read as valid: `KEY=` in an env file yields `''` rather than `undefined`, and
`https://your-project-id.supabase.co` is a syntactically valid URL.

Verify the validation itself, without deploying:

```bash
npm run check:env
```

Add the variables and redeploy. A restart is not enough, because `NEXT_PUBLIC_*` values are inlined
at build time.

## 8. Rollback

Promote a known-good build from the Vercel dashboard's Deployments tab, which is faster than
reverting on `main`. To revert in Git instead:

```bash
git revert <sha>
git push origin main
```

The revert triggers a new production deploy, so it is a normal deployment, not a special path.

## 9. Before you deploy anything real

- All reads and writes go through the browser Supabase client in `services/inventoryService.ts`,
  as `anon`, and the schema grants `anon` everything on purpose. RLS is not a security boundary
  here — Deployment Protection (step 2) is the entire boundary, and `npm run check:rls` is what
  keeps the schema honest about which table grants what. Do not widen a policy to make a query
  pass without reading `CLAUDE.md` §3 first.
- Rotate any credential that has been pasted into a chat, an issue, or a commit. Create scoped
  personal access tokens instead of classic ones, which grant full account access.
- Never commit `.env.local`. Only `.env.example` belongs in the repository.
