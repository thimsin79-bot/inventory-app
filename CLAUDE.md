@AGENTS.md

# Project Context: Inventory Management System (Next.js + Supabase)

**Last Updated:** October 10, 2026
**Project Path:** `D:\ICT\inventory-app`
**Origin:** Port of the single-file prototype `D:\ICT\app.js` (school inventory for Cambodia).
**Production:** `https://inventory-app-thimsin.vercel.app/` — auto-deploys from `origin/main` through
the Vercel Git integration.

> **This app is public again.** The auth layer that was built on 2026-10-09 (the second one) has
> been removed a second time: `/sign-in`, `/sign-up`, the root `proxy.ts`, per-screen permission
> gates and RLS-to-`authenticated` are gone. RLS is `TO anon`, every screen loads without a
> session, and the only gated surface left is the Admin Console, locked by its shared secret.
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
  key returns rows.
- **No test framework, and deliberately none.** Three dependency-free Node scripts hold the logic a
  test runner would otherwise cover: `npm run check` = `check:env` + `check:rls` + `check:gate`
  (22 / 53 / 22 assertions). `check:env` imports `lib/supabase/env.ts` directly via Node's type
  stripping, `check:rls` reads `supabase/schema.sql`, `check:gate` imports `lib/adminGate.ts` and
  reads the two Admin Console routes as source. Then `npm run lint`, `npx tsc --noEmit`,
  `npm run build`. The session-and-permission check (`check:auth`) was deleted with the auth layer.

---

## 2. Actual Folder Layout

```
app/
  layout.tsx              root: Geist fonts, metadata, theme init script, PreferencesProvider
  (app)/                  the 11 app screens + shared sidebar shell
  maintenance/            Maintenance History log: create + delete
  reports/                read-only rollups: valuation, purchases, requests, maintenance
  settings/               company info (DB-backed, logo upload) + browser-only preferences
  admin/layout.tsx        Admin Console shell: full-width main, "Back to the app" link
  admin/users/            the Admin Console page (moved here 2026-10-09)
  api/supabase-test/      connection diagnostic (public)
  api/admin/users/        Admin Console handlers: adminSecretGate only, then lib/adminAuth
components/               flat: ui.tsx, Nav, DataTable (paginates per preference), Modal, forms,
                          ConnectionStatus, PermissionPicker, MovementForm, ItemFormFields,
                          PreferencesProvider, LandingRedirect
hooks/useAsyncData.ts     loading/error/reload wrapper for client fetches
lib/supabase/             client.ts, server.ts, env.ts
lib/permissions.ts        permission catalog for the Admin Console picker (stored, not enforced)
lib/preferences.ts        browser-only preference storage + theme resolution (no server usage)
lib/adminAuth.ts          server-only Auth-user CRUD over the Management API (reads SUPABASE_ACCESS_TOKEN)
lib/adminGate.ts          the Admin Console shared-secret gate: x-admin-secret vs ADMIN_CONSOLE_SECRET, 401/503
services/inventoryService.ts   all data access, browser Supabase client
services/adminUsersService.ts  Admin Console fetch layer over /api/admin/users (holds the secret per tab)
supabase/schema.sql       tables + RLS: anon-only policies, generated in one DO block; logos bucket
supabase/seed.sql         verified reference data
types/database.types.ts   generated from the live schema
utils/format.ts, utils/errors.ts  live helpers
scripts/                  check-supabase-env.mjs, check-rls.mjs, check-admin-gate.mjs
```

What was in the 2026-10-09 auth build and is **not** any more: `app/sign-in/`, `app/sign-up/`,
the root `proxy.ts`, `lib/{auth.ts,permissionGate.ts}`, `lib/supabase/session.ts`,
`scripts/check-auth.mjs`, `package.json`'s `check:auth`, and
`components/{AuthProvider,ScreenGate,SignInForm,SignUpForm,UserMenu}.tsx`. The standalone
`app/(app)/warehouses/` screen was removed too (the `warehouses` table and the
`getWarehouses()` service call survive — the inventory movement form and the audits screen still
read the table).

**Screens:** `/`, `/inventory`, `/purchases`, `/requests`, `/audits`,
`/maintenance`, `/reports`, `/categories`, `/suppliers`, `/departments`, `/settings` (prerendered
static shells; data arrives on the client), and the Admin Console `/admin/users` (own shell,
top-level). `/sign-in`, `/sign-up`, `/warehouses` and `/transactions` 404.

---

## 3. Access control — the current boundary

The app has no sign-in. Read this before touching RLS or the Admin routes.

- **Data is public by design.** RLS is enabled on all ten tables but every policy is
  `TO anon USING (true)` / `WITH CHECK (true)`, and `anon` holds the grants the screens
  issue (DELETE withheld on purchases, requests, audits, company_settings;
  DELETE held on items and maintenance). Anyone who can reach
  PostgREST with the publishable key can read and write every row — that is this build's
  intended state: a school inventory tool with no accounts.
