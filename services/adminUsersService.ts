import type { PermissionKey } from '@/lib/permissions'

export type AdminUser = {
  id: string
  email: string
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  banned_until: string | null
  permissions: PermissionKey[]
}

export const ADMIN_SECRET_HEADER = 'x-admin-secret'

const STORAGE_KEY = 'admin-console-secret'

export class AdminSecretError extends Error {
  code = 'ADMIN_SECRET'
}

function readAdminSecret(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeAdminSecret(value: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, value.trim())
  } catch {
    // storage unavailable — the next request simply goes out unauthenticated
  }
}

export function clearAdminSecret(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clear
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const secret = readAdminSecret()
  if (secret) headers.set(ADMIN_SECRET_HEADER, secret)

  const res = await fetch(path, { ...init, headers })
  let body: { error?: string } = {}
  try {
    body = (await res.json()) as { error?: string }
  } catch {
    // empty body — fall through to the status-based message
  }
  if (res.status === 401) {
    clearAdminSecret()
    throw new AdminSecretError(body.error ?? 'Admin console secret required.')
  }
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status}).`)
  }
  return body as T
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const body = await request<{ users: AdminUser[] }>('/api/admin/users')
  return body.users
}

export async function createAdminUser(input: {
  email: string
  password: string
  permissions: PermissionKey[]
}): Promise<AdminUser> {
  const body = await request<{ user: AdminUser }>('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return body.user
}

export async function updateAdminUser(
  id: string,
  patch: { permissions?: PermissionKey[]; password?: string; banned?: boolean },
): Promise<AdminUser> {
  const body = await request<{ user: AdminUser }>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return body.user
}

export async function deleteAdminUser(id: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' })
}
