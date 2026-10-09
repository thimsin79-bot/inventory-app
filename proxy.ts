import { NextResponse, type NextRequest } from 'next/server'
import { sessionFromRequest, withSessionCookies } from '@/lib/supabase/session'

const SIGN_IN_PATH = '/sign-in'

/**
 * The sign-in gate. Pages need a session; API routes get a 403 body instead
 * of a redirect so a fetch failure stays readable in the UI. `getClaims()`
 * verifies the token rather than trusting the cookie, so a revoked or forged
 * session lands on /sign-in instead of on the data.
 *
 * This is a redirect layer, not the security boundary: every check that
 * matters also happens where the data is — RLS for "signed in at all" and
 * `permissionGate` for what the signed-in user may do (CLAUDE.md §3).
 */
export async function proxy(request: NextRequest) {
  const session = await sessionFromRequest(request)
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    if (!session.user) {
      return withSessionCookies(
        NextResponse.json({ error: 'Sign-in required.' }, { status: 403 }),
        session,
      )
    }
    return session.response
  }

  const onSignInPage = pathname === SIGN_IN_PATH || pathname === `${SIGN_IN_PATH}/`

  if (!session.user && !onSignInPage) {
    return withSessionCookies(NextResponse.redirect(new URL(SIGN_IN_PATH, request.url)), session)
  }

  if (session.user && onSignInPage) {
    return withSessionCookies(NextResponse.redirect(new URL('/', request.url)), session)
  }

  return session.response
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
