import type { Metadata } from 'next'
import { SignInForm } from '@/components/SignInForm'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the Inventory Management System.',
}

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <SignInForm />
      </div>
    </main>
  )
}
