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

- **Confirm email**. With this on, every new account must click an emailed link before it can
  sign in. Leave it on for production and attach real SMTP; turn it off only for local work.
- Disable open sign-up once your accounts exist.

Under **Authentication → Email**:

- Attach a real SMTP provider. The built-in mailer is rate-limited, so signups silently fail to
  deliver and nobody can ever confirm.

### Granting a role

Policies are gated on a role claim in `raw_app_meta_data`, so an account with no role matches no
policy and sees empty tables. Assign one per user:

```sql
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"role":"staff"}'
WHERE email = 'you@example.com';
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
- Sign in with a confirmed account and load `/inventory`. Rows present means the session and RLS
  are both working.

## 6. Troubleshooting

**Sign-in fails with "That email and password combination is not valid" but the password is
correct.** The account exists and is unconfirmed. GoTrue returns HTTP `400` with code
`email_not_confirmed`, which is the same status used for bad credentials; the login action
branches on the code so this case now reports itself. Confirm the account, use the resend button
on `/login`, or turn off **Confirm email** for local work.

**Confirmation email never arrives.** No SMTP provider is attached, or the built-in rate limit
was hit. Attach SMTP under Authentication → Email.

**Confirmation link 404s.** The deployment origin is missing from Redirect URLs, so Supabase
redirects to the Site URL instead. See step 3.

**Everything renders but every table is empty.** The signed-in account has no role claim. See
the `UPDATE auth.users` snippet in step 3.

**`totalItemsInDb` is far lower than expected.** The database is genuinely under-seeded;
`/api/supabase-test` counts real rows. Re-apply `supabase/seed.sql`.

**Build fails on a missing variable.** It was set only in `.env.local`, which Vercel cannot see.

**`/login` and `/signup` return 500 while `/` returns 200.** This is the signature of Supabase
environment variables missing from the Vercel project, and it is worth recognising because the
symptom looks like an auth bug rather than a config bug. `lib/supabase/server.ts` asserts those
variables with `!`, which is a compile-time-only check, so `undefined` is handed to
`createServerClient` and it throws. At the same time `lib/supabase/proxy.ts` returns early when
the variables are absent, which skips the auth redirect entirely, so `/` answers `200` instead of
`307`. Confirm with `GET /api/supabase-test` and look for `"status":"unconfigured"`.

No data is exposed in this state, because with no URL or key the browser client has nothing to
query. Add the variables and redeploy.

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