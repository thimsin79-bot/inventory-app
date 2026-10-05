/**
 * Roles and capabilities.
 *
 * Kept free of imports entirely -- no Next.js, no Supabase, and not even a sibling
 * module -- so `npm run check:auth` can load this file directly with Node's type
 * stripping. Anything it needs is passed in as an argument rather than imported.
 *
 * This file is the client-side mirror of the RLS matrix in `supabase/schema.sql`.
 * It is *not* the enforcement point -- RLS is, because every query in this app
 * runs through the browser Supabase client and can be issued by anyone holding a
 * session token. The point of the mirror is to hide buttons that the database
 * would refuse anyway, so a viewer is not shown a form that only ever errors.
 * The two must be kept in step; `check:auth` pins the ladder, and
 * `scripts/check-rls.mjs` diffs the SQL against it.
 *
 * The admin-screen helpers (`mergeRoleInto`, `describeAccount`) live here too.
 * They sit in `app/actions/admin.ts` otherwise, where they can only be reached by
 * a Service Role key -- and that path is unavailable on most local machines, so
 * the merge that guards against clobbering `app_metadata` would go untested.
 */

type RoleSource = {
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
}

/**
 * Highest privilege first. The order is the ladder: each role can do everything
 * the ones below it can, and `admin` adds account management on top.
 */
export const ROLES = ['admin', 'manager', 'staff', 'viewer'] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  viewer: 'Viewer',
}

/** What each role can be trusted with, mirroring the policy matrix in schema.sql. */
export type Capabilities = {
  /** SELECT on all nine tables. */
  read: boolean
  /** INSERT/UPDATE/DELETE on items, purchases, transactions, requests, audits. */
  writeOperational: boolean
  /** INSERT/UPDATE/DELETE on categories, warehouses, suppliers, departments. */
  writeReference: boolean
  /** The /admin/users screen, password resets, and role assignment. */
  manageAccounts: boolean
}

export const CAPABILITIES: Record<Role, Capabilities> = {
  admin: { read: true, writeOperational: true, writeReference: true, manageAccounts: true },
  manager: { read: true, writeOperational: true, writeReference: true, manageAccounts: false },
  staff: { read: true, writeOperational: true, writeReference: false, manageAccounts: false },
  viewer: { read: true, writeOperational: false, writeReference: false, manageAccounts: false },
}

/**
 * Reads the role claim that RLS enforces, which lives in `app_metadata`.
 *
 * `supabase/schema.sql` gates every policy on
 * `auth.jwt() -> 'app_metadata' ->> 'role'`. Only a Service Role key or the
 * dashboard can write `app_metadata`; `user_metadata` is writable by the account
 * holder through `supabase.auth.updateUser`.
 *
 * Reading `user_metadata` here would be a privilege-escalation bug, not a style
 * choice: anyone could set `{"role":"admin"}` on themselves and then pass this
 * check. The test suite pins that down.
 *
 * An unrecognised value returns null rather than the raw string. That is
 * deliberate: a role name that exists in `app_metadata` but not in `ROLES` is
 * either a typo or a role added to the database without updating the app, and
 * in both cases the only safe answer is "no capabilities". Handing the unknown
 * string back would let a future role silently inherit nothing *and* make the
 * UI disagree with the database.
 */
export function roleOf(user: RoleSource): Role | null {
  const role = user.app_metadata?.role

  return typeof role === 'string' && isRole(role) ? role : null
}

/** Narrowing guard for values arriving from a form or from `app_metadata`. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/**
 * Every capability lookup goes through here.
 *
 * The optional lookup is deliberate. `roleOf` already rejects unknown roles, so
 * the record is always present -- but a crash in a capability check surfaces as a
 * 500 and a missing record should surface as "no access". Denying is the answer
 * that is correct either way.
 */
function can(user: RoleSource, capability: keyof Capabilities): boolean {
  const role = roleOf(user)

  return role !== null && CAPABILITIES[role]?.[capability] === true
}

export function isAdmin(user: RoleSource): boolean {
  return roleOf(user) === 'admin'
}

/** Manager or admin. Use for anything below account management. */
export function isManager(user: RoleSource): boolean {
  return roleOf(user) === 'admin' || roleOf(user) === 'manager'
}

/**
 * No role at all -- a self-registered account, or one nobody has granted a role
 * to. Matches no policy in schema.sql, so it sees zero rows. The app treats it
 * the same as `viewer` for read purposes and worse for writes.
 */
export function canRead(user: RoleSource): boolean {
  return can(user, 'read')
}

export function canWriteOperational(user: RoleSource): boolean {
  return can(user, 'writeOperational')
}

export function canWriteReference(user: RoleSource): boolean {
  return can(user, 'writeReference')
}

export function canManageAccounts(user: RoleSource): boolean {
  return can(user, 'manageAccounts')
}

/** Display string for the current user, e.g. `Admin`. `No role` when unset. */
export function roleLabel(user: RoleSource): string {
  const role = roleOf(user)

  return role ? ROLE_LABELS[role] : 'No role'
}

/**
 * Returns a copy of `app_metadata` with `role` set, leaving every other key
 * alone.
 *
 * The admin role form sends this as the whole `app_metadata` object, so replacing
 * rather than merging would silently drop any other claim already on the account
 * -- including ones a future feature adds. Merging server-side is not enough on
 * its own: what the API does with a partial object is a detail of GoTrue, not
 * something this app should depend on, so the merge is done here where it is
 * testable.
 *
 * A null or missing input yields a fresh object rather than mutating the caller's.
 */
export function mergeRoleInto(
  appMetadata: Record<string, unknown> | null | undefined,
  role: Role,
): Record<string, unknown> {
  return { ...(appMetadata ?? {}), role }
}

/** One row of the admin account list. */
export type Account = {
  id: string
  username: string
  role: Role | null
  confirmed: boolean
  isSelf: boolean
}

/** The fields of an auth user this module needs, so tests can supply a fixture. */
export type AccountSource = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
} & RoleSource

/**
 * Projects an auth user into a row for the admin account list.
 *
 * `derivedUsername` is passed in rather than computed here, because turning an
 * address into a username belongs to lib/auth.ts and this module imports nothing.
 * Passing the result instead of a mapper keeps both halves testable: lib/auth's
 * mapping is covered by `check:auth`, and the fallback chain below is covered
 * here.
 *
 * `role` goes through `roleOf`, so an unrecognised claim shows as "No role"
 * rather than being echoed back as though it were real. That matters, because an
 * admin looking at this screen would otherwise have no way to tell a typo'd role
 * from a working one.
 */
export function describeAccount(
  user: AccountSource,
  viewerId: string,
  derivedUsername: string | null,
): Account {
  return {
    id: user.id,
    username: derivedUsername ?? user.email ?? '(unknown)',
    role: roleOf(user),
    confirmed: Boolean(user.email_confirmed_at),
    isSelf: user.id === viewerId,
  }
}

/**
 * Whether `viewerId` is the account named by `targetId`.
 *
 * The role form refuses to change your own role: demoting the last admin is
 * unrecoverable through the app, because `/admin/users` is the only surface that
 * writes the claim and it is the page the lockout removes. Exported so the guard
 * can be tested without a Service Role key.
 */
export function isSelfAccount(targetId: string, viewerId: string): boolean {
  return targetId === viewerId
}