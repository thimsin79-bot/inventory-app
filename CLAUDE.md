@AGENTS.md

# Project Context: Inventory Management System (Next.js + Supabase)

**Last Updated:** October 6, 2026
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
  **`supabase/schema.sql` has not been re-run since the auth removal**, so the live policies are
  whatever the last run produced. Measured 2026-10-06 with the publishable key directly: anon **can**
  read rows (so the live policies are *not* the `('admin','staff')` ones §5 used to claim), but the
  data is far below §4's counts — `items` returns 2 rows and the other eight tables return 0. Run the
  file and then re-measure; see §5 item 1.
- **No test framework, and deliberately none.** Two dependency-free Node scripts hold the logic a
  test runner would otherwise cover: `npm run check` = `check:env` + `check:rls`, 22 / 49 assertions.
  `check:env` imports `lib/supabase/env.ts` directly via Node's type stripping. Then `npm run lint`,
  `npx tsc --noEmit`, `npm run build`.

---

## 2. Actual Folder Layout

```
app/
  layout.tsx              root: Geist fonts, metadata, suppressHydrationWarning
  (app)/                  the 10 app screens + shared sidebar shell
  api/supabase-test/      connection diagnostic (unauthenticated, see §5)
components/               flat: ui.tsx, Nav, DataTable, Modal, forms, ConnectionStatus
hooks/useAsyncData.ts     loading/error/reload wrapper for client fetches
lib/supabase/             client.ts, server.ts, env.ts
services/inventoryService.ts   all data access, browser Supabase client
supabase/schema.sql       tables + RLS: anon read/write, policies generated in one DO block
supabase/seed.sql         verified reference data
types/database.types.ts   generated from the live schema
utils/format.ts, utils/errors.ts  live helpers
scripts/                  check-supabase-env.mjs, check-rls.mjs
```

What used to be here and is **not**: `app/(auth)/`, `app/auth/`, `app/actions/`, `app/(app)/admin/`,
`lib/auth.ts`, `lib/roles.ts`, `lib/supabase/dal.ts`, `lib/supabase/proxy.ts`,
`components/Permissions.tsx`, `components/UserMenu.tsx`, `components/SubmitButton.tsx`,
`proxy.ts` (the root middleware), `utils/supabase/`, `scripts/check-auth.mjs`. All deleted in the
auth removal. Earlier notes also described `components/ui/`, `components/layout/`,
`hooks/useDebounce.ts` and `lib/mockData.ts` — those were never built.

**Screens:** `/`, `/inventory`, `/purchases`, `/transactions`, `/requests`, `/audits`, `/categories`,
`/warehouses`, `/suppliers`, `/departments`. All ten are prerendered as static shells; the data
arrives on the client.

---

## 3. Access control — read this before touching RLS

**There is no authentication, no session, no role, and no server-side user.** The app holds exactly
one credential: the publishable key, which `lib/supabase/{client,server}.ts` reads and sends to the
browser. PostgREST presents that key as the `anon` role, so every request this app makes is an `anon`
request. There is nothing in a JWT to branch on, because there is no session.

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

Row counts are **stale in the old notes** and were re-measured 2026-10-06 with the publishable key:
items 2, and categories / warehouses / suppliers / departments / purchases / transactions / requests /
audits all 0. The previously recorded numbers (categories 9, items 21, warehouses 5, suppliers 5,
departments 6, purchases 6, transactions 7, requests 7, audits 5) describe seeded data that is no
longer in the project. `supabase/seed.sql` will put reference data back.

All reads and writes go through the **browser** Supabase client.

---

## 5. Open Issues — Do These Next

