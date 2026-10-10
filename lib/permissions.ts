/**
 * The permission catalog the Admin Console can tick for each account.
 *
 * Keys are stored in the account's Supabase Auth `app_metadata.permissions`
 * array. The app currently has no sign-in screen, so nothing reads the list
 * for enforcement — it is recorded here so a future login layer can branch
 * on it without re-inventing the keys. `user_metadata` is never consulted:
 * the user can edit it themselves, so it cannot decide anything.
 *
 * `<screen>.view`   may open the screen.
 * `<screen>.manage` may create, edit and delete within it. The reference
 * screens (categories, suppliers, departments) are read-only in this app,
 * so they have no manage entry. Warehouses is counted as a data screen but
 * has no standalone page.
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
 * keys, in catalog order. Unknown keys are dropped rather than kept: a key
 * this build does not understand must not survive into a future
 * enforcement check.
 */
export function sanitizePermissions(value: unknown): PermissionKey[] {
  const list = Array.isArray(value) ? value : []
  return ALL_PERMISSIONS.filter((key) => list.includes(key))
}