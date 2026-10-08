@AGENTS.md

# Project Context: Inventory Management System (Next.js + Supabase)

**Last Updated:** October 8, 2026
**Project Path:** `D:\ICT\inventory-app`
**Origin:** Port of the single-file prototype `D:\ICT\app.js` (school inventory for Cambodia).
**Production:** `https://inventory-app-thimsin.vercel.app/` — auto-deploys from `origin/main` through
the Vercel Git integration. Verified without Vercel API access by grepping production HTML for a
string unique to one commit. See §8.

> **There is no authentication in this app.** This is a deliberate change made 2026-10-06: the
> login and signup pages, the session proxy, the four-tier role ladder, `/admin/users` and the
> `lib/roles.ts` capability matrix were all deleted. §3 and §8 explain what replaced them.

---

## 1. Stack & Environment

- **Next.js** 16.3.8 (App Router, Turbopack), **React** 19.2.8, TypeScript, **Tailwind CSS** v4, ESLint 9
- **Supabase** `@supabase/ssr` + `@supabase/supabase-js` (the latter only for the `SupabaseClient` type)
- Node v24.21.0, npm 11, path alias `@/*`
- Supabase project `bktxzesvtmgcmznsfnlu` (`ap-southeast-2`).
  **`supabase/schema.sql` and `supabase/seed.sql` were run in full on 2026-10-07** through the
  Management API (§9). Live policies are the repo's `TO anon USING (true)`, grants match the file,
  and the seeded row counts in §4 are back. Verified the same day through PostgREST with the
  publishable key: anon reads all nine tables.
- **No test framework, and deliberately none.** Three dependency-free Node scripts hold the logic a
  test runner would otherwise cover: `npm run check` = `check:env` + `check:rls` + `check:gate`,
  22 / 49 / 22 assertions. `check:env` imports `lib/supabase/env.ts` directly via Node's type
  stripping, `check:gate` imports `lib/adminGate.ts` the same way. Then `npm run lint`,
  `npx tsc --noEmit`, `npm run build`.

---

## 2. Actual Folder Layout

```
app/
  layout.tsx              root: Geist fonts, metadata, suppressHydrationWarning
  (app)/                  the 10 app screens + shared sidebar shell; (app)/admin/users is the Admin Console
  api/supabase-test/      connection diagnostic (unauthenticated, see §5)
  api/admin/users/        Admin Console handlers: read/write Supabase Auth users via the Management API
components/               flat: ui.tsx, Nav, DataTable, Modal, forms, ConnectionStatus, PermissionPicker
hooks/useAsyncData.ts     loading/error/reload wrapper for client fetches
lib/supabase/             client.ts, server.ts, env.ts
lib/adminAuth.ts          server-only Auth-user CRUD over the Management API (reads SUPABASE_ACCESS_TOKEN)
lib/adminGate.ts          the Admin Console gate: x-admin-secret vs ADMIN_CONSOLE_SECRET, fail closed
lib/permissions.ts        permission catalog; stored in app_metadata.permissions, unenforced (see §5)
services/inventoryService.ts   all data access, browser Supabase client
services/adminUsersService.ts  Admin Console fetch layer over /api/admin/users (holds the secret per tab)
supabase/schema.sql       tables + RLS: anon read/write, policies generated in one DO block
supabase/seed.sql         verified reference data
types/database.types.ts   generated from the live schema
utils/format.ts, utils/errors.ts  live helpers
scripts/                  check-supabase-env.mjs, check-rls.mjs, check-admin-gate.mjs
```

What used to be here and is **not**: `app/(auth)/`, `app/auth/`, `app/actions/`, `lib/auth.ts`,
`lib/roles.ts`, `lib/supabase/dal.ts`, `lib/supabase/proxy.ts`, `components/UserMenu.tsx`,
`components/SubmitButton.tsx`, `proxy.ts` (the root middleware), `utils/supabase/`,
`scripts/check-auth.mjs`. All deleted in the auth removal. The new Admin Console
(`app/(app)/admin/users/`, added 2026-10-07) is a different admin: it manages creating, editing,
banning and deleting *Auth users* and ticks `components/PermissionPicker.tsx` in place of the old
role-ladder `components/Permissions.tsx`. Earlier notes also described `components/ui/`,
`components/layout/`, `hooks/useDebounce.ts` and `lib/mockData.ts` — those were never built.

