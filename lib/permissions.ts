/**
 * The permission catalog the Admin Console ticks for each user.
 *
 * Keys are stored in the user's Supabase Auth `app_metadata.permissions`
 * array. GoTrue embeds `app_metadata` in the access token, so enforcement
 * reads the same list from the session with no extra lookup — in the UI
 * through `components/AuthProvider.tsx` and on the Admin Console routes
 * through `lib/auth.ts`. `user_metadata` is never consulted: the user can
 * edit it themselves, so it cannot decide anything.
 *
 * `<screen>.view`   may open the screen.
 * `<screen>.manage` may create, edit and delete within it. The reference
 * screens (categories, warehouses, suppliers, departments) are read-only
 * in this app, so they have no manage entry.
 */

export const PERMISSION_GROUPS = [
  {
    id: 'screens',
    label: 'Screens',
    permissions: [
      { key: 'dashboard.view', label: 'Dashboard' },
      { key: 'inventory.view', label: 'Inventory' },
      { key: 'purchases.view', label: 'Purchases' },
      { key: 'transactions.view', label: 'Transactions' },
      { key: 'requests.view', label: 'Requests' },
      { key: 'audits.view', label: 'Audits' },
      { key: 'categories.view', label: 'Categories' },
      { key: 'warehouses.view', label: 'Warehouses' },
      { key: 'suppliers.view', label: 'Suppliers' },
      { key: 'departments.view', label: 'Departments' },
      { key: 'admin.view', label: 'Admin Console' },
    ],
  },
  {
    id: 'manage',
    label: 'Manage (create, edit and delete)',
    permissions: [
      { key: 'inventory.manage', label: 'Inventory' },
      { key: 'purchases.manage', label: 'Purchases' },
      { key: 'transactions.manage', label: 'Transactions' },
      { key: 'requests.manage', label: 'Requests' },
      { key: 'audits.manage', label: 'Audits' },
      { key: 'admin.manage', label: 'Admin Console — create and edit users' },
    ],
  },
] as const

export type PermissionKey = (typeof PERMISSION_GROUPS)[number]['permissions'][number]['key']

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((p) => p.key),
)

/**
 * Reduces an untrusted value (whatever sits in `app_metadata`) to known
 * keys, in catalog order. Unknown keys are dropped rather than kept: a
 * key this build does not understand must not survive into the UI or a
 * future enforcement check.
 */
export function sanitizePermissions(value: unknown): PermissionKey[] {
  const list = Array.isArray(value) ? value : []
  return ALL_PERMISSIONS.filter((key) => list.includes(key))
}

/**
 * The signed-in identity every gate branches on.
 */
export type SessionUser = {
  id: string
  email: string
  permissions: PermissionKey[]
}

/**
 * Reduces an untrusted auth object — an access-token claim set from
 * `getClaims()` (id under `sub`) or a `session.user` from the browser client
 * (id under `id`) — to the shape the gates use. Returns null when there is no
 * id to stand on, so a malformed token is nobody rather than somebody with
 * empty permissions.
 */
export function sessionFromAuth(input: unknown): SessionUser | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as { id?: unknown; sub?: unknown; email?: unknown; app_metadata?: unknown }
  const id = typeof raw.id === 'string' && raw.id ? raw.id : typeof raw.sub === 'string' && raw.sub ? raw.sub : null
  if (!id) return null

  const appMetadata =
    raw.app_metadata && typeof raw.app_metadata === 'object'
      ? (raw.app_metadata as { permissions?: unknown })
      : null

  return {
    id,
    email: typeof raw.email === 'string' ? raw.email : '',
    permissions: sanitizePermissions(appMetadata?.permissions),
  }
}
