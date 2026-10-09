import type { Metadata } from 'next'
import { SignUpForm } from '@/components/SignUpForm'

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create an account to use the Inventory Management System.',
}

export default function SignUpPage() {
  return (
    <main className='flex flex-1 items-center justify-center px-4 py-12'>
      <div className='w-full max-w-sm'>
        <SignUpForm />
      </div>
    </main>
  )
}
