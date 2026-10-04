import { redirect } from 'next/navigation'
import { Card } from '@/components/ui'
import { safeNextPath } from '@/lib/auth'
import { getUser } from '@/lib/supabase/dal'
import { SignupForm } from './SignupForm'

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getUser()

  if (user) {
    redirect('/')
  }

  const { next } = await searchParams

  return (
    <Card className="w-full max-w-sm p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Create account
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Sign up to manage stock, purchases, requisitions and audits.
        </p>
      </div>

      <SignupForm nextPath={safeNextPath(next)} />
    </Card>
  )
}
