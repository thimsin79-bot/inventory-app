@AGENTS.md

# Project Context: Inventory Management System (Next.js + Supabase)

**Last Updated:** October 9, 2026
**Project Path:** `D:\ICT\inventory-app`
**Origin:** Port of the single-file prototype `D:\ICT\app.js` (school inventory for Cambodia).
**Production:** `https://inventory-app-thimsin.vercel.app/` — auto-deploys from `origin/main` through
the Vercel Git integration.

> **This app has an authentication layer again.** Built 2026-10-09 on top of the auth removal of
> 2026-10-06: `/sign-in`, a `proxy.ts` session gate, per-user permissions from
> `app_metadata.permissions` enforced in the UI and on the Admin Console routes, and RLS flipped to
> `authenticated`-only. §3 and §8 describe the exact boundary; this file is the source of truth for
> it, because the security model lives in the app, not in SQL alone.

---

## 1. Stack & Environment

- **Next.js** 16.3.8 (App Router, Turbopack), **React** 19.2.8, TypeScript, **Tailwind CSS** v4, ESLint 9
- **Supabase** `@supabase/ssr` + `@supabase/supabase-js` (the latter only for the `SupabaseClient` type)
- Node v24.21.0, npm 11, path alias `@/*`
- Supabase project `bktxzesvtmgcmznsfnlu` (`ap-southeast-2`).
  **`supabase/schema.sql` was last run in full on 2026-10-09** through the Management API (§9) when
  the RLS split was flipped from `anon` to `authenticated`. Verified live the same day: 36 policies,
  every one `TO authenticated`; `anon` has zero table privileges and PostgREST refuses it with 401;
  `authenticated` has the grants the file declares (DELETE withheld on purchases, transactions,
  requests and audits). Data was not touched. The pre-auth `anon` world is described under §8.
- **No test framework, and deliberately none.** Four dependency-free Node scripts hold the logic a
  test runner would otherwise cover: `npm run check` = `check:env` + `check:rls` + `check:gate` +
  `check:auth` (22 / 50 / 22 / 47 assertions). `check:env` imports `lib/supabase/env.ts` directly via
  Node's type stripping, `check:rls` reads `supabase/schema.sql`, `check:gate` imports
  `lib/adminGate.ts`, `check:auth` imports `lib/permissions.ts` + `lib/permissionGate.ts` and reads
  every gated screen as source. Then `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## 2. Actual Folder Layout

```
app/
  layout.tsx              root: Geist fonts, metadata, suppressHydrationWarning
  sign-in/                sign-in page (server page + client SignInForm); the entry to the app
  (app)/                  the 10 app screens + shared sidebar shell; (app)/admin/users is the Admin Console
  api/supabase-test/      connection diagnostic (no session -> 403 via proxy)
  api/admin/users/        Admin Console handlers: adminSecretGate, then admin.view/admin.manage, then lib/adminAuth
components/               flat: ui.tsx, Nav, DataTable, Modal, forms, ConnectionStatus, PermissionPicker,
                          AuthProvider, ScreenGate, SignInForm, UserMenu
