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
- **There is no authentication.** Login, signup, the session proxy, `lib/roles.ts`,
  `lib/supabase/dal.ts` and `/admin/users` were deleted on 2026-10-06. Do not add a
  server-side session read back without reading CLAUDE.md §3 and §8 first.
- All data access is client-side through `services/inventoryService.ts`. The policies in
  `supabase/schema.sql` grant `anon` full read and write and are deliberately **not** a
  security boundary — Vercel Deployment Protection is the only gate. Never widen or narrow
  a policy to make a query pass without re-reading CLAUDE.md §3.
- Reuse the primitives in `components/ui.tsx` and follow the existing
  `useAsyncData` + `AsyncBoundary` screen pattern.
- Never commit, echo, or paste keys. `.env*` is gitignored.
- Verify with `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
