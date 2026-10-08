import { createHash, timingSafeEqual } from 'node:crypto'

export const ADMIN_SECRET_HEADER = 'x-admin-secret'

export type GateResult = { status: 401 | 503; message: string }

function digest(value: string): Buffer {
  return createHash('sha256').update(value.trim(), 'utf8').digest()
}

/**
 * The Admin Console's only access control: the caller must send
 * `x-admin-secret` matching `ADMIN_CONSOLE_SECRET`. Fails closed — no secret
 * configured means every request is refused, so a deployment that forgets the
 * variable locks the console instead of exposing the Management API.
 *
 * Comparison is timing-safe over equal-length digests, and both sides are
 * trimmed so a value pasted with a stray newline still matches.
 */
export function adminSecretGate(request: Request): GateResult | null {
  const expected = process.env.ADMIN_CONSOLE_SECRET
  if (!expected || !expected.trim()) {
    return {
      status: 503,
      message:
        'ADMIN_CONSOLE_SECRET is not set, so the Admin Console is locked. Set it in Vercel Project Settings → Environment Variables (or .env.local) and redeploy.',
    }
  }

  const provided = request.headers.get(ADMIN_SECRET_HEADER)
  if (!provided) {
    return { status: 401, message: 'Admin console secret required.' }
  }
  if (!timingSafeEqual(digest(provided), digest(expected))) {
    return { status: 401, message: 'Admin console secret is not correct.' }
  }
  return null
}
