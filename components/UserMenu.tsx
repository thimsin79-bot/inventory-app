import { signOut } from '@/app/actions/auth'
import { SubmitButton } from '@/components/SubmitButton'
import { displayName, getUser } from '@/lib/supabase/dal'

/**
 * Shell footer for the signed-in user.
 *
 * Rendered inside a <Suspense> boundary in the app layout so the session read
 * does not hold back the first chunk of the page.
 */
export async function UserMenu() {
  const user = await getUser()

  if (!user) {
    return null
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-2 border-t border-zinc-200 px-3 pt-3 dark:border-zinc-800">
      <p className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400" title={user.email ?? undefined}>
        {displayName(user)}
      </p>
      <form action={signOut}>
        <SubmitButton size="sm">Sign out</SubmitButton>
      </form>
    </div>
  )
}
