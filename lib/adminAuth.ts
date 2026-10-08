/**
 * Server-side user management: raw SQL against `auth.users` through the
 * Supabase Management API, authenticated with the scoped PAT in
 * `SUPABASE_ACCESS_TOKEN`.
 *
 * Why SQL instead of GoTrue's `/auth/v1/admin/users`: the Management API
 * has no auth-user endpoints, and GoTrue rejects the PAT (401), so the
 * database/query endpoint with the Database Read-write PAT is the only
 * admin credential on this machine (verified 2026-10-07). If the PAT ever
 * expires, the upgrade path is a fresh `sb_secret_` key plus supabase-js
 * `auth.admin.*`.
 *
 * Server-only: route handlers import this; never import from a client
 * component — `SUPABASE_ACCESS_TOKEN` must not reach the browser.
 */

import { sanitizePermissions, type PermissionKey } from '@/lib/permissions'

export type AuthUser = {
  id: string
  email: string
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  banned_until: string | null
  permissions: PermissionKey[]
}

const USER_COLUMNS = `id::text, email, created_at::text, email_confirmed_at::text,
  last_sign_in_at::text, banned_until::text,
  coalesce(raw_app_meta_data->'permissions', '[]'::jsonb) as permissions`

function projectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.')
  const ref = new URL(url).hostname.split('.')[0]
  if (!ref) throw new Error('Could not derive the project ref from NEXT_PUBLIC_SUPABASE_URL.')
  return ref
}

/**
 * Single quotes for SQL string literals. The Management API takes raw SQL
 * text with no bind parameters, so every value passes through here:
 * double any `'`, and reject NUL, which PostgreSQL treats as a literal
 * terminator and which no legitimate email/password should contain.
 */
function lit(value: string): string {
  if (value.includes('\0')) throw new Error('Invalid character in value.')
  return `'${value.replace(/'/g, "''")}'`
}

async function runSql(query: string): Promise<Record<string, unknown>[]> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN is not set — the Admin Console needs a Database Read-write PAT in .env.local (see .env.example).',
    )
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef()}/database/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query }),
    },
  )
  const text = await res.text()
  if (res.status < 200 || res.status >= 300) {
    let message = text
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text
    } catch {
      // keep the raw body
    }
    throw new Error(message)
  }
  try {
    return JSON.parse(text) as Record<string, unknown>[]
  } catch {
    return []
  }
}

function toAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    created_at: String(row.created_at),
    email_confirmed_at: (row.email_confirmed_at as string | null) ?? null,
    last_sign_in_at: (row.last_sign_in_at as string | null) ?? null,
    banned_until: (row.banned_until as string | null) ?? null,
    permissions: sanitizePermissions(row.permissions),
  }
}

export function isDuplicateEmailError(error: unknown): boolean {
  return error instanceof Error && /users_email_key|duplicate key value/i.test(error.message)
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const rows = await runSql(
    `select ${USER_COLUMNS} from auth.users order by created_at desc;`,
  )
  return rows.map(toAuthUser)
}

export async function getAuthUser(id: string): Promise<AuthUser | null> {
  const rows = await runSql(`select ${USER_COLUMNS} from auth.users where id = ${lit(id)};`)
  return rows[0] ? toAuthUser(rows[0]) : null
}

export async function createAuthUser(input: {
  email: string
  password: string
  permissions: PermissionKey[]
}): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase()
  const permissions = lit(JSON.stringify(sanitizePermissions(input.permissions)))
  const rows = await runSql(`
with new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated', ${lit(email)},
    crypt(${lit(input.password)}, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb || jsonb_build_object('permissions', ${permissions}::jsonb),
    now(), now()
  )
  returning id, email
)
insert into auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, 'email', id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       now(), now(), now()
from new_user
returning user_id::text as id;`)
  const id = rows[0]?.id
  if (typeof id !== 'string') throw new Error('User creation returned no id.')
  const created = await getAuthUser(id)
  if (!created) throw new Error('User creation could not be read back.')
  return created
}

/**
 * Applies the given changes in one statement batch (a single implicit
 * transaction — either every statement lands or none do). Returns null
 * when the user does not exist.
 */
export async function updateAuthUser(
  id: string,
  patch: { permissions?: PermissionKey[]; password?: string; banned?: boolean },
): Promise<AuthUser | null> {
  if (patch.permissions === undefined && patch.password === undefined && patch.banned === undefined) {
    throw new Error('Nothing to update.')
  }
  const existing = await getAuthUser(id)
  if (!existing) return null

  const statements: string[] = []
  if (patch.permissions !== undefined) {
    statements.push(
      `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('permissions', ${lit(
        JSON.stringify(sanitizePermissions(patch.permissions)),
      )}::jsonb), updated_at = now() where id = ${lit(id)};`,
    )
  }
  if (patch.password !== undefined) {
    statements.push(
      `update auth.users set encrypted_password = crypt(${lit(
        patch.password,
      )}, gen_salt('bf')), updated_at = now() where id = ${lit(id)};`,
    )
  }
  if (patch.banned !== undefined) {
    statements.push(
      `update auth.users set banned_until = ${
        patch.banned ? "now() + interval '10 years'" : 'null'
      }, updated_at = now() where id = ${lit(id)};`,
    )
  }
  await runSql(statements.join('\n'))
  return getAuthUser(id)
}

/** Returns null when the user does not exist. Identities cascade (FK verified). */
export async function deleteAuthUser(id: string): Promise<boolean> {
  const rows = await runSql(`delete from auth.users where id = ${lit(id)} returning id;`)
  return rows.length > 0
}
