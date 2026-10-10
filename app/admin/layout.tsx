import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * The Admin Console sits outside the (app) sidebar shell on purpose: it is a
 * separate console behind its own shared-secret lock, not one of the daily
 * inventory screens.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="mb-4 text-sm">
        <Link href="/" className="text-sky-700 hover:underline dark:text-sky-400">
          ← Back to the app
        </Link>
      </p>
      {children}
    </main>
  )
}