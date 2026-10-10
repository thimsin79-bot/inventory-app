@AGENTS.md

# Project Context: Inventory Management System (Next.js + Supabase)

**Last Updated:** October 10, 2026
**Project Path:** `D:\ICT\inventory-app`
**Origin:** Port of the single-file prototype `D:\ICT\app.js` (school inventory for Cambodia).
**Production:** `https://inventory-app-thimsin.vercel.app/` — auto-deploys from `origin/main` through
the Vercel Git integration.

> **This app is public again.** The auth layer that was built on 2026-10-09 (the second one) has
> been removed a second time: `/sign-in`, `/sign-up`, the root `proxy.ts`, per-screen permission
> gates and RLS-to-`authenticated` are gone. RLS is `TO anon` and there is **no gated surface
> left** — the Admin Console was removed on 2026-10-10. On the same day a standalone `/login`
> page was added (username + password, no email); by explicit request it was then turned into a
> **client-side entrance gate**: successful sign-in stores a flag in `localStorage`
> (`inventory.signedIn`) and the `(app)` layout redirects to `/login` pre-paint when the flag is
> missing. This is a UX gate, **not** a security boundary — the flag is in the user's own browser
> and the data stays readable through the publishable key. `/login`'s credential store,
> `app_users`, is deliberately invisible to PostgREST (RLS on, no anon policies/grants); the only
> way in is the `login_user()` SECURITY DEFINER function (§3).
> §3 describes the boundary; this file is the source of truth for it.

---

## 1. Stack & Environment

- **Next.js** 16.3.8 (App Router, Turbopack), **React** 19.2.8, TypeScript, **Tailwind CSS** v4, ESLint 9
- **Supabase** `@supabase/ssr` + `@supabase/supabase-js` (the latter only for the `SupabaseClient` type)
- Node v24.21.0, npm 11, path alias `@/*`
- Supabase project `bktxzesvtmgcmznsfnlu` (`ap-southeast-2`).
  **`supabase/schema.sql` was last run in full on 2026-10-10** through the Management API (§9),
  when the company-settings table and the `logos` storage bucket joined, and re-run the same day
  when the transactions module was removed (table dropped, then the file applied). Verified live:
  40 policies across ten tables, every one `TO anon`; `anon` has the grants the file
  declares (DELETE withheld on purchases, requests, audits and company_settings; DELETE held on the
  six screens that delete — items, maintenance, categories, suppliers, departments, warehouses);
  `authenticated` is revoked from every table; the `logos`
  bucket is public with read-all and anon upload policies; a PostgREST probe with the publishable
  key returns rows. The same day the `/login` credential store was added and applied live:
  `app_users` (RLS on, zero policies, zero grants) plus the `login_user()` SECURITY DEFINER
  function; verified over REST that `admin`/valid credentials → `{ok: true, display_name}`,
  wrong credentials → `{ok: false}`, and any read of `app_users` itself is denied (HTTP 401).
- **No test framework, and deliberately none.** Three dependency-free Node scripts hold the logic a
  test runner would otherwise cover: `npm run check` = `check:env` + `check:rls` (22 / 65
  assertions). `check:env` imports `lib/supabase/env.ts` directly via Node's type
  stripping and `check:rls` reads `supabase/schema.sql`. The session-and-permission check
  (`check:auth`) and the Admin Console gate check (`check:gate`) were deleted with their
  layers. Then `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## 2. Actual Folder Layout

```
app/
  layout.tsx              root: Geist fonts, metadata, theme init script, PreferencesProvider
  (app)/                  the 12 app screens + shared sidebar shell; renders the client-side
                          sign-in gate script (lib/session.ts) before its first paint
  login/                  username + password sign-in form (no email). On success writes the
                          `inventory.signedIn` localStorage flag and opens the app; failed
                          sign-ins stay on this page
  maintenance/            Maintenance History log: create + delete
  reports/                read-only rollups: valuation, purchases, requests, maintenance
  settings/               company info (DB-backed, logo upload) + browser-only preferences
  api/supabase-test/      connection diagnostic (public)
