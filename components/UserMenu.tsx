'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

export function UserMenu() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  if (loading || !user) return null

  async function signOut() {
    setSigningOut(true)
    try {
      await createClient().auth.signOut()
    } catch {
      // A failed revoke still leaves the local cookies to clear below, and
      // the proxy refuses anything the cookies no longer vouch for.
    } finally {
      router.replace('/sign-in')
      router.refresh()
      setSigningOut(false)
    }
  }

  return (
    <div className="mt-auto border-t border-zinc-200 px-3 pt-3 dark:border-zinc-800">
      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={user.email}>
        {user.email}
      </p>
      <Button size="sm" className="mt-2 w-full" onClick={signOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  )
}
