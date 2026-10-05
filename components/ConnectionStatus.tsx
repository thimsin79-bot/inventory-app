'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readSupabaseEnv, supabaseEnvProblems } from '@/lib/supabase/env'

type Status = 'checking' | 'connected' | 'schema_missing' | 'error' | 'unconfigured'

const REFRESH_MS = 60_000

const VIEW: Record<Status, { label: string; dot: string; text: string }> = {
  checking: { label: 'Checking', dot: 'bg-zinc-400 animate-pulse', text: 'text-zinc-600 dark:text-zinc-300' },
  connected: { label: 'Connected', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  schema_missing: { label: 'No schema', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  error: { label: 'Offline', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  unconfigured: { label: 'Not configured', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
}

type Probe = { status: Status; detail: string }

/**
 * Navbar indicator for the Supabase connection.
 *
 * Probes with a single `limit 1` read rather than reusing /api/supabase-test,
 * which runs two queries and returns a payload meant for debugging. The
 * PGRST205 case is called out separately because reaching the API with valid
 * credentials but no tables is a different problem from being unable to connect.
 */
export function ConnectionStatus() {
  const [probe, setProbe] = useState<Probe>({
    status: 'checking',
    detail: 'Checking Supabase connection…',
  })

  // Pure probe: resolves a result rather than writing state, so the caller
  // applies it from a promise callback instead of during render.
  const runProbe = useCallback(async (): Promise<Probe> => {
    // Same check the proxy and server clients use, so this badge cannot claim
    // "connected" while the app itself refuses to serve.
    const problems = supabaseEnvProblems()

    if (problems.length > 0) {
      return { status: 'unconfigured', detail: problems.join('; ') }
    }

    const { url } = readSupabaseEnv()

    try {
      const { error } = await createClient().from('categories').select('id').limit(1)

      if (!error) return { status: 'connected', detail: `Connected to ${new URL(url).host}` }
      if (error.code === 'PGRST205') {
        return {
          status: 'schema_missing',
          detail: 'Connected, but the tables do not exist yet — run supabase/schema.sql',
        }
      }
      return { status: 'error', detail: error.message }
    } catch (e) {
      return { status: 'error', detail: e instanceof Error ? e.message : 'Could not reach Supabase' }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const refresh = () => {
      runProbe().then((result) => {
        if (!cancelled) setProbe(result)
      })
    }

    refresh()

    const timer = setInterval(refresh, REFRESH_MS)

    function onFocus() {
      refresh()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [runProbe])

  const view = VIEW[probe.status]

  return (
    <span
      title={probe.detail}
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span className={`size-2 shrink-0 rounded-full ${view.dot}`} aria-hidden="true" />
      <span className={`font-medium whitespace-nowrap ${view.text}`}>Supabase {view.label}</span>
    </span>
  )
}