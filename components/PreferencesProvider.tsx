'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  PREFERENCES_STORAGE_KEY,
  readStoredPreferences,
  resolveTheme,
  writeStoredPreferences,
  type Preferences,
} from '@/lib/preferences'

type PreferencesContextValue = {
  preferences: Preferences
  update: (patch: Partial<Preferences>) => void
  reset: () => void
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  update: () => {},
  reset: () => {},
})

export function usePreferences() {
  return useContext(PreferencesContext)
}

/**
 * localStorage backed by useSyncExternalStore, so a preference change re-renders
 * only the screens that read it. `getServerSnapshot` returns the defaults, which
 * keeps server HTML stable; the client store then takes over without a hydration
 * mismatch. Updates publish through `setSnapshot`, and storage events from other
 * tabs re-read the stored value.
 */
const listeners = new Set<() => void>()
let snapshot: Preferences =
  typeof window === 'undefined' ? DEFAULT_PREFERENCES : readStoredPreferences()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return snapshot
}

function getServerSnapshot() {
  return DEFAULT_PREFERENCES
}

function setSnapshot(next: Preferences) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === PREFERENCES_STORAGE_KEY) setSnapshot(readStoredPreferences())
  })
}

/**
 * Holds the user's browser-only preferences (theme, landing page, rows per
 * page) in localStorage and applies the theme to <html>. Mounted once in the
 * root layout so it covers every route, including the Admin Console.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    const root = document.documentElement
    const apply = () => root.classList.toggle('dark', resolveTheme(preferences.theme) === 'dark')
    apply()

    if (preferences.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preferences.theme])

  const update = useCallback((patch: Partial<Preferences>) => {
    const next = normalizePreferences({ ...snapshot, ...patch })
    writeStoredPreferences(next)
    setSnapshot(next)
  }, [])

  const reset = useCallback(() => {
    writeStoredPreferences(DEFAULT_PREFERENCES)
    setSnapshot(DEFAULT_PREFERENCES)
  }, [])

  const value = useMemo(() => ({ preferences, update, reset }), [preferences, update, reset])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}