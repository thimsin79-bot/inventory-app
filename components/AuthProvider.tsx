'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sessionFromAuth, type PermissionKey, type SessionUser } from '@/lib/permissions'

type AuthValue = {
  loading: boolean
  user: SessionUser | null
  can: (permission: PermissionKey) => boolean
}

const AuthContext = createContext<AuthValue>({
  loading: true,
  user: null,
  can: () => false,
})

/**
 * One Supabase client and one auth listener for the whole app shell, so the
 * session is read from the cookie once per mount instead of once per
 * component. `can` fails closed — no session, no permissions, and nothing at
 * all while the initial read is still in flight.
 *
 * The permissions come from `app_metadata` inside the session, so an
 * administrator's change reaches this user on their next token refresh or
 * next sign-in, not instantly.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? sessionFromAuth(session.user) : null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const value: AuthValue = {
    loading,
    user,
    can: (permission) => user !== null && user.permissions.includes(permission),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  return useContext(AuthContext)
}