components/               flat: ui.tsx, Nav (links + Sign out), DataTable (paginates per preference), Modal, forms,
                          ConnectionStatus, MovementForm, ItemFormFields,
                          PreferencesProvider, LandingRedirect
hooks/useAsyncData.ts     loading/error/reload wrapper for client fetches
lib/supabase/             client.ts, server.ts, env.ts
lib/preferences.ts        browser-only preference storage + theme resolution (no server usage)
services/inventoryService.ts   all data access, browser Supabase client
supabase/schema.sql       tables + RLS: anon-only policies, generated in one DO block; logos bucket
supabase/seed.sql         verified reference data
types/database.types.ts   generated from the live schema
utils/format.ts, utils/errors.ts  live helpers
scripts/                  check-supabase-env.mjs, check-rls.mjs
```

What was in the 2026-10-09 auth build and is **not** any more: `app/sign-in/`, `app/sign-up/`,
the root `proxy.ts`, `lib/{auth.ts,permissionGate.ts}`, `lib/supabase/session.ts`,
`scripts/check-auth.mjs`, `package.json`'s `check:auth`, and
`components/{AuthProvider,ScreenGate,SignInForm,SignUpForm,UserMenu}.tsx`. The Admin Console was
removed again on 2026-10-10: `app/admin/` (the users screen and its shell),
`app/api/admin/users*`, `lib/{adminGate.ts,adminAuth.ts,permissions.ts}`,
`services/adminUsersService.ts`, `components/PermissionPicker.tsx`,
`scripts/check-admin-gate.mjs` and `package.json`'s `check:gate` are all gone.
The standalone `app/(app)/warehouses/` screen was removed too (the `warehouses` table and the
`getWarehouses()` service call survive — the inventory movement form and the audits screen still
read the table).

**Screens:** `/`, `/inventory`, `/purchases`, `/requests`, `/audits`,
`/maintenance`, `/reports`, `/categories`, `/suppliers`, `/departments`, `/users`, `/settings` (prerendered
static shells; data arrives on the client), plus `/login` — a standalone page outside the `(app)`
shell that verifies a username + password against `app_users` and sets no session.
`/sign-in`, `/sign-up`, `/warehouses`, `/transactions` and `/admin/users` 404.

---

## 3. Access control — the current boundary

The app has no real sign-in. `/login` is a client-side entrance gate (§3 bullets). Read this
before touching RLS.

- **Data is public by design.** RLS is enabled on all ten tables but every policy is
  `TO anon USING (true)` / `WITH CHECK (true)`, and `anon` holds the grants the screens
  issue (DELETE withheld on purchases, requests, audits, company_settings;
  DELETE held on items and maintenance). Anyone who can reach
  PostgREST with the publishable key can read and write every row — that is this build's
  intended state: a school inventory tool with no accounts.
- **The one exception to "every table": `app_users`.** The `/login` credential store is
  RLS-enabled with **no policies and no grants** (`check:rls` guards this), so PostgREST
  cannot read it at all — password hashes never leave the database. The only way in is a
  family of `SECURITY DEFINER` functions in `schema.sql`, all with a pinned
  `search_path` and only `EXECUTE` granted to `anon`:
  - `login_user(username, password)` — the gate; returns just `ok` + `display_name`.
  - `list_login_users()` — usernames, display names, created dates for the Users screen; never a hash.
  - `create_login_user(username, password, display_name)` — hashes the password (pgcrypto `crypt`/`gen_salt`
    are in the `extensions` schema, hence that entry on the search_path) and inserts; returns
    false for a taken username or a password under 4 characters.
  - `delete_login_user(username)` — removes an account.
  The Users screen (`app/(app)/users`) drives them through the browser client like every
  other screen — `create_login_user` is the only place a plaintext password ever enters the
  database, and it is hashed before storage.
- **There is a client-side entrance gate, and only that.** As of 2026-10-10 the `(app)` layout
  runs `lib/session.ts`'s `GATE_INIT_SCRIPT` before first paint and redirects to `/login` when
  `localStorage['inventory.signedIn']` is missing; `/login` writes that flag after a successful
  `login_user()` call and opens the app; Nav has Sign out (clears the flag). This is a UX entry gate, not a
  security boundary: the flag lives in the user's own browser (clearable,
  forgeable), every (app) route still servers as prerendered HTML, the data is still readable
  through the publishable key, and RLS is untouched. Do not mistake it for auth; the Admin
  Console and its `/api/admin/users*` handlers were removed on 2026-10-10 — no
  `adminSecretGate`, no `ADMIN_CONSOLE_SECRET`, no `app_metadata` reads. A real session layer
  (server-issued cookie checked on every screen, data nailed down past anon) must be a separate,
  explicitly-requested change.
- **RLS in `supabase/schema.sql`** is generated in one `DO` block — one policy per table per
  command (`read on <table>`, `write on <table> (insert|update|delete)`), revoked from both roles
  first, granted to `anon` only, `authenticated` revoked everywhere. `check:rls` guards the
  invariant that policies and grants agree and that nothing from the removed role ladder or a
  `FOR ALL USING (true)` catch-all comes back. It must fail loudly if you reintroduce a role
  ladder or a `authenticated` split.

Consequences, stated honestly:

- There is no per-user attribution and no least-privilege story: anyone with the URL and the
  publishable key is a full user. That is the trade-off of removing auth a second time.
- `authenticated` has zero grants, so the Auth accounts created by the earlier auth build are
  inert with no console left to manage them (see §5 item 2).
- Keep Deployment Protection (§8) if the project is still mid-lifecycle: it is the only thing
  slowing URL-guessing against a cold build. It is **not** a data boundary.

---

## 4. Database

Eight of the ten tables use `TEXT` primary keys with no default, so ids are generated in
`services/inventoryService.ts:17` (`nextId(prefix, length)` → `PO-20260001`, `AUD00042`,
`REQ00017`, `MNT00001`). `items` is the exception: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.

Seeded row counts (from `supabase/seed.sql`, re-verified 2026-10-10):
items 21, categories 9, warehouses 5, suppliers 5, departments 6, purchases 6,
requests 7, audits 5, maintenance 5, company_settings 1, app_users 1
(`admin`, bcrypt hash of `admin123` — change it by UPDATE in SQL; you will not find a
hash-verification path in the client, only the `login_user` function).

The live project holds none of those rows as of 2026-10-10: `npm run smoke` cleared all nine data
tables (77 rows at the time) and kept only the `company_settings` row. Re-run
`supabase/seed.sql` to bring the sample data back.

All reads and writes go through the **browser** Supabase client (`services/inventoryService.ts`)
with the publishable key, which is exactly why the RLS policies target `anon`.

---

## 5. Open Issues — Do These Next

1. **Closed 2026-10-09 — RLS reverted to anon (second time).** All policies `TO anon`, grants
   match the file, `authenticated` revoked everywhere. Verified on the live project the same day
   (`pg_policy`, `role_table_grants`, `relrowsecurity`, and a PostgREST `anon` probe → 200 rows).
2. **`auth.users` accounts from the earlier 2026-10-09 auth build are inert.** There is no
   sign-in to use them and no Admin Console to manage them. Their stored permission ticks are
   kept in `app_metadata` for a possible future session layer. Nothing to do unless the extra
   accounts are unwanted — delete them via the Management API (`auth.users`, SQL-only on this
   machine, §9); the console-based create/edit path (`lib/adminAuth.ts`) is gone.
3. **Deployment Protection is now belt-only, not load-bearing.** With no sign-in, the data does
   not depend on it (it never did for safety once RLS was `anon`, because `anon` *is* public
   access). Keep it on to slow URL-guessing; remember it does not protect data.
4. **Rotate credentials that were pasted into chat:** the account-scoped `sbp_…` personal access
   token, the database password, and an `sb_secret_…` key. The scoped Database Read-write PAT
   (`.env.local`, `SUPABASE_ACCESS_TOKEN`) is now **scripts-only** — `npm run smoke` and hand-run
   §9 SQL — so rotating it needs no downtime window. Prefer handing a token over by writing it
   to a gitignored file rather than pasting it into a conversation.
5. **Closed 2026-10-10 — the Admin Console was removed.** `app/admin/` (users screen + shell),
   `app/api/admin/users*`, `lib/{adminGate.ts,adminAuth.ts,permissions.ts}`,
   `services/adminUsersService.ts`, `components/PermissionPicker.tsx`,
   `scripts/check-admin-gate.mjs` and `check:gate` are all gone; the nav link, the
   `ADMIN_CONSOLE_SECRET` env var and the Vercel env entry went with them. `/admin/users` now
   404s and there is no gated surface left. `SUPABASE_ACCESS_TOKEN` remains in use by repo
   scripts only.
6. **`/api/supabase-test` is still a diagnostic with no caller** — worth shrinking or deleting.
   If it goes away, `lib/supabase/server.ts` has no other consumer and should go with it.
7. **Closed 2026-10-10 — the transactions module was removed.** Screen, nav link, landing option,
   `transactions` table, RLS/grants, seed rows, `getTransactions`/`recordTransaction` and the
   "Stock movements by type" report are all gone; the live table is dropped. The Inventory screen's
   Move button now just changes `items.qty` in a single `updateItem` call (the form in
   `components/MovementForm.tsx`, delta from `movementDelta`), so the old two-round-trip
   atomicity concern no longer applies.
8. **Closed 2026-10-10 — reference screens are no longer read-only.** Categories, suppliers and
   departments now have create/edit/delete (service functions `createCategory`/`updateCategory`/
   `deleteCategory`, likewise `createSupplier`/…, `createDepartment`/…), all generating TEXT ids
   via `nextId`. Deleting a category or supplier that items/purchases still reference is blocked
   by the FK and surfaces the Postgres error. Warehouses still has no standalone page but is used
   as form data. All ten tables now have write paths.
9. **Closed 2026-10-08 — the Admin Console's production 502** was a BOM-prefixed
   `SUPABASE_ACCESS_TOKEN` in Vercel (U+FEFF at index 7 of `Bearer <token>`). Fixed by rewriting
   the variable and by `runSql` trimming the token. An env change only reaches the site on a new
   deployment (`vercel redeploy <url>`), and deployment-specific URLs serve their frozen build.
   Only `https://inventory-app-thimsin.vercel.app` serves the current build.

