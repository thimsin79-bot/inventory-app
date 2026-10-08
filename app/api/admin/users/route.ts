import { NextResponse } from 'next/server'
import {
  createAuthUser,
  isDuplicateEmailError,
  listAuthUsers,
} from '@/lib/adminAuth'
import { adminSecretGate } from '@/lib/adminGate'
import type { PermissionKey } from '@/lib/permissions'
import { errorMessage } from '@/utils/errors'

export async function GET(request: Request) {
  const gate = adminSecretGate(request)
  if (gate) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    return NextResponse.json({ users: await listAuthUsers() })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const gate = adminSecretGate(request)
  if (gate) return NextResponse.json({ error: gate.message }, { status: gate.status })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { email, password, permissions } = body as {
    email?: unknown
    password?: unknown
    permissions?: unknown
  }
  if (
    typeof email !== 'string' ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return NextResponse.json(
      { error: 'Password must be between 8 and 256 characters.' },
      { status: 400 },
    )
  }

  try {
    const user = await createAuthUser({
      email,
      password,
      permissions: (permissions ?? []) as PermissionKey[],
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (e) {
    if (isDuplicateEmailError(e)) {
      return NextResponse.json(
        { error: 'That email is already registered.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 })
  }
}
