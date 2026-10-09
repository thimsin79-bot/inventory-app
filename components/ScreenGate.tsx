'use client'

import type { ReactNode } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { EmptyState, Spinner } from '@/components/ui'
import type { PermissionKey } from '@/lib/permissions'

/**
 * Blocks a screen's content until the session resolves and the user holds
 * the screen's view permission. Mirrors `AsyncBoundary`: it renders a
 * spinner, a refusal, or the children, and sits inside the screen's Card.
 */
export function ScreenGate({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { loading, can } = useAuth()

  if (loading) return <Spinner label="Checking access" />

  if (!can(permission)) {
    return (
      <EmptyState
        title="No access to this screen"
        hint={`This screen needs the ${permission} permission. An administrator can grant it in Admin Console, under Users, in Permissions.`}
      />
    )
  }

  return children
}
