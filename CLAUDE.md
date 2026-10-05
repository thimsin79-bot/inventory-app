@AGENTS.md

# Project Context: Inventory Management System (Next.js + Supabase)

**Last Updated:** October 4, 2026
**Project Path:** `D:\ICT\inventory-app`
**Origin:** Port of the single-file prototype `D:\ICT\app.js` (school inventory for Cambodia).

---

## 1. Stack & Environment

- **Next.js** 16.3.8 (App Router, Turbopack), **React** 19.2.8, TypeScript, **Tailwind CSS** v4, ESLint 9
- **Supabase** `@supabase/ssr` + `@supabase/supabase-js`
- Node v24.21.0, npm 11, path alias `@/*`
- Supabase project `bktxzesvtmgcmznsfnlu` (`ap-southeast-2`); schema + seed are already applied
- **No test runner.** Verification is `npm run lint`, `npx tsc --noEmit`, `npm run build`, plus `curl` checks

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
  lib/roles.ts              ROLES, CAPABILITIES, isAdmin/isManager/can* predicates
  components/Permissions.tsx  capability context for the client screens
lib/supabase/             client.ts, server.ts, proxy.ts, admin.ts, dal.ts
services/inventoryService.ts   all data access, browser Supabase client
supabase/schema.sql       tables + RLS (currently far too permissive)
supabase/seed.sql         verified reference data
types/database.types.ts   generated from the live schema
utils/format.ts, utils/errors.ts   live helpers
utils/supabase/*          DEAD duplicates of lib/supabase — delete candidate
```

Note: earlier notes in this file described `components/ui/`, `components/layout/`, `hooks/useDebounce.ts`, `lib/mockData.ts`. Those were never built. The flat structure above is what exists.

**Screens:** `/`, `/inventory`, `/purchases`, `/transactions`, `/requests`, `/audits`, `/categories`, `/warehouses`, `/suppliers`, `/departments`.

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
- No email confirmation and no password reset, by consequence of there being no mailbox. A forgotten
  password is an administrator task. `Confirm email` must be **off** in the project or new accounts
  are created that can never sign in.
- `proxy.ts` → `lib/supabase/proxy.ts` refreshes the session cookies, then applies the optimistic route check: unauthenticated → `/login?next=…`, authenticated hitting `/login` or `/signup` → `/`. `PUBLIC_PATHS = /login, /signup, /auth/callback, /api/supabase-test`.
- `lib/supabase/dal.ts` is the session API: `getUser()` (React `cache` memoized) and `requireUser()` (redirects). Server Components and handlers must read the user here, never `supabase.auth` directly. `getUser()` returns `null` when Supabase is unconfigured rather than throwing, so `/login` still renders; the proxy fails closed in that state.
- Server actions `login`, `signup`, `signOut` in `app/actions/auth.ts` use `useActionState`. Passwords require ≥8 characters, a letter, and a number. Errors are mapped for 400 invalid credentials, 422 username-taken, 429 rate limits, and `email_not_confirmed` (reported as "waiting to be approved", not as a wrong password).
- Sign-up writes `user_metadata.username` only. `app_metadata` carries the role RLS reads and must never be settable from a public form.
- Sign-out is `<form action={signOut}>` inside `components/UserMenu.tsx`, wrapped in `<Suspense>` in the `(app)` layout so `cookies()` does not hold back the first chunk.
- Project auth config: `mailer_autoconfirm: true` (verified 2026-10-05) so sign-in works immediately.
  Anonymous sign-ins are off.
- **Sign-up must stay enabled.** Verified live as `disable_signup: true` on `bktxzesvtmgcmznsfnlu`
  as of 2026-10-05, which returns `422 signup_disabled` ("Signups not allowed for this instance") to
  every `/signup` submission. There is no invite flow and no mailbox, so public sign-up is the *only*
  onboarding path — with it off, no account can be created at all and `app/actions/auth.ts` reports it
  as a switch to flip rather than leaking the GoTrue string. Re-check with `GET /auth/v1/settings`.
- `app/(app)/admin/users/` is the admin-only password reset. It sits in the `(app)` group so it inherits `requireUser()` from the proxy, and calls `requireAdmin()` on top. `SUPABASE_SERVICE_ROLE_KEY` is now **required** for it, because the Service Role bypasses RLS and nothing else guards that path.
- Ordering in `app/actions/admin.ts` is deliberate: authorize with `requireAdmin()` **before** constructing the service-role client, and validate input afterwards, so an unauthorized caller cannot use the form to enumerate usernames.
- `lib/roles.ts` reads the role from `app_metadata`, never `user_metadata` — the account holder can write `user_metadata` themselves via `supabase.auth.updateUser`, so reading it would be self-promotion. It **imports nothing at all**, not even a sibling module, because `npm run check:auth` loads it directly with Node's type stripping and has no bundler to resolve an import. Anything it needs is passed in as an argument.
- An unrecognised role string returns `null` rather than the raw value, so a role added in only one place gets **no** capabilities instead of silently inheriting a tier. `can()` looks the capability record up defensively so a missing record denies rather than throwing.
- A **role-less account is the normal state for a new signup.** Signup runs on the anon client, which cannot write `app_metadata`, so nothing grants a role until an admin does it. `capabilitiesOf` returns all-false and `app/(app)/layout.tsx` swaps the whole screen for an "no role yet" message and drops the nav, because every link would otherwise land on an empty page. The user menu stays so they can sign out.
- `/admin/users` also assigns roles via `setRole` in `app/actions/admin.ts`, writing `app_metadata` through the Service Role. It **merges** via `mergeRoleInto` rather than replacing, and refuses to change the caller's own role via `isSelfAccount` — demoting the last admin is unrecoverable through the app. Both helpers live in `lib/roles.ts` so they are tested: `app/actions/admin.ts` can only be reached with a `SUPABASE_SERVICE_ROLE_KEY`, which most local machines do not have.
- Layering rule: layouts do not re-render on client navigation, so the proxy is the redirect gate and RLS is the data gate.

## 3b. Roles and permissions

Four roles, descending: **viewer** → **staff** → **manager** → **admin**.

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
- **Apply `supabase/schema.sql` before deploying this change, not after.** The live schema is the old one, which admits exactly `('admin','staff')` on all nine tables. Until the SQL runs, the two disagree in both directions:

  | role | live schema (old) | after this change |
  | --- | --- | --- |
  | `viewer` | denied everything | read only |
  | `staff` | read + write all 9 tables | read + write operational only |
  | `manager` | **denied everything** | read + operational + reference |
  | `admin` | full | full |

  So deploying code first locks out every `viewer` and `manager` outright, and leaves `staff` with more access than the UI suggests. Anyone already holding `manager` in the dashboard is locked out right now.
- Guards: `npm run check:auth` (username mapping, case folding, redirect guard, role escalation) and `npm run check:env` (deployment env validation). Both are dependency-free Node scripts.

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
2. **Supabase dashboard config.** Add `http://localhost:3000/**` to Authentication → URL Configuration → Redirect URLs and set the Site URL. Attach a real SMTP provider if confirmation is ever turned on — the built-in one is rate-limited.
3. **Rotate credentials that were pasted into chat:** the account-scoped `sbp_…` personal access token, the database password, and an `sb_secret_…` key. Create scoped PATs instead — a classic PAT grants full account access.
4. Delete the dead `utils/supabase/*` duplicates.
5. `recordTransaction` in `inventoryService.ts` inserts the transaction and updates the item in two round-trips; wrap both in a Postgres RPC if atomicity matters.
6. Reference screens (categories, warehouses, suppliers, departments) are read-only. Only inventory, purchases, requests, and audits have write paths.
7. **Two paths have never been executed against a real backend.** `supabase/schema.sql` has not been
   run since the role ladder landed (no DB password, no `psql`, no Docker on this machine), and
   `/admin/users` cannot reach its happy path because `SUPABASE_SERVICE_ROLE_KEY=` is blank in
   `.env.local` — both the account list and role writes hit the "unavailable" message. The risky
   logic in the latter (`mergeRoleInto`, `describeAccount`, `isSelfAccount`) is covered by
   `check:auth`; the Supabase API calls around it are not. Set the key and walk the screen by hand
   before trusting it.

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
npm run lint
npx tsc --noEmit
npm run build
npm run check          # check:env + check:auth + check:rls
```

`check:rls` is the one that matters after touching roles: it reads the policy arrays back out of
`supabase/schema.sql` and diffs them against `lib/roles.ts`, and fails if a table is left
unclassified or a role list drifts.

Runtime checks (a dev server is usually already listening on :3000):

```powershell
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" http://localhost:3000/          # 307 to /login?next=%2F
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/login                          # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/signup                         # 200
curl.exe -s http://localhost:3000/api/supabase-test                                       # {"status":"ready",...}
```

---

## 8. Gotchas

- The **WebCRX** browser extension injects attributes onto `<html>`, which caused a hydration mismatch. It is suppressed on `<html>` in `app/layout.tsx`; disabling the extension removes the need.
- Typed routes are enabled. Global helpers like `LayoutProps<"/">` are generated per route, so a brand-new route's type only exists after a build or dev run. New layouts type `children` as `{ children: ReactNode }` like `app/(app)/layout.tsx`.
- Read the matching guide in `node_modules/next/dist/docs/` before using any Next.js API — this version has breaking changes (see `AGENTS.md`).
- `.env*` is gitignored. Keep `.env.example` in sync with the variables the code actually reads: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `NEXT_PUBLIC_*` values ship to the browser. Service role and secret keys must stay server-side.