**Screens:** `/`, `/inventory`, `/purchases`, `/transactions`, `/requests`, `/audits`, `/categories`,
`/warehouses`, `/suppliers`, `/departments` (prerendered static shells; data arrives on the client),
plus the Admin Console `/admin/users`.

---

## 3. Access control — read this before touching RLS

**There is no authentication, no session, no role, and no server-side user.** On the data path the
app holds exactly one credential: the publishable key, which `lib/supabase/{client,server}.ts` reads
and sends to the browser. PostgREST presents that key as the `anon` role, so every request this app
makes is an `anon` request. There is nothing in a JWT to branch on, because there is no session.

The one exception is the Admin Console (`/admin/users`): its route handlers hold the Management-API
PAT (`SUPABASE_ACCESS_TOKEN`) and run SQL against `auth.users` on the server
(`lib/adminAuth.ts`). That is a server-side credential, not a session — there is still no login page
and nothing identifies the visitor. Since 2026-10-08 every handler calls `adminSecretGate`
(`lib/adminGate.ts`) first, so a caller must present `x-admin-secret` matching the server-only
`ADMIN_CONSOLE_SECRET` or get 401 (503 when the variable is unset — it fails closed). That is one
shared password for everybody, not identity: anyone who knows it is an admin (§5 item 4).

Consequences:

- **`supabase/schema.sql` grants `anon` full read and write on all nine tables.** Policies are
  generated in one `DO` block as `TO anon USING (true)` / `WITH CHECK (true)`, so nine tables times
  four commands is thirty-six statements, written once.
- **Those policies are not a security boundary.** They exist so the app functions. Anyone who reaches
  the Supabase project directly — not via the app — can read and write everything with the publishable
  key, because that key is public by design. The policies cannot stop that.
- **The only gate is Vercel Deployment Protection** (Project Settings → Deployment Protection), which
  302s anonymous traffic to Vercel SSO. It is currently **on**. Turning it off makes the entire
  inventory, purchases and audits world-writable at this URL. See §8.
- `TO anon` rather than the default `TO public`, so the grant states who it is for, and so it fails
  closed: an `authenticated` request (an account that still exists from before the removal) matches
  nothing and is explicitly revoked, so a leftover account is not a way in.
- **The one limit that survived:** `DELETE` is withheld at the *grant* on `purchases`, `transactions`,
  `requests` and `audits`, because no screen deletes them and `services/inventoryService.ts` exports
  no delete for them. `items`, `categories`, `suppliers`, `warehouses` and `departments` keep `DELETE`.
  This is a real constraint, and it is what `check:rls` guards hardest.
- There is no per-user identity any more. `transactions.created_by`, `requests.requested_by` and
  similar columns are free text the UI types in — nothing validates or attributes them. An audit trail
  in this schema is a claim, not evidence.

**Layering:** there is no redirect layer (no `proxy.ts`) and no server-side session read. The data
boundary is the grant plus the policy; the UI shows every control to every visitor because there is
nobody to hide them from.

---

## 4. Database

Eight of the nine tables use `TEXT` primary keys with no default, so ids are generated in
`services/inventoryService.ts:17` (`nextId(prefix, length)` → `TXN000123`, `PO-20260001`, `AUD00042`,
`REQ00017`). `items` is the exception: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, because it
arrived in a later change. Earlier notes here claimed all nine were `TEXT`; only eight are.

Row counts, re-measured 2026-10-07 after `supabase/seed.sql` was run against the live project:
items 21, categories 9, warehouses 5, suppliers 5, departments 6, purchases 6, transactions 7,
requests 7, audits 5. The 2026-10-06 measurement (items 2, everything else 0) described the
emptied project before the seed; the file is idempotent and puts the reference data back.

