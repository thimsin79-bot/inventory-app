'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Input, Label } from '@/components/ui'
import { SubmitButton } from '@/components/SubmitButton'
import { signup } from '@/app/actions/auth'
import {
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  type AuthState,
} from '@/lib/auth'

export function SignupForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signup, {})

  if (state.message) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {state.message}
        </p>
        <Link
          href="/login"
          className="block text-center text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={MIN_USERNAME_LENGTH}
          maxLength={MAX_USERNAME_LENGTH}
          defaultValue={state.username ?? ''}
          required
          autoFocus
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Letters, numbers, dots, dashes, and underscores. This is your sign-in name —
          there is no email address involved.
        </p>
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          At least {MIN_PASSWORD_LENGTH} characters, including a letter and a number.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
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
        Create account
      </SubmitButton>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already registered?{' '}
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}