- **The Admin Console is the one gated surface.** Both `/api/admin/users*` handlers call
  `adminSecretGate(request)` first: no/blank `ADMIN_CONSOLE_SECRET` env → `503`, missing/wrong
  `x-admin-secret` header → `401`, correct secret → the `lib/adminAuth` call. The screen
  (`app/admin/users`) prompts for the secret once per tab and keeps it in `sessionStorage`.
  There is **no second gate**. Do not re-add `permissionCheck` or a `ScreenGate` unless a
  session layer exists again.
- **`lib/permissions.ts` is a catalog, not a gate.** The Admin Console still stores per-account
  permission ticks in Supabase Auth `app_metadata.permissions`, so a future login layer can
  branch on the same keys without re-inventing them. Nothing reads the list for enforcement
  today; the console's own copy says so.
- **RLS in `supabase/schema.sql`** is generated in one `DO` block — one policy per table per
  command (`read on <table>`, `write on <table> (insert|update|delete)`), revoked from both roles
  first, granted to `anon` only, `authenticated` revoked everywhere. `check:rls` guards the
  invariant that policies and grants agree and that nothing from the removed role ladder or a
  `FOR ALL USING (true)` catch-all comes back. It must fail loudly if you reintroduce a role
  ladder or a `authenticated` split.

Consequences, stated honestly:

- There is no per-user attribution and no least-privilege story: anyone with the URL and the
  publishable key is a full user. That is the trade-off of removing auth a second time.
- `authenticated` has zero grants, so the Auth accounts the Admin Console still manages
  (created by the earlier auth build) are inert unless a session layer is re-added.
- Keep Deployment Protection (§8) if the project is still mid-lifecycle: it is the only thing
  slowing URL-guessing against a cold build. It is **not** a data boundary.

---

## 4. Database

Eight of the ten tables use `TEXT` primary keys with no default, so ids are generated in
`services/inventoryService.ts:17` (`nextId(prefix, length)` → `PO-20260001`, `AUD00042`,
`REQ00017`, `MNT00001`). `items` is the exception: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.

Seeded row counts (from `supabase/seed.sql`, re-verified 2026-10-10):
items 21, categories 9, warehouses 5, suppliers 5, departments 6, purchases 6,
requests 7, audits 5, maintenance 5, company_settings 1.

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
   sign-in to use them. The Admin Console still lists/creates/edits them; their stored
   permission ticks are kept for a possible future session layer. Nothing to do unless the
   extra accounts are unwanted — delete them from the console.
3. **Deployment Protection is now belt-only, not load-bearing.** With no sign-in, the data does
   not depend on it (it never did for safety once RLS was `anon`, because `anon` *is* public
   access). Keep it on to slow URL-guessing; remember it does not protect data.
4. **Rotate credentials that were pasted into chat:** the account-scoped `sbp_…` personal access
   token, the database password, and an `sb_secret_…` key. The scoped Database Read-write PAT
   (`.env.local`, `SUPABASE_ACCESS_TOKEN`) is load-bearing at *runtime* for the Admin Console and
   for SQL runs (§9), so rotate it in a window where the console's 502 message is acceptable, or
   create a fresh one first. Prefer handing a token over by writing it to a gitignored file rather
   than pasting it into a conversation.
5. **The Admin Console gate is the whole story now.** Every handler in `app/api/admin/users/*`
   calls `adminSecretGate` before the Management-API PAT (anonymous caller → `401 Admin console
   secret required.`; unset env → `503`). There is no `permissionCheck` after it any more —
   `check:gate` asserts exactly that ordering.
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
  `Column<T>[]`. There is no `ScreenGate`: a screen renders its content directly.
- Write screens always show their create/edit/delete actions — no `can(...)` guards.
- `components/Nav.tsx` links the 12 screens plus `Admin console` (→ `/admin/users`); it no longer
  filters by permission. A new screen → add its entry to `LINKS` and a route under `app/(app)/`.
- `DataTable` paginates client-side using the user's rows-per-page preference, so a screen does
  not manage paging state itself. The pager only appears when a table exceeds the page size.
- Browser preferences live in `lib/preferences.ts` (types, storage, theme resolution) and are
  applied by `components/PreferencesProvider.tsx`, mounted once in the root layout. They never
  touch the database. Company information (name/address/contact/logo) is the one DB-backed part
  of the Settings screen: it reads and upserts the single `company_settings` row and uploads the
  logo to the public `logos` storage bucket. Nothing else displays it yet.
- `lib/permissions.ts` keeps the `<screen>.view`/`<screen>.manage` catalog only for the Admin
  Console's `PermissionPicker`; it decides nothing at runtime.
- Forms dispatch through the browser Supabase client in `services/inventoryService.ts`.
- `utils/errors.ts` (`errorCode`, `errorMessage`) normalizes Supabase/PostgREST errors for display.
- Server routes: `adminSecretGate(request)` first, then touch credentials. Never read
  `user_metadata`; never read `ADMIN_CONSOLE_SECRET` outside `lib/adminGate.ts`.

---

## 7. Verify Before Calling Anything Done

```powershell
npm run check          # check:env + check:rls + check:gate (22 / 57 / 22)
npm run lint
npx tsc --noEmit
npm run build
```

