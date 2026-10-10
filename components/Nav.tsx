'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/requests', label: 'Requests' },
  { href: '/audits', label: 'Audits' },
  { href: '/maintenance', label: 'Maintenance' },
  { href: '/categories', label: 'Categories' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/departments', label: 'Departments' },
  { href: '/settings', label: 'Settings' },
  { href: '/admin/users', label: 'Admin console' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}