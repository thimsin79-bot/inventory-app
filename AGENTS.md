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
- **There is an authentication layer again** (built 2026-10-09 on the 2026-10-06 removal):
  `/sign-in`, a root `proxy.ts` session gate, RLS flipped to `authenticated`-only, and per-screen
  permissions from `app_metadata.permissions`. Read CLAUDE.md §3 before touching RLS or the proxy;
  do not widen a policy to `anon` or add `user_metadata` reads.
- All data access is client-side through `services/inventoryService.ts`. It only works with a
  signed-in session: `anon` is revoked from every table, and the proxy refuses session-less
  requests (pages → `/sign-in`, `/api/*` → 403 JSON).
- The Admin Console routes are gated twice: `adminSecretGate` (shared secret) then
  `permissionCheck('admin.view' | 'admin.manage')`, never the reverse order.
- Reuse the primitives in `components/ui.tsx` and follow the existing
  `useAsyncData` + `AsyncBoundary` screen pattern.
- Never commit, echo, or paste keys. `.env*` is gitignored.
- Verify with `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
