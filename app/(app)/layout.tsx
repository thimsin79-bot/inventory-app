import { Suspense, type ReactNode } from 'react'
import { Nav } from '@/components/Nav'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { UserMenu } from '@/components/UserMenu'
import { PermissionsProvider } from '@/components/Permissions'
import { EmptyState } from '@/components/ui'
import { capabilitiesOf, getUser } from '@/lib/supabase/dal'
import type { Capabilities } from '@/lib/roles'

const NOTHING: Capabilities = {
  read: false,
  writeOperational: false,
  writeReference: false,
  manageAccounts: false,
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Memoized per render pass, so this is the same session read the pages and
  // UserMenu perform, not an extra round-trip.
  const user = await getUser()
  const capabilities = user ? capabilitiesOf(user) : NOTHING

  // A role-less account is the state every new signup lands in: signup runs on
  // the anon client, which cannot write app_metadata, so nothing grants a role
  // until an admin does. Without this the user gets the whole shell and nothing
  // else -- every screen empty, no explanation, no obvious way to tell whether
  // they are broken or locked out.
  const pendingRole = user && Object.values(capabilities).every((allowed) => !allowed)

  return (
    <PermissionsProvider capabilities={capabilities}>
      <div className="flex min-h-full flex-col lg:flex-row">
        <aside className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40 lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
          <div className="flex h-full flex-col px-4 py-4">
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3">
                <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Inventory</p>
                <ConnectionStatus />
              </div>
              {/* Nothing is reachable without a role, so the links would all lead
                  to empty screens. */}
              {pendingRole ? null : <Nav />}
            </div>

            <div className="mt-auto pt-4">
              <Suspense
                fallback={
                  <div className="h-9 border-t border-zinc-200 dark:border-zinc-800" aria-hidden="true" />
                }
              >
                <UserMenu />
              </Suspense>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {pendingRole ? (
            <EmptyState
              title="Your account has no role yet"
              // Spells out both routes, because the obvious one is dead: a role-less
              // account cannot open Admin -> Users, so for the first account in a
              // project there is nobody to ask and the instruction has to be the
              // dashboard or SQL. Sign out afterwards, or the claim stays out of the
              // token until it expires.
              hint="Nothing here is visible until you have one. If another admin already uses this app, ask them to set it under Admin → Users. If this is the first account in the project, add a role to your app_metadata in Supabase → Authentication → your account, or run the UPDATE statement in README.md. Then sign out and back in."
            />
          ) : (
            children
          )}
        </main>
      </div>
    </PermissionsProvider>
  )
}