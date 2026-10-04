'use client'

import type { ReactNode } from 'react'
import { Button, ErrorState, Spinner } from './ui'

/**
 * Renders the loading / error / schema-missing states shared by every screen,
 * so individual pages only handle the happy path.
 *
 * When PostgREST reports PGRST205 the tables do not exist yet, which is the
 * expected state before `supabase/schema.sql` has been applied. That gets a
 * dedicated explanation rather than a raw error.
 */
export function AsyncBoundary({
  loading,
  error,
  errorCode,
  onRetry,
  children,
}: {
  loading: boolean
  error: string | null
  errorCode?: string | null
  onRetry?: () => void
  children: ReactNode
}) {
  if (error) {
    if (errorCode === 'PGRST205') {
      return (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Database schema not applied</p>
          <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            The tables this page reads do not exist yet. Open your Supabase project → SQL Editor, paste
            <code className="mx-1 rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">supabase/schema.sql</code>
            and run it, then reload.
          </p>
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Check again
            </Button>
          )}
        </div>
      )
    }
    return <ErrorState message={error} onRetry={onRetry} />
  }

  if (loading) return <Spinner />

  return <>{children}</>
}