---

## 6. Conventions

- No semicolons, single quotes, 2-space indent. (`app/layout.tsx` was the scaffold holdout; it was
  rewritten in the same style when the preferences provider was added.)
- Tailwind `zinc` palette with light and dark variants on every element. Dark mode is a `.dark`
  class on `<html>` (Tailwind v4 `@custom-variant`), not the OS media query: the theme init script
  in the root layout and `preferences.theme` decide it. Keep that script and `resolveTheme` in
  `lib/preferences.ts` in sync.
- Reuse `components/ui.tsx` (`Card`, `Button`, `Label`, `Input`, `Select`, `Textarea`, `Field`,
  `Notice`, `Badge`, `StatusBadge`, `PageHeader`, `Spinner`, `EmptyState`, `ErrorState`) rather
  than adding new primitives.
- **Forms use `Field` and `Notice`.** `Field` wraps a label, required asterisk, control, hint and
  the field's own validation error; `Notice` is the one success/`tone="bad"` banner (page-level in
  the screen, and re-used at the top of a modal for submit/server errors). Validate per field and
  show the error under the field inside the open modal — not in a banner behind it. Reset the form
  when the modal opens, submit buttons read `Saving…` / `Deleting…` while busy, and raw `<select>`
  filters use the `Select` primitive.
