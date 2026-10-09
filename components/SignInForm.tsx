'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Input, Label } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/utils/errors'

export function SignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError(errorMessage(signInError))
        return
      }
      router.replace('/')
      router.refresh()
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
            Sign in with your account to continue.
          </p>
        </div>

        <div>
          <Label htmlFor='sign-in-email'>Email</Label>
          <Input
            id='sign-in-email'
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
          <Label htmlFor='sign-in-password'>Password</Label>
          <Input
            id='sign-in-password'
            type='password'
            autoComplete='current-password'
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='Your password'
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

        <Button type='submit' variant='primary' className='w-full' disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className='text-center text-sm text-zinc-500 dark:text-zinc-400'>
          Don’t have an account??{' '}
          <Link href='/sign-up' className='font-medium text-zinc-900 hover:underline dark:text-zinc-100'>
            Create one
          </Link>
        </p>
      </form>
    </Card>
  )
}