All reads and writes go through the **browser** Supabase client.

---

## 5. Open Issues — Do These Next

1. **Closed 2026-10-07 — `supabase/schema.sql` has now been run since the auth removal, together
   with `supabase/seed.sql`.** Two real bugs surfaced on the way there and are fixed in the file:
   the `DO` block created `write on <table>` three times (policy names are unique per table, so the
   second `CREATE POLICY` errored and rolled the whole script back), and grants are additive — the
   live project still carried `DELETE`, `TRUNCATE`, `REFERENCES` and `TRIGGER` for `anon` on all
   nine tables from an earlier scheme, which the `GRANT`s in the file could not remove. `schema.sql`
   now drops every existing policy by lookup and runs `REVOKE ALL ... FROM anon` before granting, so
   a re-run converges from any starting state.

   Verified against the live project the same day: the publishable key reads all nine tables
   through PostgREST (9 / 21 / 5 / 5 / 6 / 6 / 7 / 7 / 5 rows) including the seven new `items`
   columns; `pg_policy` holds exactly 36 policies, every one `TO anon`; `role_table_grants` gives
   `anon` exactly SELECT, INSERT, UPDATE, DELETE — DELETE withheld on purchases, transactions,
   requests, audits — and `authenticated` nothing. That probe is the half `check:rls` cannot
   cover: the script reads the file, not the database, so re-run it after any future SQL run.
   How to reach the database from this machine: §9.
2. **Vercel Deployment Protection is now load-bearing, not a preference.** It is the entire access
   boundary (§3). Make turning it off a deliberate decision, and note it currently also blocks
   ordinary staff, who need a Vercel account to see anything. See §8.
3. **Rotate credentials that were pasted into chat:** the account-scoped `sbp_…` personal access
   token, the database password, and an `sb_secret_…` key. The scoped Database Read-write PAT
   (`.env.local`, `SUPABASE_ACCESS_TOKEN`) was pasted into chat too — and it is now load-bearing at
   *runtime* for the Admin Console, not just for SQL runs, so rotate it in a window where the
   console's 502 message is acceptable, or create a fresh one first. Create scoped PATs instead — a
   classic PAT grants full account access. Prefer handing a token over by writing it to a gitignored
   file over pasting it into the conversation, which is how the last one leaked.
4. **The Admin Console — (a) done 2026-10-08, (b) still open.** (a) Every handler in
   `app/api/admin/users/*` now calls `adminSecretGate` before it touches the Management-API PAT, so
   an anonymous caller gets `401 Admin console secret required.` instead of a user list, and a
   deployment without `ADMIN_CONSOLE_SECRET` gets `503` rather than an open door. The secret is
   server-only (no `NEXT_PUBLIC_` prefix — that would ship it in the JS bundle and gate nothing);
   the Users screen prompts for it once per tab and keeps it in `sessionStorage`. `npm run
   check:gate` guards the wiring as well as the decision function, and was proved to fail by
   deleting a gate call. (b) is still the real fix: the secret is one value shared by everyone who
   uses the console, it identifies nobody, and `admin.view` / `admin.manage` in `lib/permissions.ts`
   remain **enforced nowhere** — the stored `app_metadata.permissions` mean nothing until sign-in
   exists, and the Users screen still says so.
5. **The stray probe account `probe@users.invalid` (id `43623ca5-…`) is gone** — `listAuthUsers`
   no longer shows it (verified 2026-10-07). The three remaining accounts are the test accounts
   `admin@users.invalid` and `app@users.invalid` plus the real `thimsin79@gmail.com`. Clean up the
   two `.invalid` test accounts once the console is gated (§5 item 4).
6. **`/api/supabase-test` is unauthenticated and over-detailed.** It returns `categoriesSample` and
   `totalItemsInDb` to any caller, and is `ƒ (Dynamic)` while every real screen is static. It is no
   longer singled out in a public-path list — there are no public paths — so it sits behind the same
   single Vercel gate as everything else. Still worth shrinking or deleting: nothing calls it.