- Client screens follow the `useAsyncData` + `AsyncBoundary` + `DataTable` pattern with
  `Column<T>[]`. Gating is not per-screen: the `(app)` layout's pre-paint script redirects to
  `/login` when the session flag is missing, and screens render their content directly.
- Write screens always show their create/edit/delete actions — no `can(...)` guards.
- `components/Nav.tsx` links the 12 screens; it no longer filters by permission. A new screen →
  add its entry to `LINKS` and a route under `app/(app)/`.
- `DataTable` paginates client-side using the user's rows-per-page preference, so a screen does
  not manage paging state itself. The pager only appears when a table exceeds the page size.
- Browser preferences live in `lib/preferences.ts` (types, storage, theme resolution) and are
  applied by `components/PreferencesProvider.tsx`, mounted once in the root layout. They never
  touch the database. Company information (name/address/contact/logo) is the one DB-backed part
  of the Settings screen: it reads and upserts the single `company_settings` row and uploads the
  logo to the public `logos` storage bucket. Nothing else displays it yet.
- Forms dispatch through the browser Supabase client in `services/inventoryService.ts`.
- `utils/errors.ts` (`errorCode`, `errorMessage`) normalizes Supabase/PostgREST errors for display.
- Server routes have no gate: there is nothing left to gate, and no server route reads a secret.

