@AGENTS.md

# Project Context: Inventory Management System (Next.js + Supabase)

**Last Updated:** October 5, 2026
**Project Path:** `D:\ICT\inventory-app`
**Origin:** Port of the single-file prototype `D:\ICT\app.js` (school inventory for Cambodia).
**Production:** `https://inventory-app-thimsin.vercel.app/` — auto-deploys from `origin/main` through
the Vercel Git integration. Confirmed working 2026-10-05 without any Vercel API access: copy unique to
commit `ee14fe0` was visible in production. See §8 for how to verify a deploy that way.

---

## 1. Stack & Environment

- **Next.js** 16.3.8 (App Router, Turbopack), **React** 19.2.8, TypeScript, **Tailwind CSS** v4, ESLint 9
- **Supabase** `@supabase/ssr` + `@supabase/supabase-js`
- Node v24.21.0, npm 11, path alias `@/*`
- Supabase project `bktxzesvtmgcmznsfnlu` (`ap-southeast-2`). Seed data is applied; the **role-ladder
  schema is not** — `supabase/schema.sql` has not been re-run since the ladder landed, so the live
  policies are still the old `('admin','staff')` ones. See §3b.
- **No test framework, and deliberately none.** Three dependency-free Node scripts hold the logic a
  test runner would otherwise cover: `npm run check` = `check:env` + `check:auth` + `check:rls`,
  25 / 127 / 31 assertions. They import `.ts` files directly via Node's type stripping, which is why
  `lib/roles.ts` imports nothing. Then `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## 2. Actual Folder Layout

```
app/
  layout.tsx              root: Geist fonts, metadata, suppressHydrationWarning
  (app)/                  the 10 app screens + shared sidebar shell
  (auth)/                 /login and /signup, centered card
  actions/auth.ts         'use server': login, signup, signOut
  auth/callback/route.ts  PKCE code exchange for emailed confirmation links
  api/supabase-test/      connection diagnostic (intentionally public)
components/               flat: ui.tsx primitives, Nav, DataTable, Modal, forms, ConnectionStatus, UserMenu
hooks/useAsyncData.ts     loading/error/reload wrapper for client fetches
lib/auth.ts               AuthState, safeNextPath, email + password rules
lib/roles.ts              ROLES, CAPABILITIES, roleOf/isAdmin/isManager/can*, ROLE_LABELS, and the
                          admin-screen helpers (mergeRoleInto, describeAccount, canChangeOwnRole).
                          Imports nothing at all — see §3.