7. `recordTransaction` in `inventoryService.ts` inserts the transaction and updates the item in two
   round-trips; wrap both in a Postgres RPC if atomicity matters.
8. Reference screens (categories, warehouses, suppliers, departments) are read-only. Only inventory,
   purchases, requests and audits have write paths.
9. With no sessions, `lib/supabase/server.ts` exists only for `api/supabase-test`. If that route goes
   away, it and `createServerClient` go with it.
10. **Closed 2026-10-08 — the Admin Console's production 502.** `/api/admin/users` answered
    `{"error":"Cannot convert argument to a ByteString because the character at index 7 …65279…"}`
    in production while working locally. Index 7 of `Bearer <token>` is the first character of the
    token, and 65279 is U+FEFF: the `SUPABASE_ACCESS_TOKEN` stored in Vercel began with a BOM, which
    `fetch` refuses to put in a header. Fixed by rewriting the variable from the clean value in
    `.env.local` (`vercel env rm` then `vercel env add … < file`, with the file written by Node) and
    by `runSql` now trimming the token, so a pasted BOM cannot break it again. Two lessons: an env
    change only reaches the site on a **new deployment** (`vercel redeploy <url>`, ~40s), and
    reading a Secret-typed variable back is impossible, so confirm the bytes by adding it as
    `--no-sensitive`, `vercel env pull`, then re-adding it as a Secret.

The stale deletion snippet for the old probe account (in case any live row is ever re-seeded):

```sql
DELETE FROM auth.identities WHERE user_id = '43623ca5-781f-4671-8c46-53e7e84502c3';
DELETE FROM auth.users      WHERE id      = '43623ca5-781f-4671-8c46-53e7e84502c3';
```

---

## 6. Conventions

- No semicolons, single quotes, 2-space indent. (`app/layout.tsx` is the only scaffold holdout.)
- Tailwind `zinc` palette with light and dark variants on every element.
- Reuse `components/ui.tsx` (`Card`, `Button`, `Label`, `Input`, `Select`, `Textarea`, `Badge`,
  `StatusBadge`, `PageHeader`, `Spinner`, `EmptyState`, `ErrorState`) rather than adding new
  primitives.
- Client screens follow the `useAsyncData` + `AsyncBoundary` + `DataTable` pattern with
  `Column<T>[]`.
- There are no `<form>` elements left — every screen action is a `Button` with an `onClick` handler
  over local state, because there are no server actions to post to. If you reintroduce one, add a
  pending state.
- New screen → add its entry to `LINKS` in `components/Nav.tsx`.
- `utils/errors.ts` (`errorCode`, `errorMessage`) normalizes Supabase/PostgREST errors for display.

---

## 7. Verify Before Calling Anything Done

```powershell
npm run check          # check:env + check:rls + check:gate  (22 / 49 / 22 assertions)
npm run lint
npx tsc --noEmit
npm run build
```

`check:rls` is the one that matters after touching `supabase/schema.sql`. It strips SQL comments
first, then asserts: all nine tables declared and RLS-enabled, SELECT/INSERT/UPDATE/DELETE policies
generated for each, policies targeting `anon`, grants matching the policies, `DELETE` withheld on the
four tables nothing deletes from, no `current_role`/`app_metadata`/role arrays left behind, and no
`FOR ALL` catch-all. **It is expected to fail loudly if you reintroduce a role ladder** — and a guard
that cannot fail is not a guard, so when you add an assertion, prove it first by breaking the code it
covers and confirming a FAIL.

`check:gate` is the equivalent for `lib/adminGate.ts` and the two Admin Console routes: it runs the
gate against a real `Request` (missing env → 503, wrong/absent header → 401, right header → null,
padded value still matches) and separately asserts that **every** exported handler in
`app/api/admin/users/*` calls it before any `lib/adminAuth` function, that the header name agrees
between client and server, and that nothing outside `lib/adminGate.ts` reads `ADMIN_CONSOLE_SECRET`.
Deleting a `adminSecretGate(request)` line fails it — checked 2026-10-08.

