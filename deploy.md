# Deploying

Runbook for shipping this app to Vercel and verifying it. `README.md` covers local setup and a
summary of the Vercel flow; this file is the ordered checklist, including the Supabase-side
configuration that a Vercel deploy cannot complete on its own.

## 1. Prerequisites

- Node.js 20.9 or newer. `engines.node` in `package.json` pins the version Vercel builds with.
- A Supabase project with `supabase/schema.sql` applied.
- A Vercel account able to import the GitHub repository.

## 2. Environment variables

Set these in the Vercel project under **Settings → Environment Variables**, not in a committed
file. Tick both **Production** and **Preview**, or preview builds fail to render any server
component.

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | yes | Project URL, e.g. `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | yes | Browser-safe key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | yes | Legacy alias, still read by `lib/supabase/{client,server}.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | no | Admin access. Never give it a `NEXT_PUBLIC_` prefix |

Rules that are easy to get wrong:

- `.env.local` is gitignored and **Vercel never reads it**. A variable that exists only locally
  is a variable the deployment does not have.
- Any `NEXT_PUBLIC_*` value is inlined into the client bundle at build time. Only the
  publishable key may be used there.
- Changing a `NEXT_PUBLIC_*` variable requires a **rebuild**, not just a restart, because the
  value is already baked into the client chunks.

`.env.example` is committed and is the source of truth for this list. Keep it in sync when the
code starts reading a new variable.

## 3. Supabase configuration

Do this before the first deploy. A deploy will succeed even if it is missing, and the failure
only shows up when someone tries to log in.

Under **Authentication → URL Configuration**:

- **Site URL**: your production origin, e.g. `https://your-project.vercel.app`.
- **Redirect URLs**:

  ```
  http://localhost:3000/auth/callback
  https://your-project.vercel.app/auth/callback
  https://*.vercel.app/auth/callback
  ```

  Add local URLs too, otherwise confirmation links stop working on your own machine. The
  wildcard covers preview deployments, which get a unique hostname per pull request.

Under **Authentication → Sign In / Providers**:

- **Confirm email: off.** Accounts here have no mailbox — the login form takes a username, which is
  mapped internally to `<username>@users.invalid`, and `.invalid` never resolves. If confirmation is
  on, a new account is created that can never sign in, because the link cannot be delivered. The
  signup form detects this and says so rather than dead-ending.
- Disable open sign-up once your accounts exist.

### No email is involved

Sign-up and sign-in are username and password only. Supabase's password grant still requires an
email-shaped identity, so `lib/auth.ts` maps the username onto the reserved `.invalid` TLD. Nothing is
ever emailed, and no address belongs to a real party.

Two consequences follow, both intentional:

- **No email confirmation and no self-service password reset.** There is no mailbox to send either
  to. A forgotten password is handled by an administrator — see below.
- **An existing account created with a real email address can no longer sign in.** The form only ever
  sends `<username>@users.invalid`, so an account whose address is `alice@gmail.com` is unreachable
  through the UI. Migrate it by renaming its address to the synthetic form:

  ```sql
  UPDATE auth.users SET email = 'alice@users.invalid' WHERE email = 'alice@gmail.com';
  ```

  Renaming frees the real address again but does **not** move the user across — they then sign up
  again with the username `alice`, which creates a second account. Delete the old row first if that
  is what you want.

### Resetting a forgotten password

`/admin/users` lets an admin set a new password by hand. It is reachable only when
`app_metadata.role` is `"admin"`, which only a Service Role key or the dashboard can write.

This step needs **`SUPABASE_SERVICE_ROLE_KEY`** set in the Vercel project, then rebuilt. Without it
the page still renders and the form returns a clear "unavailable" message rather than failing
obscurely. It is an `sb_secret_...` key from Project Settings → API → Secret keys.

The admin sets the password and hands it over themselves, so **the admin knows the user's
password**. That is the accepted cost of running without any mail infrastructure. It is not a
"forgot password" flow and should be treated as a break-glass procedure.

The service role key bypasses RLS, so the ordering in `app/actions/admin.ts` matters: the admin role
check runs *before* the client is constructed, and input is validated after it, so an unauthorised
caller cannot use the form to probe which usernames exist. `lib/roles.ts` reads the role from
`app_metadata` and never from `user_metadata`, which the account holder can write themselves —
`npm run check:auth` pins that down.

### Granting a role

Policies are gated on a role claim in `raw_app_meta_data`, so an account with no role matches no
policy and sees empty tables. Assign one per user:

```sql
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"role":"staff"}'
WHERE email = 'alice@users.invalid';
```

Use `"role":"admin"` for your own account. The user must sign in again afterwards, because the
claim is issued into their JWT at token creation time.

## 4. Import and deploy

1. Push the repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new). The framework preset, build command
   (`npm run build`), and output settings are all detected; leave them alone.
3. Add the environment variables from step 2 before the first deploy.
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
- `proxy`. Next.js 16 auto-detects the root `proxy.ts`; the build output confirms
  `ƒ Proxy (Middleware)`.
