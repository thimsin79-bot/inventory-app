<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project context

Read `CLAUDE.md` before changing anything. It records the real folder layout, the auth
design, the live row counts, the open security issues, and the verification commands.

Hard rules for this repo:

- Read the matching guide in `node_modules/next/dist/docs/` before using any Next.js API.
- Session reads go through `lib/supabase/dal.ts`; route redirects live in
  `lib/supabase/proxy.ts`; auth server actions live in `app/actions/auth.ts`.
- All data access is client-side through `services/inventoryService.ts`, so the RLS
  policies in `supabase/schema.sql` are the only data boundary. Never widen a policy to
  make a query pass.
- Reuse the primitives in `components/ui.tsx` and follow the existing
  `useAsyncData` + `AsyncBoundary` screen pattern.
- Never commit, echo, or paste keys. `.env*` is gitignored.
- Verify with `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
