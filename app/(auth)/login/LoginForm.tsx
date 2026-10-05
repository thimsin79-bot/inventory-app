'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Input, Label } from '@/components/ui'
import { SubmitButton } from '@/components/SubmitButton'
import { login, resendConfirmation } from '@/app/actions/auth'
import type { AuthState } from '@/lib/auth'

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(login, {})
  const [resendState, resendAction] = useActionState<AuthState, FormData>(
    resendConfirmation,
    {},
  )

  const resendEmail = resendState.email ?? state.email ?? ''
  const showResend = state.needsConfirmation === true || resendState.email !== undefined

  return (
    <div className="space-y-4">
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
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
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
          Sign in
        </SubmitButton>
      </form>

      {showResend && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Confirmation links can expire or land in spam.
          </p>

          <form action={resendAction} className="mt-3 space-y-3">
            <input type="hidden" name="next" value={nextPath} />
            <input type="hidden" name="email" value={resendEmail} />

            <SubmitButton variant="secondary" className="w-full">
              Resend confirmation email
            </SubmitButton>
          </form>

          {resendState.error && (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
              {resendState.error}
            </p>
          )}

          {resendState.message && (
            <p role="status" className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
              {resendState.message}
            </p>
          )}
        </div>
      )}

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        No account yet?{' '}
        <Link
          href={nextPath === '/' ? '/signup' : `/signup?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          Create one
        </Link>
      </p>
    </div>
  )
}