If you see `TS2307 Cannot find module '...app/(auth)/...'` from `.next/*/types/validator.ts`, those
are stale generated route validators from a previous `next dev`. `Remove-Item -Recurse -Force .next`
and rebuild; `next build` regenerates them.

Runtime checks against the **production** deployment — every one of these returns a Vercel SSO
redirect while Deployment Protection is on (§8):

```powershell
$site = "https://inventory-app-thimsin.vercel.app"
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" $site/          # 302 to vercel.com/sso-api
curl.exe -s -o NUL -w "%{http_code}" "$site/login"                      # 404 now, no such route
curl.exe -s -o NUL -w "%{http_code}" "$site/admin/users"                # 302: it exists, behind the same gate
```

**`vercel curl` gets past Deployment Protection with the authenticated CLI**, which is the only
credential-free way to read a response body from production. It is how §5 item 10 was diagnosed.
The flag forms (`-o`, `-w`) are not intercepted, so pipe stdout instead:

```powershell
vercel curl -s https://inventory-app-thimsin.vercel.app/api/admin/users
#   401 {"error":"Admin console secret required."}     <- the gate, working
vercel curl -s -i https://inventory-app-thimsin.vercel.app/api/admin/users   # status + headers
```

Locally (a dev server is usually already listening on :3000):

```powershell
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" http://localhost:3000/          # 200, no redirect
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/login                       # 404
curl.exe -s http://localhost:3000/api/supabase-test                                     # {"status":"ready",...}
```

---

## 8. Deployment

- `git push origin main` is the whole deploy. The Vercel Git integration is connected and it does
  build automatically — verified, not assumed.
- **Nothing in the repo configures this.** There is no `.github/` directory, and `vercel.json` only
  sets `framework`, `regions` and security headers; that file cannot enable push-to-deploy. If a push
  ever seems inert, re-check that the repo is still imported at vercel.com/new.
- **Vercel Deployment Protection is the only access control this application has.** With auth removed,
  there is no second layer: whatever it lets through gets full read and write on all nine tables
  (§3). It is ON today, which means:
  - Only Vercel-account users can reach the app at all. Ordinary staff need an account in your
    Vercel team, which is probably not what a school wants.
  - If anyone flips it off under **Project Settings → Deployment Protection** to share the link, the
    app becomes world-open and the Supabase project is reachable directly with the public key.
  - Treat it as a shared, undocumented gate. If this deployment is meant to be usable by people
    without Vercel accounts, that requires building an auth layer again — it cannot be solved by
    config alone, because RLS has no identity to check.
- **Tooling on this machine:** `gh` is installed but **not** authenticated (`gh auth login` needed, so
  check runs cannot be read). The `vercel` CLI **is** authenticated (device login as
  `thimsin79-8849`, 2026-10-08) and the project **is** linked — `.vercel/project.json` exists and
  `.gitignore` covers it. That makes `vercel env ls/add/rm`, `vercel redeploy <url>`, `vercel logs`,
  `vercel ls` and `vercel curl` all usable without a dashboard. There is still no `VERCEL_TOKEN`, so
  anything outside the CLI needs a browser session.
- **Runtime env the Admin Console needs:** `SUPABASE_ACCESS_TOKEN` must be set in Vercel Project
  Settings → Environment Variables, or `/api/admin/users*` returns 502 with an actionable message
  that the Users screen shows. It is read only on the server by `lib/adminAuth.ts` and never ships to
  the browser. `.env.local` carries a working Database Read-write PAT for local development; Vercel
  needs its own copy with the same scope. `ADMIN_CONSOLE_SECRET` is the second one (§3): without it
  the routes answer 503 and the Users screen stays locked. Both are server-only, and the same
  secret value in `.env.local` and Vercel means staff type it once. **Changing an env var does
  nothing for the live site until a new deployment exists** — `vercel redeploy <url>` or a push.
