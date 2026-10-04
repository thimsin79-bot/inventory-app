import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui'
import { safeNextPath } from '@/lib/auth'
import { getUser } from '@/lib/supabase/dal'
import { LoginForm } from './LoginForm'

type SearchParams = { next?: string; error?: string }

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getUser()

  if (user) {
    redirect('/')
  }

  const params = await searchParams
  const nextPath = safeNextPath(params.next)
  const linkExpired = params.error === 'confirmation'

  return (
    <Card className="w-full max-w-sm p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Inventory Management requires an account.
        </p>
      </div>

      {linkExpired && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          That confirmation link is invalid or has expired.
        </p>
      )}

      <LoginForm nextPath={nextPath} />

      <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Trouble signing in?{' '}
        <Link href="/signup" className="underline underline-offset-4 hover:text-zinc-600 dark:hover:text-zinc-300">
          Create a new account
        </Link>
      </p>
    </Card>
  )
}
