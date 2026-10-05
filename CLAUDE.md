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
- Project auth config: `disable_signup: false`, `mailer_autoconfirm: true` → sign-in works immediately. Anonymous sign-ins are off.
- Layering rule: layouts do not re-render on client navigation, so the proxy is the redirect gate and RLS is the data gate.
- Guards: `npm run check:auth` (username mapping, case folding, redirect guard) and `npm run check:env` (deployment env validation). Both are dependency-free Node scripts.

---

## 4. Database

Nine tables, all with `TEXT` primary keys and no default, so ids are generated in `services/inventoryService.ts:17` (`nextId(prefix, length)` → `TXN000123`, `PO-20260001`, `AUD00042`, `REQ00017`).

Live row counts: categories 9, items 21, warehouses 5, suppliers 5, departments 6, purchases 6, transactions 7, requests 7, audits 5.

All reads and writes go through the **browser** Supabase client, which means RLS is the only real data boundary.

---

## 5. Open Issues — Do These Next

1. **RLS is wide open.** Every table has `FOR ALL USING (true)`, so anyone holding the publishable key bypasses the login entirely. Replace with per-table `TO authenticated` policies, or add roles (`admin`/`manager`/`staff`) if per-screen control is wanted. Per the Supabase skill, `auth.role()` is deprecated — use the `TO` clause. UPDATE policies need both `USING` and `WITH CHECK`.
2. **Supabase dashboard config.** Add `http://localhost:3000/**` to Authentication → URL Configuration → Redirect URLs and set the Site URL, otherwise emailed confirmation links do not return to the app. Attach a real SMTP provider; the built-in one is rate-limited and public sign-up will silently fail to deliver.
3. **Rotate credentials that were pasted into chat:** the account-scoped `sbp_…` personal access token, the database password, and an `sb_secret_…` key. Create scoped PATs instead — a classic PAT grants full account access.
4. Delete the dead `utils/supabase/*` duplicates.
5. `recordTransaction` in `inventoryService.ts` inserts the transaction and updates the item in two round-trips; wrap both in a Postgres RPC if atomicity matters.
6. Reference screens (categories, warehouses, suppliers, departments) are read-only. Only inventory, purchases, requests, and audits have write paths.

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
```

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