- **Verifying a deploy with no credentials — and its limit.** Pick a string that exists in exactly
  one commit, confirm it is absent from the parent (`git show <old-sha>:<file> | Select-String
  <string>`), then grep the production HTML for it. Signature blocks in the HTML are useless for this
  — they are deployment-specific, not commit-specific.

  **This only works while Deployment Protection is OFF.** Checked 2026-10-06, pushing `fe6b98f`: with
  protection on, `GET /` returns `302 -> https://vercel.com/sso-api?...` and the body is 14 bytes, so
  there is no HTML to grep. It 302s `/login` too, so the "route now 404s" test from §7 is equally
  blind — nothing in the response distinguishes a deployed build from an undeployed one.

  What you can verify with no credentials is that the commit reached the remote:
  `git ls-remote origin -h refs/heads/main` should print that sha. Everything past that — build
  success, live rollout — needs a Vercel session in a browser, `gh auth login`, or a
  `VERCEL_TOKEN`. Decide for a given deploy which one you are relying on rather than assuming the
  push implies the deploy.

  **With the authenticated CLI, none of that blindness applies** — `vercel curl <url>` fetches the
  real body through Deployment Protection (curl flags go after `--`, e.g.
  `vercel curl <url> -- --header "x-admin-secret: …"`; `-o`/`-w`/`-H` before the separator are *not*
  intercepted and fall through to a plain curl, which the 302 then blanks). That is how the gate and
  the Admin Console were verified in production on 2026-10-08, and `vercel ls` (newest deployment
  `● Ready`) plus `vercel logs <url>` cover the build side. See §7 for the exact probes.

---

## 9. Gotchas

- The **WebCRX** browser extension injects attributes onto `<html>`, which caused a hydration mismatch.
  It is suppressed on `<html>` in `app/layout.tsx`; disabling the extension removes the need.
- Typed routes are enabled. Global helpers like `LayoutProps<"/">` are generated per route, so a
  brand-new route's type only exists after a build or dev run. Deleting a route leaves a stale
  validator in `.next/` until you clear it. New layouts type `children` as `{ children: ReactNode }`.
- Read the matching guide in `node_modules/next/dist/docs/` before using any Next.js API — this
  version has breaking changes (see `AGENTS.md`).
- `.env*` is gitignored. Keep `.env.example` in sync with the variables the code actually reads:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  and the two server-only ones: `SUPABASE_ACCESS_TOKEN` (read by `lib/adminAuth.ts`) and
  `ADMIN_CONSOLE_SECRET` (read by `lib/adminGate.ts`).
  Never put a `NEXT_PUBLIC_` prefix on the token. There is **no** `SUPABASE_SERVICE_ROLE_KEY` any
  more — nothing in the repo reads it.
- **Running SQL from this machine:** no `psql`, no Supabase CLI, and no usable network path to the
  database — `db.<ref>.supabase.co` has no A record (IPv6-only) and this machine has no IPv6 route,
  and the pooler hostname is NXDOMAIN. The only route is the Management API
  `POST https://api.supabase.com/v1/projects/bktxzesvtmgcmznsfnlu/database/query` with a **scoped
  PAT (permission Database → Read-write)**; one lives in `.env.local` as `SUPABASE_ACCESS_TOKEN`.
  It answers 201 on success. `schema.sql` and `seed.sql` are idempotent and safe to re-run; verify
  anon access afterwards with the probe in §5 item 1.
- `NEXT_PUBLIC_*` values ship to the browser. There is no server-side secret to protect, because
  nothing in this app runs with elevated database access — except the two Admin Console variables
  above, which are exactly the ones that must never get the prefix.
- **A pasted env value can arrive with a UTF-8 BOM (U+FEFF)** in front of it, which is invisible in
  a dashboard and fatal in a header: `fetch` throws `Cannot convert argument to a ByteString … 65279`
  at index 7 of `Bearer <token>` (§5 item 10). Write the file with Node rather than pasting, prefer
  `vercel env add NAME env < file` over a PowerShell pipe, and the code trims anyway.
