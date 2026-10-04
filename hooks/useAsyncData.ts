'use client'

import { useCallback, useEffect, useState } from 'react'
import { errorCode, errorMessage } from '@/utils/errors'

type Result<T> = {
  data: T | null
  error: string | null
  errorCode: string | null
  loading: boolean
}

type State<T> = Result<T> & { reload: () => void }

/**
 * Runs an async Supabase loader and tracks loading/error/data state.
 *
 * Refetches whenever `loader` identity changes, so callers must pass a stable
 * function: either a module-level import (`useAsyncData(getCategories)`) or a
 * `useCallback` when the loader closes over state. `reload` bumps a counter to
 * force a refetch without changing that identity.
 *
 * State is only written when a request settles, so a refetch keeps the previous
 * result on screen instead of flashing a spinner — relevant here because the
 * inventory search re-queries on every keystroke.
 */
export function useAsyncData<T>(loader: () => Promise<T>): State<T> {
  const [nonce, setNonce] = useState(0)
  const [result, setResult] = useState<Result<T>>({
    data: null,
    error: null,
    errorCode: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    loader().then(
      (data) => {
        if (cancelled) return
        setResult({ data, error: null, errorCode: null, loading: false })
      },
      (e: unknown) => {
        if (cancelled) return
        setResult({ data: null, error: errorMessage(e), errorCode: errorCode(e), loading: false })
      },
    )

    return () => {
      cancelled = true
    }
  }, [loader, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { ...result, reload }
}