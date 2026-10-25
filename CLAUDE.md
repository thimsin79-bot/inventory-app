@AGENTS.md

# Project Context: Inventory Management System (Next.js + Supabase)

**Last Updated:** October 25, 2026
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
  Later the same day the Users screen's other three functions (`list_login_users`,
  `create_login_user`, `delete_login_user`) were applied live and verified over REST too —
  create → true, duplicate username → false, password under 4 chars → false, list yields only
  `username`/`display_name`/`created_at`, delete → true (§5 item 10).
- **No test framework, and deliberately none.** Three dependency-free Node scripts hold the logic a
  test runner would otherwise cover: `npm run check` = `check:env` + `check:rls` (22 / 61
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
  maintenance/            Maintenance History log (item, brand/model, serial, category, cost,
                          purchase date, supplier, department, maintenance date, remark): create + delete
  import-export/           CSV export of every item + CSV import that upserts by barcode
  reports/                read-only rollups: valuation, purchases, requests, maintenance;
                          Print report button strips the shell and prints just the table
  settings/               company info (DB-backed, logo upload) + browser-only preferences
  users/                  login accounts: create, list, delete via the login_user function family
  api/supabase-test/      connection diagnostic (public)
components/               flat: ui.tsx, Nav (links + Sign out), DataTable (cards on phones, table on sm+,
                          paginates per preference), Modal, forms,
                          ConnectionStatus, MovementForm, ItemFormFields,
                          PreferencesProvider, LandingRedirect
hooks/useAsyncData.ts     loading/error/reload wrapper for client fetches
lib/supabase/             client.ts, server.ts, env.ts
lib/preferences.ts        browser-only preference storage + theme resolution (no server usage)
lib/itemsCsv.ts           items CSV contract: column list, export mapping, parse + row validation
services/inventoryService.ts   all data access, browser Supabase client
supabase/schema.sql       tables + RLS: anon-only policies, generated in one DO block; logos bucket
supabase/seed.sql         verified reference data
types/database.types.ts   generated from the live schema
utils/format.ts, utils/errors.ts, utils/csv.ts  live helpers (csv = dependency-free RFC 4180 parse/serialize)
scripts/                  check-supabase-env.mjs, check-rls.mjs, import-sheet.mjs (Google Sheet → items, §5 item 22)
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
`getWarehouses()` service call survive — the Import / Export screen reads the table to resolve
warehouse names).

