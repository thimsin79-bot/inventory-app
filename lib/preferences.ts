export type ThemePreference = 'system' | 'light' | 'dark'

export type Preferences = {
  theme: ThemePreference
  defaultPage: string
  pageSize: number
}

export const PREFERENCES_STORAGE_KEY = 'inventory.preferences'

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

/** Every page a caller may pick as the landing page. */
export const LANDING_OPTIONS: { value: string; label: string }[] = [
  { value: '/', label: 'Dashboard' },
  { value: '/inventory', label: 'Inventory' },
  { value: '/purchases', label: 'Purchases' },
  { value: '/transactions', label: 'Transactions' },
  { value: '/requests', label: 'Requests' },
  { value: '/audits', label: 'Audits' },
  { value: '/maintenance', label: 'Maintenance History' },
  { value: '/categories', label: 'Categories' },
  { value: '/suppliers', label: 'Suppliers' },
  { value: '/departments', label: 'Departments' },
]

const LANDING_VALUES = new Set(LANDING_OPTIONS.map((o) => o.value))

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  defaultPage: '/',
  pageSize: 25,
}

export function normalizePreferences(value: unknown): Preferences {
  const input = (value ?? {}) as Partial<Preferences>

  const theme: ThemePreference =
    input.theme === 'light' || input.theme === 'dark' ? input.theme : 'system'

  const defaultPage =
    typeof input.defaultPage === 'string' && LANDING_VALUES.has(input.defaultPage)
      ? input.defaultPage
      : DEFAULT_PREFERENCES.defaultPage

  const pageSize = PAGE_SIZE_OPTIONS.includes(input.pageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? (input.pageSize as number)
    : DEFAULT_PREFERENCES.pageSize

  return { theme, defaultPage, pageSize }
}

export function readStoredPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
    return raw ? normalizePreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function writeStoredPreferences(preferences: Preferences): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Storage can throw when disabled (private mode, full quota). Preferences
    // are a convenience, so a write failure is not worth breaking a render.
  }
}

export function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'dark') return 'dark'
  if (theme === 'light') return 'light'
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Runs before paint to set the theme class, so a stored preference does not
 * flash the wrong palette on first load. Kept in sync with resolveTheme above.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${PREFERENCES_STORAGE_KEY}');var t=s?JSON.parse(s).theme:'system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`