hooks/useAsyncData.ts     loading/error/reload wrapper for client fetches
lib/supabase/             client.ts, server.ts, session.ts (proxy session read), env.ts
lib/permissions.ts        permission catalog + sessionFromAuth; stored in app_metadata.permissions
lib/permissionGate.ts     the 403 decision, fail closed
lib/auth.ts               server side of permissionCheck (getClaims -> sessionFromAuth)
lib/adminAuth.ts          server-only Auth-user CRUD over the Management API (reads SUPABASE_ACCESS_TOKEN)
lib/adminGate.ts          the Admin Console shared-secret gate: x-admin-secret vs ADMIN_CONSOLE_SECRET, 401/503
proxy.ts (root)           the sign-in gate (Next 16 proxy/middleware, Node runtime)
services/inventoryService.ts   all data access, browser Supabase client
services/adminUsersService.ts  Admin Console fetch layer over /api/admin/users (holds the secret per tab)
supabase/schema.sql       tables + RLS: authenticated-only policies, generated in one DO block
supabase/seed.sql         verified reference data
types/database.types.ts   generated from the live schema
utils/format.ts, utils/errors.ts  live helpers
scripts/                  check-supabase-env.mjs, check-rls.mjs, check-admin-gate.mjs, check-auth.mjs
```

What used to be here and is **not**: `app/(auth)/`, `app/auth/`, `app/actions/`,
`lib/roles.ts`, `lib/supabase/dal.ts`, `lib/supabase/proxy.ts`, `components/SubmitButton.tsx`,
`utils/supabase/`. All deleted in the 2026-10-06 auth removal. The 2026-10-09 layer is a fresh,
smaller build: new `lib/auth.ts`, `lib/permissionGate.ts`, `lib/supabase/session.ts`,
`components/{AuthProvider,ScreenGate,SignInForm,UserMenu}.tsx`, `app/sign-in/`, and a root
`proxy.ts`. The Admin Console (`app/(app)/admin/users/`, added 2026-10-07) manages creating, editing,
banning and deleting *Auth users* and ticks `components/PermissionPicker.tsx`.

**Screens:** `/`, `/inventory`, `/purchases`, `/transactions`, `/requests`, `/audits`, `/categories`,
`/warehouses`, `/suppliers`, `/departments` (prerendered static shells; data arrives on the client),
the Admin Console `/admin/users`, and `/sign-in` (outside the app shell).

---

## 3. Access control — read this before touching RLS or the proxy

The boundary is a chain of three gates, each only as strong as the next:

1. **`proxy.ts` (root, Next 16 proxy, Node runtime)** — every request that is not `_next`/static
   goes through it. Pages without a valid session get `302 -> /sign-in`; a signed-in visit to
   `/sign-in` gets `302 -> /`; `/api/*` without a session gets a `403 {error:"Sign-in required."}`
   JSON body instead of a redirect so fetch failures stay readable in the UI. The decision uses
   `getClaims()` — the access token is verified against the project's JWKS (refreshing near
   expiry), not trusted from the cookie — and `withSessionCookies` copies any refreshed cookies onto
   the redirect. This is the *entry* gate. **It is not the security boundary.**
2. **RLS in `supabase/schema.sql`** — every policy is `TO authenticated USING (true)` /
   `WITH CHECK (true)`, one per table per command (nine tables × four commands, generated in one
   `DO` block), and `authenticated` is granted those commands while `anon` is revoked from all nine
   tables and granted nothing. So a request with *any* signed-in session reaches every row; a
   session-less request touches nothing (verified live 2026-10-09: `anon` → 401 on PostgREST).
3. **App-layer permissions** — the finer-grained model lives in the session JWT. Each user's
   `app_metadata.permissions` array (edited in the Admin Console) is what the UI and the Admin
   routes branch on:
   - `components/ScreenGate.tsx` blocks each screen's content behind its `<screen>.view`
     permission (spinner while loading, refusal naming the key otherwise).
   - `components/Nav.tsx` only renders links the user may open; `components/UserMenu.tsx` shows the
     sign-in identity and Sign out.
   - Write screens gate their create/edit/delete actions behind `manage`: buttons and the actions
     column render only when the user holds `<screen>.view` **and** `<screen>.manage`.
   - Admin Console routes: `adminSecretGate` (shared secret, 401/503) runs *first*, then
     `permissionCheck('admin.view')` on GET and `permissionCheck('admin.manage')` on
     POST/PATCH/DELETE, then any `lib/adminAuth` call.

Consequences, stated honestly:

- RLS still does **not** branch on permissions — only on signed-in vs not. A raw client with any
  valid session (fetching PostgREST directly, bypassing the app) can read and write every row,
  because the manage/view matrix lives in the app and the JWT, not in SQL. That is a deliberate,
  documented boundary: moving the nine-permission matrix into RLS would duplicate the app logic on
  tables the screens share. If this must change, re-read this section before writing RLS.
- `getClaims()`/`getSessionUser()` give the server a verified identity. `user_metadata` is never
  read anywhere — the user can edit it; only `app_metadata` (written by the Admin Console) decides.
- Permission changes take effect on the user's **next token refresh or next sign-in**, because
  `app_metadata` sits in the access token and is verified against the JWKS. Roughly an hour of
  slack for a signed-in user.
- `permissionGate` returns **403** for both no-session and missing-permission. **401 is reserved
  for the Admin Console shared secret** (`lib/adminGate.ts`): `services/adminUsersService.ts`
  maps any 401 to "unlock the console with the secret", so a sign-in problem must not look like a
  secret problem.
- **The one DB-level limit beyond the split:** `DELETE` is withheld at the *grant* on `purchases`,
  `transactions`, `requests` and `audits`, because no screen deletes them. `items`, `categories`,
  `suppliers`, `warehouses` and `departments` keep `DELETE`. `check:rls` guards this hardest.
- There is still no per-user attribution: `transactions.created_by`, `requests.requested_by` etc.
  are free text the UI types in. `transactions.manage` has no UI enforcement — stock writes arrive
  through the inventory screen's `inventory.manage`.
- Permission catalog: `<screen>.view` for all eleven screens; `manage` for inventory, purchases,
  transactions, requests, audits, admin. The reference screens (categories, warehouses, suppliers,
  departments) are read-only and have no manage key (see `lib/permissions.ts`).

---

## 4. Database

Eight of the nine tables use `TEXT` primary keys with no default, so ids are generated in
`services/inventoryService.ts:17` (`nextId(prefix, length)` → `TXN000123`, `PO-20260001`, `AUD00042`,
`REQ00017`). `items` is the exception: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.

Seeded row counts (from `supabase/seed.sql`, verified 2026-10-07, unaffected by the 2026-10-09 RLS
flip): items 21, categories 9, warehouses 5, suppliers 5, departments 6, purchases 6,
transactions 7, requests 7, audits 5.

All reads and writes go through the **browser** Supabase client
(`services/inventoryService.ts`), which now only works once a session exists.

---

## 5. Open Issues — Do These Next

1. **Closed 2026-10-09 — the RLS split is live.** All policies `TO authenticated`, grants match
   the file, `anon` revoked everywhere. Verified on the live project the same day (`pg_policy`,
   `aclexplode`/`has_table_privilege`, and a PostgREST `anon` probe → 401). That half of the
   boundary is now real — see §3 and §7.
2. **Accounts: `auth.users` is empty (2026-10-09).** The three named accounts —
   `admin@users.invalid`, `app@users.invalid`, `thimsin79@gmail.com` — do not exist in this project;
   the user is creating/confirming them in the dashboard (decision 2026-10-09: do not create accounts
   from this machine). Until one exists, nothing can sign in and every screen shows the spinner then
   the gate. Once one exists, grant it permissions in the Admin Console (that needs
   `ADMIN_CONSOLE_SECRET`) and confirm the sign-in flow. A realistic checklist for a new account:
   Create user → sign in on `/sign-in` → `app_metadata.permissions` ticks survive a token refresh.
3. **Deployment Protection is now belt-and-braces, not load-bearing.** With sign-in, verified
   sessions, RLS `authenticated`-only and app permissions, the data no longer depends on Vercel SSO
   (§8). Keep it on for the given accounts; ordinary staff reach the app through `/sign-in` instead
   of a Vercel account. Re-read §8 for the current state.
4. **Rotate credentials that were pasted into chat:** the account-scoped `sbp_…` personal access
   token, the database password, and an `sb_secret_…` key. The scoped Database Read-write PAT
   (`.env.local`, `SUPABASE_ACCESS_TOKEN`) is load-bearing at *runtime* for the Admin Console and
   for SQL runs (§9), so rotate it in a window where the console's 502 message is acceptable, or
   create a fresh one first. Prefer handing a token over by writing it to a gitignored file rather
   than pasting it into a conversation.
5. **The Admin Console — (a) done, (b) done 2026-10-09.** (a) Every handler in
   `app/api/admin/users/*` calls `adminSecretGate` before the Management-API PAT (anonymous caller →
   `401 Admin console secret required.`; unset env → `503`). (b) Those handlers now also run
   `permissionCheck` — `admin.view` on GET, `admin.manage` on POST/PATCH/DELETE — and the screen is
   gated behind `admin.view` with write actions behind `admin.manage`, so the stored
   `app_metadata.permissions` now mean something. The shared secret still identifies nobody (it is
   one value for the whole team); that is accepted, and the Users screen copy says so.
6. **`/api/supabase-test` sits behind the proxy now.** It answers `403 {error:"Sign-in required."}`
   to anyone without a session, so it no longer leaks row counts to anonymous traffic. It is still a
   diagnostic with no caller — worth shrinking or deleting.
7. `recordTransaction` in `inventoryService.ts` inserts the transaction and updates the item in two
   round-trips; wrap both in a Postgres RPC if atomicity matters.
8. Reference screens (categories, warehouses, suppliers, departments) are read-only. Only inventory,
   purchases, requests and audits have write paths.
9. `lib/supabase/server.ts` is now shared by `api/supabase-test` and `lib/auth.ts`. If the
   diagnostic route goes away, keep it for `getSessionUser`.
10. **Closed 2026-10-08 — the Admin Console's production 502** was a BOM-prefixed
    `SUPABASE_ACCESS_TOKEN` in Vercel (U+FEFF at index 7 of `Bearer <token>`). Fixed by rewriting
    the variable and by `runSql` trimming the token. An env change only reaches the site on a new
    deployment (`vercel redeploy <url>`), and deployment-specific URLs serve their frozen build.
    Only `https://inventory-app-thimsin.vercel.app` serves the current build.

---

## 6. Conventions

- No semicolons, single quotes, 2-space indent. (`app/layout.tsx` is the only scaffold holdout.)
- Tailwind `zinc` palette with light and dark variants on every element.
- Reuse `components/ui.tsx` (`Card`, `Button`, `Label`, `Input`, `Select`, `Textarea`, `Badge`,
  `StatusBadge`, `PageHeader`, `Spinner`, `EmptyState`, `ErrorState`) rather than adding new
  primitives.
- Client screens follow the `useAsyncData` + `AsyncBoundary` + `DataTable` pattern with
  `Column<T>[]`, wrapped in `ScreenGate` inside the screen's `Card`.
- Gate a screen in one place: `const { can } = useAuth()` from `components/AuthProvider.tsx`.
  There is exactly one Supabase client and one `onAuthStateChange` listener, in `AuthProvider` —
  components consume the context, they do not open their own client.
- New screen → add its entry to `LINKS` in `components/Nav.tsx` **with its `permission`**, add the
  key to `lib/permissions.ts`, and gate the page with `ScreenGate permission="<screen>.view"`.
- Manage keys: hide the PageHeader action buttons and the row-action column behind
  `can('<screen>.manage')` along with the view gate.
- Forms dispatch through the browser Supabase client (`signInWithPassword`, `signOut`) and keep a
  pending state; `SignInForm` is the one `<form>` in the app.
- `utils/errors.ts` (`errorCode`, `errorMessage`) normalizes Supabase/PostgREST errors for display.
- Server routes: `adminSecretGate(request)` first, then `permissionCheck('<key>')`, then touch
  credentials. Never read `user_metadata`.

---

## 7. Verify Before Calling Anything Done

```powershell
npm run check          # check:env + check:rls + check:gate + check:auth (22 / 50 / 22 / 47)
npm run lint
npx tsc --noEmit
npm run build
```

After touching `supabase/schema.sql`, `check:rls` matters most: all nine tables declared and
RLS-enabled, SELECT/INSERT/UPDATE/DELETE policies generated for each, policies targeting
`authenticated` and never `anon`, grants matching the policies, `anon` revoked everywhere, `DELETE`
withheld on the four tables nothing deletes from, no `current_role`/`app_metadata`/role arrays, and
no `FOR ALL` catch-all. **It must fail loudly if you reintroduce a role ladder or widen RLS to
`anon`** — a guard that cannot fail is not a guard, so prove a new assertion by breaking the code it
covers first.

`check:gate` is the equivalent for `lib/adminGate.ts` and the two Admin Console routes: fail closed
(missing env → 503, wrong/absent header → 401, right header → null, padded value matches), every
handler gates before `lib/adminAuth`, the header name agrees between client and server, and nothing
outside `lib/adminGate.ts` reads `ADMIN_CONSOLE_SECRET`.

`check:auth` covers the sign-in chain: `sessionFromAuth` accepts claims-style and client-style
identities and reads only `app_metadata`; `permissionGate` fails closed with 403 (never 401);
`proxy.ts` redirects pages to `/sign-in`, answers `/api` with 403 JSON, uses `getClaims`, and its
matcher excludes `_next`; every screen carries its `<screen>.view` gate and every write screen its
`can('<screen>.manage')`; the admin routes run the secret gate then the permission check before the
credential; nothing outside `lib/permissions.ts` reads `user_metadata`.

If you see `TS2307 Cannot find module '...app/(auth)/...'` from `.next/*/types/validator.ts`, those
are stale generated route validators from a previous `next dev`. `Remove-Item -Recurse -Force .next`
and rebuild. Typed routes mean a brand-new route (e.g. `/sign-in`) only gains its type after a build
or dev run.

Locally (a dev server is usually already listening on :3000; the proxy is running in Next 16):

```powershell
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" http://localhost:3000/          # 302 -> /sign-in, no session
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/sign-in                     # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/login                       # 404, no such route
curl.exe -s http://localhost:3000/api/supabase-test                                     # 403 {"error":"Sign-in required."}
```

With a signed-in session cookie the same `/` answers 200 and `/api/supabase-test` returns its
diagnostic. Production is behind Vercel Deployment Protection, so curl gets a SSO redirect; the
authenticated CLI is needed there (§8).

---

## 8. Deployment

- `git push origin main` is the whole deploy. The Vercel Git integration is connected and builds
  automatically. Nothing in the repo configures it; `vercel.json` only sets `framework`, `regions`
  and security headers.
- **Access control today is the app's own auth, not Vercel SSO.** The 2026-10-09 layer means the
  data is protected even if Deployment Protection is switched off: `anon` cannot query the project
  (§3). Deployment Protection is still ON and still useful — it keeps a pre-auth build from being
  reachable by URL guessing while you are mid-migration — but it is no longer the boundary. The
  2026-10-06 note ("the only access control this application has") is **stale**: since 2026-10-09
  RLS and the proxy carry the boundary, and SSO is belt-and-braces.
- Sign-in uses **email + password against Supabase Auth** (no SSO providers configured). A user
  created in the Admin Console (or the dashboard) signs in at `/sign-in`; their
  `app_metadata.permissions` decide what they see (§3).
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
- **Next 16 renames middleware to `proxy.ts`** with a `proxy` export, running on the Node runtime
  at the project root by default. Read the proxy guide in `node_modules/next/dist/docs/` before
  changing it. The matcher excludes `_next` (dev HMR must not build an SSR page for every chunk).
- Read the matching guide in `node_modules/next/dist/docs/` before using any Next.js API — this
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
- **Auth sharp edges:** `signUp`/`signInWithPassword` require the GoTrue `/auth/v1` endpoint of the
  project (works with the publishable key). Setting a user's `app_metadata.permissions` is only done
  by the Admin Console (`lib/adminAuth.ts`), never by the user's own client. There is no
  "forgot password" or invite flow; the console's Password reset is the path. Account creation from
  the CLI/dashboard, not from SQL, keeps `auth.identities` consistent (see `createAuthUser` in
  `lib/adminAuth.ts` for why the console builds both rows in one statement).