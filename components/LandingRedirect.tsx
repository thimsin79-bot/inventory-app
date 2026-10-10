'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePreferences } from '@/components/PreferencesProvider'

const SESSION_GUARD_KEY = 'inventory.landed'

/**
 * Redirects the first visit to `/` in a session to the configured landing page.
 * The session guard keeps the Dashboard one nav click away afterwards, so the
 * redirect is a convenience rather than a lock.
 */
export function LandingRedirect() {
  const { preferences } = usePreferences()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname !== '/') return
    const target = preferences.defaultPage
    if (!target || target === '/') return
    try {
      if (sessionStorage.getItem(SESSION_GUARD_KEY) === '1') return
      sessionStorage.setItem(SESSION_GUARD_KEY, '1')
    } catch {
      // No sessionStorage (disabled): still honour the preference.
    }
    router.replace(target)
  }, [pathname, preferences.defaultPage, router])

  return null
}