**Screens:** `/`, `/inventory`, `/purchases`, `/requests`,
`/maintenance`, `/reports`, `/import-export`, `/categories`, `/suppliers`, `/departments`, `/users`, `/settings`
(prerendered static shells; data arrives on the client), plus `/login` — a standalone page outside
the `(app)` shell that verifies a username + password against `app_users` and sets no session.
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
requests 7, maintenance 6, company_settings 1, app_users 1
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
   to a gitignored file rather than pasting it into a conversation. **As of 2026-10-17 the token
   in `.env.local` is dead** (`401 Invalid access token`), so `npm run smoke` and hand-run §9 SQL
   are blocked until a fresh PAT is written there (see item 13).
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
10. **Closed 2026-10-10 — the Users screen is in the app and management is live.** Asks were "New
    Users screen" + "Add list + delete", so `app/(app)/users` lists every `app_users` account and
    creates/deletes through the three SECURITY DEFINER functions (§3), never via table grants, and
    hashes are never returned (confirms at rest even a `list_login_users` caller can't see a hash).
    Live-verified over REST. Shipped as `d99c8d0`.
11. **Closed 2026-10-10 — Reports has a print function.** "Add function print report": a Print
    report button on `/reports` (`window.print()`) prints just the selected table. Print CSS =
    Tailwind `print:` variants (`print:hidden` shell/tiles/picker, `print:block` title with the
    `beforeprint`-stamped date, §6) plus ink-on-white in `app/globals.css`. Shipped as `e651cb9`.
12. **Closed 2026-10-10 — DataTable is responsive with no horizontal scroll.** Per the
    "cards instead of tables on phones" ask, rows below `sm` stack as label/value cards
    (`sm:hidden`) and the real table renders on `sm+` (`hidden sm:block`) — one change in
    `components/DataTable.tsx` covers ~13 tables. Shipped as `2734692`.
13. **Closed 2026-10-17 — the /login "Invalid username or password" lockout was fixed.** The
    seeded `admin` row had been deleted from the live `app_users` table (only `Sin` and two
    `edge…` accounts remained), so `admin`/`admin123` returned `{ok: false}`. `admin` was
    re-created live through `create_login_user` (publishable key, no token needed) with display
    name `Administrator`, and username matching is now case-insensitive end to end: in
    `schema.sql`, `login_user` lower-compares against `lower(btrim(...))` and `create_login_user`
    stores `lower(btrim(...))` and rejects a case-insensitive duplicate; in the client
    (`services/inventoryService.ts`), create lowercases the username and a failed `login_user`
    attempt resolves the stored spelling through `list_login_users` and retries once. Verified
    live over REST: `admin`/`Admin`/`ADMIN` all `{ok: true}`, wrong password `{ok: false}`, and a
    create/login/delete round-trip. **Caveat:** the dead `SUPABASE_ACCESS_TOKEN` (item 4) meant
    `schema.sql` could **not** be re-applied, so the live functions still compare usernames
    exactly and the case-insensitivity lives in the client until a fresh PAT is written and §9 is
    re-run.
14. **Closed 2026-10-17 — the Audits screen and its module were removed.** Per the request to
    remove the `/audits` page, the entire audits feature was removed: the route `app/(app)/audits`,
    nav link and icon, landing option, `getAudits`/`createAudit` service functions, `Audit`/
    `AuditStatus` types, audits table from `schema.sql` (policies, grants, revokes), seed rows,
    and related check/smoke references. The live database table remains (no token to drop it);
    the schema file now omits audits, so re-applying it won't create it. `getWarehouses()` and
    the `warehouses` table stay (still referenced).
15. **Closed 2026-10-20 — the Maintenance History screen was rebuilt to the richer layout.**
    The `maintenance` table gained `brand`, `model`, `location`, `serial_number`, `category`,
    `purchase_date`, `supplier_name`, `department_name` and `remark` (all nullable TEXT/DATE
    snapshots — still no FK to `items`), and `description` was dropped (replaced by `category` +
    `remark`; the live table was empty). The screen's form and table now render every column from
    the requested layout: Item, Brand, Model, Location, Serial Number, Category Maintenance,
    Status, Cost, Date of Purchase, Service Supplier, Department, Date Maintenance (`date`,
    required, defaults to today), User Remark. `schema.sql` includes idempotent
    `ADD COLUMN IF NOT EXISTS` / `DROP COLUMN IF EXISTS description` ALTERs after the
    `CREATE TABLE IF NOT EXISTS` so re-applying upgrades the existing live table. **Caveat:** the
    dead `SUPABASE_ACCESS_TOKEN` (item 4) still blocks §9, so the live table has only the old
    columns until a fresh PAT is written and `schema.sql` is re-run — the new form fields will
    fail against live PostgREST until then.
16. **Closed 2026-10-20 — an Import / Export screen ships for inventory items.** `/import-export`
    (nav link after Reports) exports every item to a CSV (`utils/csv.ts` writer, UTF-8 BOM for
    Excel, CRLF; `lib/itemsCsv.ts` holds the 19-column contract — category/supplier/warehouse
    travel as names, not ids) and imports a CSV back: rows whose `barcode` matches an existing
    item update it, new or blank barcodes create items (`nextBarcode()` fills blanks), missing
    categories/suppliers are created by name, unknown warehouse names are skipped with a warning.
    Parsing and per-row validation are dependency-free (`utils/csv.ts` parser handles quotes,
    doubled quotes, multiline fields, BOM; row errors surface in a preview table before anything
    is written; a failed row does not reserve its barcode). Blank cells leave the column default
    (create) or the current value (update). No new npm dependencies. Live-data only — no schema
    change, so it works against the current live database.
17. **Closed 2026-10-25 — the "In stock" badge was removed from the inventory table.** In
    `app/(app)/inventory/page.tsx`, items that are in stock (`stockTone === 'good'`) no longer display
    the green badge, keeping the Quantity column clean with just the number and unit (e.g. 10 Pcs);
    warning badges for Low and Out of stock are preserved. In `components/ui.tsx`, `Badge` gained
    `whitespace-nowrap` so badges in compact tables never wrap words into two lines. Shipped as
    `cdf52f5`.
18. **Closed 2026-10-25 — the Value column was removed from the inventory table.** In
    `app/(app)/inventory/page.tsx`, the `Value` column (`qty * price`) was removed from the
    DataTable `columns` list per request.
19. **Closed 2026-10-25 — Added 'Maintain' action button to Inventory table.** In
    `app/(app)/inventory/page.tsx`, each row in the inventory table now has a `Maintain` action button.
    Clicking it opens a pre-filled maintenance modal populated with that item's name, brand, model,
    location, serial number, category, purchase date, supplier, department, and remark, allowing users
    to quickly log servicing or repairs to the `maintenance` table.
20. **Closed 2026-10-25 — Handled missing 'brand' column in maintenance table.** The live database
    table `maintenance` predated the expanded layout (lacking `brand`, `model`, etc.). `createMaintenance`
    in `services/inventoryService.ts` now catches the PostgREST schema cache error and gracefully falls
    back to the live schema columns, packaging metadata into `description`. `getMaintenance` unpacks
    them back so all fields display properly. Running the idempotent `ALTER TABLE` block from `schema.sql`
    in Supabase SQL editor upgrades the live table permanently.
21. **Closed 2026-10-25 — Added Edit and Update functionality to Maintenance table.** In
    `app/(app)/maintenance/page.tsx`, each row now has an `Edit` action button alongside `Delete`.
    Clicking `Edit` opens the modal pre-filled with that record's values, allowing users to modify
    fields and save with the `Update` button via the newly added `updateMaintenance` function in
    `services/inventoryService.ts`.
22. **Closed 2026-10-25 — `npm run import:sheet` imports items from the ICT Google Sheet.**
    `scripts/import-sheet.mjs` reads the 12 item tabs (Laptop, Desktop, Printer, Projector, Monitor,
    Smart TV, Tablet, Security Camera, DVRNVR, Switch, Access PointRouter, Accessory) through the
    sheet's `gviz` CSV endpoint — the sheet must be shared "Anyone with the link" (Viewer). Each tab
    maps to a category by name; `ICT Code` is `items.barcode`. **Dry run by default**; `-- --apply`
    writes. It only **adds** barcodes that are not in the database (never updates), creates missing
    categories/suppliers by name, skips rows with an incomplete code or a duplicate code, and warns on
    dates it cannot parse. Cleanup rules: `$1,234.00` → number, `N/A`/blank → empty, blank cost/price →
    0, blank qty → 1, dates (`2-Oct-2017`, `10-Aug-17`, `8/10/2018` month-first, Excel serials) →
    `YYYY-MM-DD`. Network calls retry up to 5× (connect timeouts are common on this machine). The
    Maintenance History and Broken List tabs are **not** imported. Uses the publishable key from
    `.env.local` like the app, so it is non-destructive and needs no PAT; it is deliberately **not** in
    `npm run check`. First run on 2026-10-25 loaded 340 items (51 laptops, 35 desktops, 254 others).
    Supplier spellings are copied as the sheet has them (e.g. `Asain IT` / `Asian IT` / `Asean IT`), so
    merge duplicates in the Suppliers screen.
23. **Closed 2026-10-25 — responsive pass over every screen.** Audited all 12 screens + `/login` at
    320 / 375 / 768 / 1024 / 1440 px with headless Edge over CDP (signed in via the
    `inventory.signedIn` flag): no page overflows horizontally at any width. Two real problems fixed.
    (1) Below `lg` the sidebar nav was a sideways-scrolling strip that showed ~3 of 12 links with no
    hint of the rest; `components/Nav.tsx` now shows a **Menu** button (current page on the right)
    that expands a 2/3-column grid of every link plus Sign out; picking a link closes it, and `lg+`
    is unchanged. (2) Wide tables (Inventory has 15 columns, Maintenance 14) scroll sideways inside
    their own container on sm–xl screens, which hid Edit / Delete off-screen; `DataTable` now pins
    any column keyed `actions` to the right edge (`sticky right-0` with a background and edge
    shadow), so all eight screens with row actions keep them reachable. Also `whitespace-nowrap` on
    the inventory barcode so `SH-PJ00034` no longer wraps. `lint`, `tsc`, `build`, `check` (61) green.
    The audit script lives outside the repo (`d:\ICT\downloads\responsive-audit.mjs`, Windows Edge
    path hard-coded); it needs the dev server on :3000.
24. **Closed 2026-10-25 — the four summary tiles were removed from the Inventory screen.** Items
    tracked / Units on hand / Stock value / At or below min and their `stats` memo are gone from
    `app/(app)/inventory/page.tsx` per request. The header still shows the item count; low-stock rows
    still get the amber row tint. Reports keeps its own rollups.
25. **Closed 2026-10-25 — Inventory row buttons collapsed into one "Actions" menu.** The four inline
    buttons (Maintain / Move / Edit / Delete) are now a single `Actions` button per row that opens a
    small menu (`components/RowActions.tsx`, takes `actions: { label, onSelect, tone? }[]`). The menu
    is portalled to `<body>` and `fixed`-positioned from the button's rect: a table's overflow
    container clips absolute popovers, and the pinned `actions` column (§5 item 23) is its own
    stacking context that paints later rows over an in-cell menu — both were hit while building it.
    It clamps to the viewport (the button sits at the left of a phone card), flips above the button
    near the screen bottom, and closes on outside click / Escape / scroll / resize. Only Inventory
    uses it so far; other screens still show inline buttons. Verified in headless Edge at 375 and
    1440 px (menu items, flip, Escape, Edit opens its dialog).

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
  add its entry to `LINKS` and a route under `app/(app)/`. Below `lg` the links sit behind a Menu
  button (state is local; links close it), at `lg+` it is the always-visible sidebar.
- A `DataTable` column with `key: 'actions'` is pinned to the right edge on `sm+` (see §5 item 23);
  name a row-actions column exactly that to get the behaviour.
- `DataTable` paginates client-side using the user's rows-per-page preference, so a screen does
  not manage paging state itself. The pager only appears when a table exceeds the page size. It
  is responsive by default: below `sm` each row stacks as a label/value card; on `sm+` the real
  table renders — no screen opts in or out, so every table gets mobile cards for free.
- **Printing (Reports):** use the Tailwind `print:` variant — `print:hidden` on chrome (sidebar,
  page header, stat tiles, report picker) and a print-only title (`hidden print:block`).
  `app/globals.css` forces ink-on-white for paper. Stamp dynamic values like the generated date
  with a `beforeprint` listener writing into a ref — never render state, and never `new Date()`
  in JSX: `useEffect` + `setState` trips `react-hooks/set-state-in-effect`, and a Date in render
  mismatches the prerendered static HTML. The Reports print header takes exactly this path.
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
npm run check          # check:env + check:rls (22 / 61)
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
deleted with the module on 2026-10-10, leaving `check` at `check:env` + `check:rls` (22 / 61).

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

Most screen content now renders inside a client-side `AsyncBoundary`, so a feature's markup is
usually **not** in the prerendered HTML: the Reports **Print report** button and the DataTable's
mobile-card layout only exist in the JS/CSS chunks. Grep the page's JS chunk (e.g.
`vercel curl https://…/_next/static/immutable/chunks/<chunk>.js`) for `Print report` /
`beforeprint` / `space-y-3` and the CSS chunk for `@media print`. The shell pieces that DO appear
in static HTML are the layout-level classes (`print:hidden` on the aside, `print:px-0` on main),
so a changed prerequisite like a bit-copied class list can be confirmed without JS. (Verified this
way for the `e651cb9` and `2734692` deploys.)

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
  at index 7 of `Bearer <token>` (§5 item 9). Write the file with Node rather than pasting, prefer
  `vercel env add NAME env < file` over a PowerShell pipe, and the code trims anyway.
- **Auth-account management is SQL-only now.** The Admin Console and `lib/adminAuth.ts` are gone,
  so any change to `auth.users` / `auth.identities` (e.g. deleting the inert accounts from §5
  item 2) runs through the Management API in one statement batch. There is no GoTrue admin client
  on this machine.