1. **`supabase/schema.sql` has not been run since the auth removal** (no DB password, no `psql`, no
   Docker on this machine). It is the only step that makes the boundary match the repo: the repo now
   says `TO anon USING (true)` with grants to `anon` and `private.current_role()` dropped, and the
   live project still holds whatever the previous run created.

   **Measured 2026-10-06, with the publishable key directly against PostgREST** — read-only, one
   `select=*&count=exact` per table:

   | | categories | items | warehouses | suppliers | departments | purchases | transactions | requests | audits |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   | observed | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

   Two things follow. **Anon can read**, so the live policies are *not* the `('admin','staff')` ones
   this file used to assert — that claim was stale, and the app is not currently blank. And **the data
   is gone**: the row counts this file used to list (items 21, categories 9, …) are not what is in the
   project any more, so re-run `supabase/seed.sql` alongside the schema if you want a populated app.

   Nothing in the repo executes SQL; run both files in the Supabase SQL editor, then re-run the
   probe above and confirm it still returns rows — a run that silently removes anon's access is
   exactly the failure `check:rls` cannot see.
2. **Vercel Deployment Protection is now load-bearing, not a preference.** It is the entire access
   boundary (§3). Make turning it off a deliberate decision, and note it currently also blocks
   ordinary staff, who need a Vercel account to see anything. See §8.
3. **Rotate credentials that were pasted into chat:** the account-scoped `sbp_…` personal access
   token, the database password, and an `sb_secret_…` key. Create scoped PATs instead — a classic PAT
   grants full account access. Prefer handing a token over by writing it to a gitignored file over
   pasting it into the conversation, which is how the last one leaked. Independent of the auth change.
4. **Delete the stray account `probe@users.invalid`, id
   `43623ca5-781f-4671-8c46-53e7e84502c3`** — inert, and now doubly irrelevant since nothing reads
   an account, but it should still go. Dashboard → Authentication, or the `auth.identities` /
   `auth.users` deletes below. Do not probe write endpoints on the live project without asking first.
5. **`/api/supabase-test` is unauthenticated and over-detailed.** It returns `categoriesSample` and
   `totalItemsInDb` to any caller, and is `ƒ (Dynamic)` while every real screen is static. It is no
   longer singled out in a public-path list — there are no public paths — so it sits behind the same
   single Vercel gate as everything else. Still worth shrinking or deleting: nothing calls it.
6. `recordTransaction` in `inventoryService.ts` inserts the transaction and updates the item in two
   round-trips; wrap both in a Postgres RPC if atomicity matters.
7. Reference screens (categories, warehouses, suppliers, departments) are read-only. Only inventory,
   purchases, requests and audits have write paths.
8. With no sessions, `lib/supabase/server.ts` exists only for `api/supabase-test`. If that route goes
   away, it and `createServerClient` go with it.

Deleting the stray probe account from §5 item 4:

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
npm run check          # check:env + check:rls  (22 / 49 assertions)
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

If you see `TS2307 Cannot find module '...app/(auth)/...'` from `.next/*/types/validator.ts`, those
are stale generated route validators from a previous `next dev`. `Remove-Item -Recurse -Force .next`
and rebuild; `next build` regenerates them.

Runtime checks against the **production** deployment — every one of these returns a Vercel SSO
redirect while Deployment Protection is on (§8):

```powershell
$site = "https://inventory-app-thimsin.vercel.app"
curl.exe -s -o NUL -w "%{http_code} -> %{redirect_url}" $site/          # 302 to vercel.com/sso-api
curl.exe -s -o NUL -w "%{http_code}" "$site/login"                      # 404 now, no such route
curl.exe -s -o NUL -w "%{http_code}" "$site/admin/users"                # 404 now, no such route
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
  check runs cannot be read). The `vercel` CLI is installed but the project is **not** linked (no
  `.vercel/project.json`, which `.gitignore` covers) and there is no `VERCEL_TOKEN`.
- **Verifying a deploy with no credentials:** pick a string that exists in exactly one commit and grep
  the production HTML for it. `git show <old-sha>:<file> | Select-String <string>` against the new one
  proves both that the string is new and that it is live. Signature blocks in the HTML are useless for
  this — they are deployment-specific, not commit-specific.

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
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  There is **no** `SUPABASE_SERVICE_ROLE_KEY` any more — nothing in the repo reads it.
- `NEXT_PUBLIC_*` values ship to the browser. There is no server-side secret to protect, because
  nothing in this app runs with elevated database access.
