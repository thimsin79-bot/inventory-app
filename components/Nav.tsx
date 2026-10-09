'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import type { PermissionKey } from '@/lib/permissions'

const LINKS: { href: string; label: string; permission: PermissionKey }[] = [
  { href: '/', label: 'Dashboard', permission: 'dashboard.view' },
  { href: '/inventory', label: 'Inventory', permission: 'inventory.view' },
  { href: '/purchases', label: 'Purchases', permission: 'purchases.view' },
  { href: '/transactions', label: 'Transactions', permission: 'transactions.view' },
  { href: '/requests', label: 'Requests', permission: 'requests.view' },
  { href: '/audits', label: 'Audits', permission: 'audits.view' },
  { href: '/categories', label: 'Categories', permission: 'categories.view' },
  { href: '/warehouses', label: 'Warehouses', permission: 'warehouses.view' },
  { href: '/suppliers', label: 'Suppliers', permission: 'suppliers.view' },
  { href: '/departments', label: 'Departments', permission: 'departments.view' },
  { href: '/admin/users', label: 'Users', permission: 'admin.view' },
]

export function Nav() {
  const pathname = usePathname()
  const { can } = useAuth()

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {LINKS.filter((link) => can(link.permission)).map((link) => {
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