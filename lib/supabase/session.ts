import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { readSupabaseEnv } from '@/lib/supabase/env'
import { sessionFromAuth, type SessionUser } from '@/lib/permissions'

export type ProxySession = {
  user: SessionUser | null
  response: NextResponse
}

/**
 * Reads the session for `proxy.ts`. `getClaims()` validates the access token
 * (against the project's cached JWKS, refreshing the session first when it is
 * near expiry) instead of trusting the cookie contents, and a session that no
 * longer verifies — deleted user, revoked refresh token — comes back as no
 * session rather than as a pass.
 *
 * The returned `response` carries whatever cookies the refresh wrote. Copy
 * them onto whatever answer proxy is about to give, or a refreshed session is
 * silently thrown away on that request.
 */
export async function sessionFromRequest(request: NextRequest): Promise<ProxySession> {
  const { url, key } = readSupabaseEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  let data = null
  let error = null
  try {
    const res = await supabase.auth.getClaims()
    data = res.data
    error = res.error
  } catch (err) {
    error = err
  }
  const user = error || !data?.claims ? null : sessionFromAuth(data.claims)

  return { user, response }
}

/** Carries session-refresh cookies onto a redirect or a synthesized response. */
export function withSessionCookies(target: NextResponse, session: ProxySession): NextResponse {
  for (const cookie of session.response.cookies.getAll()) {
    target.cookies.set(cookie)
  }
  return target
}
