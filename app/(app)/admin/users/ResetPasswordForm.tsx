'use client'

import { useActionState } from 'react'
import { Input, Label } from '@/components/ui'
import { SubmitButton } from '@/components/SubmitButton'
import { resetPassword } from '@/app/actions/admin'
import {
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  type AuthState,
} from '@/lib/auth'

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(resetPassword, {})

  if (state.message) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="block w-full text-center text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          Reset another password
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={MIN_USERNAME_LENGTH}
          maxLength={MAX_USERNAME_LENGTH}
          defaultValue={state.username ?? ''}
          required
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="password">New password</Label>
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
        <Label htmlFor="confirmPassword">Confirm new password</Label>
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
        Reset password
      </SubmitButton>
    </form>
  )
}