<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project context

Read `CLAUDE.md` before changing anything. It records the real folder layout, the access
boundary, the live row counts, the open security issues, and the verification commands.

Hard rules for this repo:

- Read the matching guide in `node_modules/next/dist/docs/` before using any Next.js API.
- **There is no sign-in layer** (removed 2026-10-09 for the second time): `/sign-in`, `/sign-up`,
  the root `proxy.ts`, per-screen permission gates and RLS-to-`authenticated` are gone. RLS
  policies are `TO anon` and the app is public. Read CLAUDE.md §3 before touching RLS; do not
  reintroduce an `authenticated`-only split or a `user_metadata` read without saying why.
- All data access is client-side through `services/inventoryService.ts` with the publishable key;
  `anon` is granted every screen command and `authenticated` is revoked everywhere.
- The Admin Console (moved 2026-10-09 to `app/admin/users`), its routes and the DB are gated one
  way and one way only: `adminSecretGate` (shared secret). There is no second gate; do not re-add
  `permissionCheck` unless a session layer exists again.
- Reuse the primitives in `components/ui.tsx` and follow the existing
  `useAsyncData` + `AsyncBoundary` screen pattern.
- Never commit, echo, or paste keys. `.env*` is gitignored.
- Verify with `npm run check`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