---

## 7. Verify Before Calling Anything Done

```powershell
npm run check          # check:env + check:rls (22 / 65)
npm run lint
npx tsc --noEmit
npm run build
```

After touching `supabase/schema.sql`, `check:rls` matters most: the ten data tables declared and
RLS-enabled, SELECT/INSERT/UPDATE/DELETE policies generated for each, policies targeting `anon`
and never `authenticated`, grants matching the policies, `authenticated` revoked everywhere,
`DELETE` withheld on the four tables nothing deletes from, no `current_role`/`app_metadata`/role
arrays, and no `FOR ALL` catch-all. It also pins the `app_users` store to no policy, no grant,
revoked from both roles, gated solely by the SECURITY DEFINER function `EXECUTE` grants. **It must fail loudly if
you reintroduce a role ladder or widen RLS to a `authenticated` split** — a guard that cannot
fail is not a guard, so prove a new assertion by breaking the code it covers first.

`check:gate` was the equivalent for `lib/adminGate.ts` and the two Admin Console routes; it was
deleted with the module on 2026-10-10, leaving `check` at `check:env` + `check:rls` (22 / 65).

`npm run smoke` (`scripts/smoke-forms.mjs`) is the live counterpart and it is **destructive**: it
truncates the nine data tables, then for every screen creates, reads back and edits one row through
the publishable key using the exact payload that screen's form submits, checks the column defaults
the forms rely on (`unit`, `status`, `cost`, `min_qty`), checks the DELETE split — withheld on
`purchases`, `requests`, `audits` and `company_settings` — writes the Settings row
back with its own values, and truncates again so the run leaves nothing behind. 76 assertions, all
green on 2026-10-10. It reads `.env.local` (`SUPABASE_ACCESS_TOKEN`) and is deliberately **not** in
`npm run check`: never wire a truncating script into the check suite. Restore data with
`supabase/seed.sql`.

If you see `TS2307 Cannot find module '...app/(auth)/...'` from `.next/*/types/validator.ts`, those
are stale generated route validators from a previous `next dev`. `Remove-Item -Recurse -Force .next`
and rebuild. Typed routes mean a brand-new route only gains its type after a build or dev run.