components/Permissions.tsx  capability context for the client screens
lib/supabase/             client.ts, server.ts, proxy.ts, admin.ts, dal.ts
services/inventoryService.ts   all data access, browser Supabase client
supabase/schema.sql       tables + RLS, policies generated from role/table arrays (§3b)
supabase/seed.sql         verified reference data
types/database.types.ts   generated from the live schema
utils/format.ts, utils/errors.ts   live helpers
utils/supabase/*          DEAD duplicates of lib/supabase — delete candidate
```

Note: earlier notes in this file described `components/ui/`, `components/layout/`, `hooks/useDebounce.ts`, `lib/mockData.ts`. Those were never built. The flat structure above is what exists.

**Screens:** `/`, `/inventory`, `/purchases`, `/transactions`, `/requests`, `/audits`, `/categories`, `/warehouses`, `/suppliers`, `/departments`, `/admin/users`.

---

## 3. Authentication

Username + password with **public sign-up** (self-registration over admin-provisioned accounts).
No email address is collected anywhere.

- Supabase's password grant only accepts an email or phone, so `lib/auth.ts` maps a username onto
  `<username>@users.invalid`. `.invalid` is reserved by RFC 2606 and never resolves, so nothing can
  be delivered to it and no address belongs to a real party.
- Usernames are **case-folded** (`normalizeUsername`) before use. Without it `Alice` and `alice`
  would be two accounts with two passwords, which is impersonation, not cosmetics. `@` is rejected
  in the pattern, which is what stops a crafted username escaping the synthetic domain.
- No email confirmation. A forgotten password is an administrator task via `/admin/users`, not
  self-service, because there is no mailbox to send a reset link to. The cost is that the admin
  learns the password and passes it on over a channel they trust. `Confirm email` must be **off** in
  the project or new accounts are created that can never sign in.
- `proxy.ts` → `lib/supabase/proxy.ts` refreshes the session cookies, then applies the optimistic route check: unauthenticated → `/login?next=…`, authenticated hitting `/login` or `/signup` → `/`. `PUBLIC_PATHS = /login, /signup, /auth/callback, /api/supabase-test`.
- `lib/supabase/dal.ts` is the session API: `getUser()` (React `cache` memoized) and `requireUser()` (redirects). Server Components and handlers must read the user here, never `supabase.auth` directly. `getUser()` returns `null` when Supabase is unconfigured rather than throwing, so `/login` still renders; the proxy fails closed in that state.
- Server actions `login`, `signup`, `signOut` in `app/actions/auth.ts` use `useActionState`. Passwords require ≥8 characters, a letter, and a number. Errors are mapped for 400 invalid credentials, 422 username-taken, 429 rate limits, and `email_not_confirmed` (reported as "waiting to be approved", not as a wrong password).
- Sign-up writes `user_metadata.username` only. `app_metadata` carries the role RLS reads and must never be settable from a public form.
- Sign-out is `<form action={signOut}>` inside `components/UserMenu.tsx`, wrapped in `<Suspense>` in the `(app)` layout so `cookies()` does not hold back the first chunk.
- Project auth config: `mailer_autoconfirm: true` (verified 2026-10-05) so sign-in works immediately.
  Anonymous sign-ins are off.
- **Sign-up must stay enabled.** It was `disable_signup: true` on `bktxzesvtmgcmznsfnlu` for most of
  2026-10-05, returning `422 signup_disabled` to every submission; it was switched off in the
  dashboard mid-session and re-verified as `false` the same day, with `POST /auth/v1/signup` returning
  200. There is no invite flow and no mailbox, so public sign-up is the *only* onboarding path — with
  it off, no account can be created at all and `app/actions/auth.ts` reports it as a switch to flip
  rather than leaking the GoTrue string. **Re-check `GET /auth/v1/settings` before assuming either
  value**; it has already changed once.
- `app/(app)/admin/users/` is the admin-only password reset. It sits in the `(app)` group so it inherits `requireUser()` from the proxy, and calls `requireAdmin()` on top. `SUPABASE_SERVICE_ROLE_KEY` is now **required** for it, because the Service Role bypasses RLS and nothing else guards that path.
- Ordering in `app/actions/admin.ts` is deliberate: authorize with `requireAdmin()` **before** constructing the service-role client, and validate input afterwards, so an unauthorized caller cannot use the form to enumerate usernames.
- `lib/roles.ts` reads the role from `app_metadata`, never `user_metadata` — the account holder can write `user_metadata` themselves via `supabase.auth.updateUser`, so reading it would be self-promotion. It **imports nothing at all**, not even a sibling module, because `npm run check:auth` loads it directly with Node's type stripping and has no bundler to resolve an import. Anything it needs is passed in as an argument.
- An unrecognised role string returns `null` rather than the raw value, so a role added in only one place gets **no** capabilities instead of silently inheriting a tier. `can()` looks the capability record up defensively so a missing record denies rather than throwing.
- A **role-less account is the normal state for a new signup.** Signup runs on the anon client, which cannot write `app_metadata`, so nothing grants a role until someone does. `capabilitiesOf` returns all-false and `app/(app)/layout.tsx` swaps the whole screen for an empty state and drops the nav, because every link would otherwise land on an empty page. The user menu stays so they can sign out. The empty state names **both** routes — ask an admin, or set it in the Dashboard — because for the first account in a project there is nobody to ask, and the obvious instruction is a dead end.
- `/admin/users` assigns roles via `setRole` in `app/actions/admin.ts`, writing `app_metadata` through the Service Role. It **merges** via `mergeRoleInto` rather than replacing. Changing your **own** role is allowed as long as another admin remains — `canChangeOwnRole` in `lib/roles.ts` decides it by counting admins among the accounts the page already lists, excluding you by id. The hazard is not self-assignment, it is reaching zero admins: that page is the only surface which writes the claim, so nobody could grant one back. Blocking all self-changes instead would deadlock the first account, which cannot open the page at all. A truncated account list counts as "no other admin" and refuses, since an incomplete list cannot prove one exists. Both helpers are in `lib/roles.ts` so they are tested: `app/actions/admin.ts` can only be reached with a `SUPABASE_SERVICE_ROLE_KEY`, which most local machines do not have.
- Layering rule: layouts do not re-render on client navigation, so the proxy is the redirect gate and RLS is the data gate.

## 3b. Roles and permissions

Four roles, descending: **viewer** → **staff** → **manager** → **admin**.

**This matrix was chosen, not confirmed.** The questions put to the user on 2026-10-05 went unanswered,
so these were adopted as defaults: the four-tier ladder, `manager` and above editing reference data,
and the role-assignment UI being on. If the ladder is wrong, `lib/roles.ts` `ROLES`/`CAPABILITIES` and
the four arrays in `supabase/schema.sql` are the only two places to change — `npm run check:rls` will
catch it if only one is updated.

| | viewer | staff | manager | admin |
| --- | --- | --- | --- | --- |
| read all 9 tables | yes | yes | yes | yes |
| write operational (`items`, `purchases`, `transactions`, `requests`, `audits`) | no | yes | yes | yes |
| write reference (`categories`, `warehouses`, `suppliers`, `departments`) | no | no | yes | yes |
| manage accounts and roles | no | no | no | yes |

- `supabase/schema.sql` generates the policies from four arrays in one `DO` block rather than writing 36 by hand; those arrays are the only copy. `npm run check:rls` diffs them against `lib/roles.ts` and fails if a table is left unclassified or a role list drifts.
- Every policy names roles explicitly rather than comparing a rank, so a role added in one place but not the other matches nothing — fail closed, not fail open.
- `components/Permissions.tsx` carries the session's capabilities into the client screens via the `(app)` layout so a viewer is not shown buttons that RLS would refuse. **This is a rendering convenience, not the boundary.** Every query runs through the browser client, so RLS is what actually decides; the UI just avoids offering a form that cannot succeed.
- `app/(app)/layout.tsx` now calls `getUser()` to build that context. It is `cache`d, so it is the same session read the pages already perform.
- `staff` lost reference-table writes. No screen ever exposed those writes, so nothing in the UI regressed — but a `staff` session calling PostgREST directly previously could edit suppliers and warehouses. `DELETE` is also withheld on `purchases`, `transactions`, `requests` and `audits`, which nothing deletes.
- **This already shipped without the SQL, which was survivable.** The live schema is still the old one,
  admitting exactly `('admin','staff')` on all nine tables, and the two disagree in both directions:

  | role | live schema (old) | after `schema.sql` runs |
  | --- | --- | --- |
  | `viewer` | denied everything | read only |
  | `staff` | read + write all 9 tables | read + write operational only |
  | `manager` | **denied everything** | read + operational + reference |
  | `admin` | full | full |

  Deploying first was only safe because `viewer` and `manager` did not exist yet — the old model had
  just `admin` and `staff`, so nobody could be locked out. **Do not assign `viewer` or `manager` until
  the SQL has run**, and note `staff` currently has broader database access than the UI implies.
- Guards: `npm run check:auth` (username mapping, case folding, redirect guard, role escalation, the
  admin-screen helpers) and `npm run check:env` (deployment env validation). Both are dependency-free
  Node scripts. When adding a guard, **prove it fails** by breaking the code it covers and confirming a
  FAIL — a permission check that cannot fail is not a guard. That is how the merge and the
  last-admin rule were validated.

---

## 4. Database

Nine tables, all with `TEXT` primary keys and no default, so ids are generated in `services/inventoryService.ts:17` (`nextId(prefix, length)` → `TXN000123`, `PO-20260001`, `AUD00042`, `REQ00017`).

Live row counts: categories 9, items 21, warehouses 5, suppliers 5, departments 6, purchases 6, transactions 7, requests 7, audits 5.

All reads and writes go through the **browser** Supabase client, which means RLS is the only real data boundary.

---

## 5. Open Issues — Do These Next

1. **RLS was wide open; it is now role-gated.** *(This entry is the oldest one here and was stale —
   the policies were replaced in `9f54f15` and again in the role-ladder change.)* `supabase/schema.sql`
   now generates `read on <table>` / `write on <table>` policies per role and grants are narrowed to
   match, so there is no `FOR ALL USING (true)` anywhere. Run `npm run check:rls` after touching it.
   What is still open: the four reference tables have **no write UI**, so `manager` currently has a
   capability the app never exercises. Either build the screens or drop it from the matrix.
2. **Supabase dashboard config.** Add `http://localhost:3000/**` and `https://inventory-app-thimsin.vercel.app/**`
   to Authentication → URL Configuration → Redirect URLs, and set the Site URL to
   `https://inventory-app-thimsin.vercel.app`. The docs now carry the real origin, but the Supabase
   project still has only the local origin configured. Attach a real SMTP provider if confirmation is
   ever turned on — the built-in one is rate-limited.
3. **Rotate credentials that were pasted into chat:** the account-scoped `sbp_…` personal access token, the database password, and an `sb_secret_…` key. Create scoped PATs instead — a classic PAT grants full account access. Prefer handing a token over by writing it to a gitignored file over pasting it into the conversation, which is how the last one leaked.
4. Delete the dead `utils/supabase/*` duplicates.
5. `recordTransaction` in `inventoryService.ts` inserts the transaction and updates the item in two round-trips; wrap both in a Postgres RPC if atomicity matters.
6. Reference screens (categories, warehouses, suppliers, departments) are read-only. Only inventory, purchases, requests, and audits have write paths.
7. **`supabase/schema.sql` has not been run since the role ladder landed** (no DB password, no `psql`, no
   Docker on this machine). Until it is, `viewer` and `manager` are denied outright by the live
   policies — see the table in §3b. Nothing in the repo executes SQL; run it in the Supabase SQL editor.
8. **`SUPABASE_SERVICE_ROLE_KEY=` is empty in `.env.local` and unset on Vercel**, so `/admin/users` shows
   its "unavailable" message in production and cannot reach its happy path. The risky logic
   (`mergeRoleInto`, `describeAccount`, `canChangeOwnRole`) is covered by `check:auth`; the Supabase
   calls around it are not. Set it and walk the screen by hand.
9. **Stray account `probe@users.invalid`, id `43623ca5-781f-4671-8c46-53e7e84502c3`** — created by
   probing `POST /auth/v1/signup` on 2026-10-05. Inert (no role, so it matches no policy) but should be
   deleted from Dashboard → Authentication, or with the `auth.identities` / `auth.users` deletes in
   §5b. Do not probe write endpoints on the live project without asking first.
10. **`/api/supabase-test` is public and now wrong twice over.** It returns `categoriesSample` and
   `totalItemsInDb` to any caller, and because an anonymous request matches no RLS policy it will
   always report `connected_with_schema_missing` — which sends you chasing a non-problem. It was
   unreachable while Vercel Deployment Protection was on (§9). Fix by authenticating first.

## 5b. Unblock a role-less account

A new signup has no role, by design — the anon client cannot write `app_metadata`. The first role
therefore has to be set outside the app, because `/admin/users` needs you to be an admin already:

```sql
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"role":"admin"}'
WHERE email = '<the-address-you-signed-up-with>@users.invalid';
```

Then **sign out and sign in again** — the role is baked into the JWT when the token is issued, so an
open session keeps the old claims for up to an hour. Schema state does not matter here: `requireAdmin()`
reads the claim server-side, and the old live policy already admits `admin`.

Deleting the stray probe account from §5 item 9, if Dashboard is not convenient:

```sql
DELETE FROM auth.identities WHERE user_id = '43623ca5-781f-4671-8c46-53e7e84502c3';
DELETE FROM auth.users      WHERE id      = '43623ca5-781f-4671-8c46-53e7e84502c3';
```

---

## 6. Conventions

- No semicolons, single quotes, 2-space indent. (`app/layout.tsx` is the only scaffold holdout.)
- Tailwind `zinc` palette with light and dark variants on every element.
- Reuse `components/ui.tsx` (`Card`, `Button`, `Label`, `Input`, `Select`, `Textarea`, `Badge`, `StatusBadge`, `PageHeader`, `Spinner`, `EmptyState`, `ErrorState`) rather than adding new primitives.
- Client screens follow the `useAsyncData` + `AsyncBoundary` + `DataTable` pattern with `Column<T>[]`.
- Use `SubmitButton` for form submits so the pending state renders.
- New screen → add its entry to `LINKS` in `components/Nav.tsx`.
- `utils/errors.ts` (`errorCode`, `errorMessage`) normalizes Supabase/PostgREST errors for display.

---

## 7. Verify Before Calling Anything Done

```powershell
npm run check          # check:env + check:auth + check:rls  (25 / 127 / 31 assertions)
npm run lint
npx tsc --noEmit
npm run build
```

`check:rls` is the one that matters after touching roles: it reads the policy arrays back out of
`supabase/schema.sql` and diffs them against `lib/roles.ts`, and fails if a table is left
unclassified or a role list drifts. `check:auth` matters after touching `lib/roles.ts` or
`app/actions/admin.ts`.

Runtime checks against the **production** deployment — note that every one of these returns a Vercel
SSO redirect until Deployment Protection is off (§8):

```powershell
$site = "https://inventory-app-thimsin.vercel.app"
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" $site/          # 302 to vercel.com/sso-api
curl.exe -s -o NUL -w "%{http_code}" "$site/login"                      # 302 while protected
curl.exe -s "$site/api/supabase-test"                                   # 302 "Protected by Vercel Authentication"
```

Locally (a dev server is usually already listening on :3000):

```powershell
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" http://localhost:3000/          # 307 to /login?next=%2F
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/login                          # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/signup                         # 200
curl.exe -s http://localhost:3000/api/supabase-test                                       # {"status":"ready",...}
```

---

## 8. Deployment

- `git push origin main` is the whole deploy. The Vercel Git integration is connected and it does
  build automatically — verified, not assumed (§ header).
- **Nothing in the repo configures this.** There is no `.github/` directory, and `vercel.json` only
  sets `framework`, `regions` and security headers; that file cannot enable push-to-deploy. If a push
  ever seems inert, re-check that the repo is still imported at vercel.com/new.
- **Vercel Deployment Protection is ON**, so every route — including `/api/supabase-test` — 302s to
  Vercel SSO for anyone without a Vercel session. That means only Vercel-account users can reach the
  app at all, which defeats the point of the Supabase role ladder: a `viewer` still needs a Vercel
  account to sign in. Turn it off under **Project Settings → Deployment Protection** if staff are
  meant to use it; it is otherwise a deliberate choice worth making explicitly.
- **Tooling on this machine:** `gh` is installed but **not** authenticated (`gh auth login` needed, so
  check runs cannot be read). The `vercel` CLI is installed but the project is **not** linked (no
  `.vercel/project.json`, which `.gitignore` covers) and there is no `VERCEL_TOKEN`.
- **Verifying a deploy with no credentials:** pick a string that exists in exactly one commit and grep
  the production HTML for it. `git show <old-sha>:<file> | Select-String <string>` against the new one
  proves both that the string is new and that it is live. That is how `ee14fe0` was confirmed.
  Signature blocks in the HTML are useless for this — they are deployment-specific, not commit-specific.

---

## 9. Gotchas

- The **WebCRX** browser extension injects attributes onto `<html>`, which caused a hydration mismatch. It is suppressed on `<html>` in `app/layout.tsx`; disabling the extension removes the need.
- Typed routes are enabled. Global helpers like `LayoutProps<"/">` are generated per route, so a brand-new route's type only exists after a build or dev run. New layouts type `children` as `{ children: ReactNode }` like `app/(app)/layout.tsx`.
- Read the matching guide in `node_modules/next/dist/docs/` before using any Next.js API — this version has breaking changes (see `AGENTS.md`).
- `.env*` is gitignored. Keep `.env.example` in sync with the variables the code actually reads: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `NEXT_PUBLIC_*` values ship to the browser. Service role and secret keys must stay server-side.