After touching `supabase/schema.sql`, `check:rls` matters most: all ten tables declared and
RLS-enabled, SELECT/INSERT/UPDATE/DELETE policies generated for each, policies targeting `anon`
and never `authenticated`, grants matching the policies, `authenticated` revoked everywhere,
`DELETE` withheld on the four tables nothing deletes from, no `current_role`/`app_metadata`/role
arrays, and no `FOR ALL` catch-all. **It must fail loudly if you reintroduce a role ladder or
widen RLS to a `authenticated` split** — a guard that cannot fail is not a guard, so prove a new
assertion by breaking the code it covers first.

`check:gate` is the equivalent for `lib/adminGate.ts` and the two Admin Console routes: fail closed
(missing env → 503, wrong/absent header → 401, right header → null, padded value matches), every
handler gates before `lib/adminAuth`, the header name agrees between client and server, nothing
outside `lib/adminGate.ts` reads `ADMIN_CONSOLE_SECRET`, and no `permissionCheck` crept back in
the ordering assertions.

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
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/admin/users          # 200 (lock screen)
curl.exe -s http://localhost:3000/api/supabase-test                             # 200 {"status":"ready",...}
```

Production is behind Vercel Deployment Protection, so plain curl gets a SSO redirect; the
authenticated CLI is needed there (§8).

---

## 8. Deployment

- `git push origin main` is the whole deploy. The Vercel Git integration is connected and builds
  automatically. Nothing in the repo configures it; `vercel.json` only sets `framework`, `regions`
  and security headers.
- **There is no sign-in.** Anyone who reaches the deployed URL can use the app — the RLS policies
  `TO anon` make the data readable and writable through the publishable key. Deployment Protection
  (Vercel SSO) still 302s anonymous traffic, which is useful mid-migration but is **not** a data
  boundary (§3). Ordinary staff reach the app simply by opening the URL.
- **Tooling on this machine:** `gh` is installed but **not** authenticated. The `vercel` CLI **is**
  authenticated (device login as `thimsin79-8849`, 2026-10-08) and the project **is** linked —
  `.vercel/project.json` exists and `.gitignore` covers it. `vercel env ls/add/rm`, `vercel
  redeploy <url>`, `vercel logs`, `vercel ls` and `vercel curl` all work without a dashboard. There
  is still no `VERCEL_TOKEN`, so anything outside the CLI needs a browser session.
- **Runtime env the Admin Console needs:** `SUPABASE_ACCESS_TOKEN` (Management-API PAT, server-only,
  read by `lib/adminAuth.ts` and the §9 SQL runner) and `ADMIN_CONSOLE_SECRET` (shared secret, read
  by `lib/adminGate.ts`) must both exist in Vercel or the console refuses. `.env.local` carries
  working values. The same secret value locally and in Vercel means staff type it once.
  **Changing an env var does nothing for the live site until a new deployment exists.**
- Deployment Protection still 302s anonymous traffic to Vercel SSO, so **`vercel curl` is the way
  to read a response body from production**: it fetches through protection with the authenticated
  CLI (flags after `--`; e.g. `vercel curl <url> -- --header "x-admin-secret: …"` — `-o`/`-w`/`-H`
  before the separator fall through to a plain curl that the 302 blanks).
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
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy alias), and the two server-only ones:
  `SUPABASE_ACCESS_TOKEN` (read by `lib/adminAuth.ts`) and `ADMIN_CONSOLE_SECRET` (read by
  `lib/adminGate.ts`). Never put a `NEXT_PUBLIC_` prefix on the token. There is **no**
  `SUPABASE_SERVICE_ROLE_KEY` anymore.
- **Running SQL from this machine:** no `psql`, no Supabase CLI, no usable network path to the
  database — `db.<ref>.supabase.co` has no A record (IPv6-only) and this machine has no IPv6 route.
  The only route is the Management API
  `POST https://api.supabase.com/v1/projects/bktxzesvtmgcmznsfnlu/database/query` with a **scoped
  PAT (permission Database → Read-write)**; one lives in `.env.local` as `SUPABASE_ACCESS_TOKEN`. It
  answers 201 on success. `schema.sql` and `seed.sql` are idempotent and safe to re-run; verify live
  afterwards with the §7 probes.
- `NEXT_PUBLIC_*` values ship to the browser by design. The publishable key is public. The two
  server-only variables above are the ones that must never get the prefix.
- **A pasted env value can arrive with a UTF-8 BOM (U+FEFF)** in front of it, which is invisible in
  a dashboard and fatal in a header: `fetch` throws `Cannot convert argument to a ByteString … 65279`
  at index 7 of `Bearer <token>` (§5 item 10). Write the file with Node rather than pasting, prefer
  `vercel env add NAME env < file` over a PowerShell pipe, and the code trims anyway.
- **Admin-account management is SQL-only now.** `lib/adminAuth.ts` creates/edits Auth users over
  the Management API (`auth.users` + `auth.identities` in one statement batch). There is no
  GoTrue admin client on this machine. The Admin Console is the only UI for it, and the shared
  secret is the only lock on it — the same value is one blanket credential for the whole team,
  which the Users screen's copy states.