Locally (a dev server is usually already listening on :3000):

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/                     # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/sign-in              # 404
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/sign-up              # 404
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/warehouses           # 404
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/maintenance          # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/reports              # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/settings             # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/users                # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/login               # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/admin/users          # 404
curl.exe -s http://localhost:3000/api/supabase-test                             # 200 {"status":"ready",...}
```

Production is behind Vercel Deployment Protection, so plain curl gets a SSO redirect; the
authenticated CLI is needed there (§8).

---

## 8. Deployment

- `git push origin main` is the whole deploy. The Vercel Git integration is connected and builds
  automatically. Nothing in the repo configures it; `vercel.json` only sets `framework`, `regions`
  and security headers.
- **There is a login page that gates the UI, and no real auth.** `/login` (2026-10-10) verifies a
  username + password against `app_users`, then stores a `localStorage` flag; app screens redirect
  to `/login` when the flag is missing. That is a client-side UX gate only — the RLS policies
  `TO anon` make the data readable and writable through the publishable key regardless, and
  anyone can bypass the flag. It does **not** gate direct PostgREST access.
  Deployment Protection (Vercel SSO) still 302s anonymous traffic, which is useful mid-migration
  but is **not** a data boundary (§3).
- **Tooling on this machine:** `gh` is installed but **not** authenticated. The `vercel` CLI **is**
  authenticated (device login as `thimsin79-8849`, 2026-10-08) and the project **is** linked —
  `.vercel/project.json` exists and `.gitignore` covers it. `vercel env ls/add/rm`, `vercel
  redeploy <url>`, `vercel logs`, `vercel ls` and `vercel curl` all work without a dashboard. There
  is still no `VERCEL_TOKEN`, so anything outside the CLI needs a browser session.
- **Runtime env is down to the three public variables** (§9). `SUPABASE_ACCESS_TOKEN` is needed
  only for repo scripts (`npm run smoke`, hand-run §9 SQL) and does **not** belong in Vercel.
  **Changing an env var does nothing for the live site until a new deployment exists.**
- Deployment Protection still 302s anonymous traffic to Vercel SSO, so **`vercel curl` is the way
  to read a response body from production**: it fetches through protection with the authenticated
  CLI (flags after `--`; e.g. `vercel curl <url> -- --compressed` — `-o`/`-w`/`-H` before the
  separator fall through to a plain curl that the 302 blanks).
- **Verifying a deploy with no credentials — and its limit.** Pick a string that exists in exactly
  one commit, confirm it is absent from the parent, then grep the production HTML for it — but only
  while Deployment Protection is OFF, because the SSO redirect gives back a 14-byte body otherwise.
  `git ls-remote origin -h refs/heads/main` shows the commit reached the remote; build success and
  live rollout need a Vercel session or the authenticated CLI.

---

## 9. Gotchas

- The **WebCRX** browser extension injects attributes onto `<html>`, which caused a hydration
  mismatch. It is suppressed on `<html>` in `app/layout.tsx`.
- **Typed routes are enabled.** A brand-new route's type exists only after a build or dev run;
  deleting a route leaves a stale validator in `.next/` until you clear it. New layouts type
  `children` as `{ children: ReactNode }`.
- There is **no `proxy.ts`** (Next 16's renamed middleware). It was removed again on 2026-10-09.
  If a proxy is ever re-added, read the proxy guide in `node_modules/next/dist/docs/` first — this
  version has breaking changes (see `AGENTS.md`).
- `.env*` is gitignored. Keep `.env.example` in sync with the variables the code actually reads:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy alias), and the one server-only one:
  `SUPABASE_ACCESS_TOKEN` (repo scripts only — `npm run smoke` and the §9 SQL runner; the app
  never reads it). Never put a `NEXT_PUBLIC_` prefix on the token. There is **no**
  `SUPABASE_SERVICE_ROLE_KEY` and no `ADMIN_CONSOLE_SECRET` anymore.
- **Running SQL from this machine:** no `psql`, no Supabase CLI, no usable network path to the
  database — `db.<ref>.supabase.co` has no A record (IPv6-only) and this machine has no IPv6 route.
  The only route is the Management API
  `POST https://api.supabase.com/v1/projects/bktxzesvtmgcmznsfnlu/database/query` with a **scoped
  PAT (permission Database → Read-write)**; one lives in `.env.local` as `SUPABASE_ACCESS_TOKEN`. It
  answers 201 on success. `schema.sql` and `seed.sql` are idempotent and safe to re-run; verify live
  afterwards with the §7 probes.
- `NEXT_PUBLIC_*` values ship to the browser by design. The publishable key is public. The one
  server-only variable above (`SUPABASE_ACCESS_TOKEN`) is the one that must never get the prefix.
- **A pasted env value can arrive with a UTF-8 BOM (U+FEFF)** in front of it, which is invisible in
  a dashboard and fatal in a header: `fetch` throws `Cannot convert argument to a ByteString … 65279`
  at index 7 of `Bearer <token>` (§5 item 10). Write the file with Node rather than pasting, prefer
  `vercel env add NAME env < file` over a PowerShell pipe, and the code trims anyway.
- **Auth-account management is SQL-only now.** The Admin Console and `lib/adminAuth.ts` are gone,
  so any change to `auth.users` / `auth.identities` (e.g. deleting the inert accounts from §5
  item 2) runs through the Management API in one statement batch. There is no GoTrue admin client
  on this machine.