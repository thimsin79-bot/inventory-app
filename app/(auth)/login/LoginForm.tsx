'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Input, Label } from '@/components/ui'
import { SubmitButton } from '@/components/SubmitButton'
import { login } from '@/app/actions/auth'
import type { AuthState } from '@/lib/auth'

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(login, {})

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email ?? ''}
          required
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <SubmitButton variant="primary" className="w-full">
        Sign in
      </SubmitButton>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        No account yet?{' '}
        <Link
          href={nextPath === '/' ? '/signup' : `/signup?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          Create one
        </Link>
      </p>
    </form>
  )
}
