import { NextResponse } from 'next/server'
import { deleteAuthUser, updateAuthUser } from '@/lib/adminAuth'
import { adminSecretGate } from '@/lib/adminGate'
import type { PermissionKey } from '@/lib/permissions'
import { errorMessage } from '@/utils/errors'

type RouteContext = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request: Request, context: RouteContext) {
  const gate = adminSecretGate(request)
  if (gate) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const { id } = await context.params
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Invalid user id.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const { permissions, password, banned } = body as {
    permissions?: unknown
    password?: unknown
    banned?: unknown
  }

  const patch: { permissions?: PermissionKey[]; password?: string; banned?: boolean } = {}
  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Permissions must be an array.' }, { status: 400 })
    }
    patch.permissions = permissions as PermissionKey[]
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 256 characters.' },
        { status: 400 },
      )
    }
    patch.password = password
  }
  if (banned !== undefined) {
    if (typeof banned !== 'boolean') {
      return NextResponse.json({ error: 'Banned must be a boolean.' }, { status: 400 })
    }
    patch.banned = banned
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  try {
    const user = await updateAuthUser(id, patch)
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    return NextResponse.json({ user })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const gate = adminSecretGate(request)
  if (gate) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const { id } = await context.params
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Invalid user id.' }, { status: 400 })
  }
  try {
    const deleted = await deleteAuthUser(id)
    if (!deleted) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 })
  }
}
