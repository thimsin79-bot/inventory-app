import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

const PUBLIC_PATHS = new Set(['/login', '/signup', '/auth/callback', '/api/supabase-test'])

/**
 * Copies cookies set while refreshing the session onto a replacement response,
 * so a redirect does not discard a freshly issued access token.
 */
function redirectWithCookies(source: NextResponse, target: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie)
  }

  return target
}

/**
 * Updates the user's Supabase session cookies on incoming requests and applies
 * the optimistic (cookie-only) route check described in the Next.js auth guide.
 *
 * This is the redirect layer only. The authoritative checks live in
 * lib/supabase/dal.ts for server reads and in the RLS policies for the data.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !/^https?:\/\//.test(supabaseUrl)
  ) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // IMPORTANT: Do not run code between createServerClient and
    // supabase.auth.getUser().
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { pathname, search } = request.nextUrl
    const isPublicPath = PUBLIC_PATHS.has(pathname)

    if (!user && !isPublicPath) {
      const target = new URL('/login', request.url)
      target.searchParams.set('next', `${pathname}${search}`)

      return redirectWithCookies(supabaseResponse, NextResponse.redirect(target))
    }

    if (user && (pathname === '/login' || pathname === '/signup')) {
      return redirectWithCookies(supabaseResponse, NextResponse.redirect(new URL('/', request.url)))
    }
  } catch {
    // Never let bad credentials or a network failure break every request.
    return supabaseResponse
  }

  return supabaseResponse
}

