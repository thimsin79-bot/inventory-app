'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Input, Label } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/utils/errors'

export function SignUpForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setInfo(null)

    try {
      const { error: signUpError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
      })
      if (signUpError) {
        setError(errorMessage(signUpError))
        return
      }
      setInfo('Check your email to confirm your account before signing in.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className='space-y-4 p-6 sm:p-8'>
        <div>
          <h1 className='text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50'>
            Inventory Management
          </h1>
          <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
            Create a new account to get started.
          </p>
        </div>

        <div>
          <Label htmlFor='sign-up-email'>Email</Label>
          <Input
            id='sign-up-email'
            type='email'
            autoComplete='email'
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder='name@example.com'
          />
        </div>

        <div>
          <Label htmlFor='sign-up-password'>Password</Label>
          <Input
            id='sign-up-password'
            type='password'
            autoComplete='new-password'
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='Create a password'
          />
        </div>

        {error && (
          <p
            role='alert'
            className='rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300'
          >
            {error}
          </p>
        )}
        {info && (
          <p
            role='status'
            className='rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300'
          >
            {info}
          </p>
        )}

        <Button type='submit' variant='primary' className='w-full' disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>

        <p className='text-center text-sm text-zinc-500 dark:text-zinc-400'>
          Already have an account?{' '}
          <Link href='/sign-in' className='font-medium text-zinc-900 hover:underline dark:text-zinc-100'>
            Sign in
          </Link>
        </p>
      </form>
    </Card>
  )
}
