'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import type { PermissionKey } from '@/lib/permissions'

/**
 * Blocks a screen's content until the session resolves and the user holds
 * the screen's view permission. Mirrors `AsyncBoundary`: it renders a
 * spinner, a refusal, or the children, and sits inside the screen's Card.
 */
export function ScreenGate({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { loading, can } = useAuth()
  const [refreshing, setRefreshing] = useState(false)

  if (loading) return <Spinner label="Checking access" />

  if (!can(permission)) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="No access to this screen"
          hint={`This screen needs the ${permission} permission. An administrator can grant it in Admin Console, under Users, in Permissions.`}
        />
        <div className="flex justify-center">
          <Button
            variant="secondary"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true)
              try {
                await createClient().auth.refreshSession()
                window.location.reload()
              } catch {
                // fall through
              } finally {
                setRefreshing(false)
              }
            }}
          >
            {refreshing ? 'Refreshing…' : 'Refresh access'}
          </Button>
        </div>
      </div>
    )
  }

  return children
}
