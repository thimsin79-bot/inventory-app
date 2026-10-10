import type { ReactNode } from 'react'
import { Nav } from '@/components/Nav'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { LandingRedirect } from '@/components/LandingRedirect'
import { GATE_INIT_SCRIPT } from '@/lib/session'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Client-side sign-in gate (see lib/session.ts): pre-paint redirect to
          /login when the signed-in flag is missing. Renders into the HTML so it
          runs before the shell paints. */}
      <script dangerouslySetInnerHTML={{ __html: GATE_INIT_SCRIPT }} />
      <LandingRedirect />
      <aside className="border-b border-zinc-200 bg-zinc-50/60 print:hidden dark:border-zinc-800 dark:bg-zinc-900/40 lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3">
            <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Inventory</p>
            <ConnectionStatus />
          </div>
          <Nav />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 print:px-0 print:py-0 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}