import { NextResponse, type NextRequest } from 'next/server'
import { sessionFromRequest, withSessionCookies } from '@/lib/supabase/session'

const SIGN_IN_PATH = '/sign-in'

export async function middleware(request: NextRequest) {
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

  const onSignInPage = pathname === SIGN_IN_PATH || pathname === SIGN_IN_PATH + '/'
  const onSignUpPage = pathname === '/sign-up' || pathname === '/sign-up/'

  if (!session.user && !onSignInPage && !onSignUpPage) {
    return withSessionCookies(NextResponse.redirect(new URL(SIGN_IN_PATH, request.url)), session)
  }

  if (session.user && (onSignInPage || onSignUpPage)) {
    return withSessionCookies(NextResponse.redirect(new URL('/', request.url)), session)
  }

  return session.response
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
