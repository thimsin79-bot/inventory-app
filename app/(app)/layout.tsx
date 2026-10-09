import type { ReactNode } from 'react'
import { AuthProvider } from '@/components/AuthProvider'
import { Nav } from '@/components/Nav'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { UserMenu } from '@/components/UserMenu'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-full flex-col lg:flex-row">
        <aside className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40 lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
          <div className="flex h-full flex-col px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3">
              <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Inventory</p>
              <ConnectionStatus />
            </div>
            <Nav />
            <UserMenu />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AuthProvider>
  )
}