- `cleanUrls` / `trailingSlash`. Handled by Next.js routing.
- A Content-Security-Policy. Next.js hydration emits inline scripts and the browser Supabase
  client needs `connect-src` pointed at whichever project URL is configured, so a static CSP in
  `vercel.json` would break the app. Add one only if you template it from the env var.

Changing `regions` takes effect on the next deployment, and only for new deployments.

## 5. Verify a release

Run these locally before pushing:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Then against the deployed origin:

```powershell
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" https://your-project.vercel.app/
curl.exe -s https://your-project.vercel.app/api/supabase-test
```

Checklist:

- `/` returns `307` to `/login?next=%2F` when signed out. A `200` means the proxy let an
  unauthenticated request through.
- `/login` returns `200` and renders the form.
- `/api/supabase-test` returns `"status":"ready"`. `connected_with_schema_missing` means the env
  vars are wrong or `supabase/schema.sql` was never applied.
- Sign in with a known account and load `/inventory`. Rows present means the session and RLS are
  both working.

## 6. Troubleshooting

**"Account created, but it cannot sign in yet."** Supabase still has **Confirm email** enabled, so
`signUp` returned no session and the account can never be confirmed — there is no mailbox. Turn
**Confirm email** off under Authentication → Sign In / Providers.

**Sign-in says the account is "waiting to be approved".** The same cause, reached later: the account
was created while confirmation was on. Clearing the flag does not retroactively confirm it, so either
flip the setting and re-register, or confirm it directly:

```sql
UPDATE auth.users SET email_confirmed_at = now()
WHERE email = 'alice@users.invalid' AND email_confirmed_at IS NULL;
```

**An account that used to work now returns "not valid".** It was created with a real email address,
which the username-only form can never produce. See *No email is involved* in step 3 for the
migration.

**Sign-in says "That username and password combination is not valid" but the password is
right.** GoTrue returns HTTP `400` for both bad credentials and an unconfirmed account, so the
action branches on the `email_not_confirmed` code and reports the unconfirmed case separately.
`Alice` and `alice` are the same account: usernames are case-folded before they are used.

**Everything renders but every table is empty.** The signed-in account has no role claim. See
the `UPDATE auth.users` snippet in step 3.

**`totalItemsInDb` is far lower than expected.** The database is genuinely under-seeded;
`/api/supabase-test` counts real rows. Re-apply `supabase/seed.sql`.

**Build fails on a missing variable.** It was set only in `.env.local`, which Vercel cannot see.

**Any protected route returns 503, and `/login` still renders.** This is the signature of Supabase
environment variables missing from the Vercel project. `/api/supabase-test` reports
`"status":"unconfigured"` with a `details` array naming each missing or placeholder variable.

**A route returns 200 while `/api/supabase-test` says `unconfigured`.** Those were separate checks
and had drifted apart. Every consumer now shares `supabaseEnvProblems()` in
`lib/supabase/env.ts`, so the diagnostic cannot disagree with the app.

## What happens when the variables are missing

The proxy **fails closed**. Without a URL and a key no session can be verified, so serving a
protected route would hand it to an unauthenticated visitor. Public paths stay reachable so the
diagnosis is still available:

| Request | Response |
| --- | --- |
| `/`, `/items`, any protected route | `503` with a plain-text list of the missing variables |
| `/login`, `/signup` | `200`; submitting the form shows the same message inline |
| `/api/supabase-test` | `200` with `"status":"unconfigured"` and the variable names |

Earlier revisions of this app answered `200` on protected routes in this state, because the proxy
returned before the auth redirect. Nothing was leaked — RLS still applied and the browser client had
no project to query — but a shell rendering for anonymous visitors is the wrong default, so it now
refuses instead.

`lib/supabase/env.ts` treats a blank variable and an unedited `.env.example` as unconfigured. Both
were previously read as valid: `KEY=` in an env file yields `''` rather than `undefined`, and
`https://your-project-id.supabase.co` is a syntactically valid URL.

Verify the validation itself, without deploying:

```bash
npm run check:env
```

Add the variables and redeploy. A restart is not enough, because `NEXT_PUBLIC_*` values are inlined
at build time.

## 7. Rollback

Promote a known-good build from the Vercel dashboard's Deployments tab, which is faster than
reverting on `main`. To revert in Git instead:

```bash
git revert <sha>
git push origin main
```

The revert triggers a new production deploy, so it is a normal deployment, not a special path.

## 8. Before you deploy anything real

- RLS is the only data boundary, because all reads and writes go through the browser Supabase
  client in `services/inventoryService.ts`. Confirm no table has a permissive `FOR ALL USING
  (true)` policy.
- Rotate any credential that has been pasted into a chat, an issue, or a commit. Create scoped
  personal access tokens instead of classic ones, which grant full account access.
- Never commit `.env.local`. Only `.env.example` belongs in the repository.