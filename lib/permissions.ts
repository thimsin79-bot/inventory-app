/**
 * The permission catalog the Admin Console ticks for each user.
 *
 * Keys are stored in the user's Supabase Auth `app_metadata.permissions`
 * array. Nothing reads them for enforcement yet — sign-in has not been
 * built (§3) — but GoTrue embeds `app_metadata` in the access token, so
 * when sign-in arrives, enforcement can read the same list from the
 * session with no extra lookup.
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
