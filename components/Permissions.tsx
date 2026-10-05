'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Capabilities } from '@/lib/roles'

/**
 * What the signed-in user may do, read once in the server layout and handed to
 * the client screens.
 *
 * This is a rendering convenience, not a security boundary. Every query in this
 * app runs through the browser Supabase client, so any holder of a session token
 * can call the Data API directly and RLS is what actually decides. The purpose
 * here is only to avoid showing a viewer a form that could never succeed.
 */

const NO_CAPABILITIES: Capabilities = {
  read: false,
  writeOperational: false,
  writeReference: false,
  manageAccounts: false,
}

const PermissionsContext = createContext<Capabilities>(NO_CAPABILITIES)

export function PermissionsProvider({
  capabilities,
  children,
}: {
  capabilities: Capabilities
  children: ReactNode
}) {
  return <PermissionsContext value={capabilities}>{children}</PermissionsContext>
}

/**
 * Defaults to no capabilities rather than throwing, so a screen rendered outside
 * the app layout fails closed instead of crashing.
 */
export function usePermissions(): Capabilities {
  return useContext(PermissionsContext)
}