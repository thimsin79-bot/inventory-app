'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type LinkItem = { href: string; label: string }

const GROUPS: { label: string; links: LinkItem[] }[] = [
  {
    label: 'Main',
    links: [
      { href: '/', label: 'Dashboard' },
      { href: '/inventory', label: 'Inventory' },
      { href: '/purchases', label: 'Purchases' },
      { href: '/transactions', label: 'Transactions' },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/requests', label: 'Requests' },
      { href: '/audits', label: 'Audits' },
      { href: '/maintenance', label: 'Maintenance' },
      { href: '/reports', label: 'Reports' },
    ],
  },
  {
    label: 'Reference',
    links: [
      { href: '/categories', label: 'Categories' },
      { href: '/suppliers', label: 'Suppliers' },
      { href: '/departments', label: 'Departments' },
    ],
  },
]

const SYSTEM_LINKS: LinkItem[] = [
  { href: '/settings', label: 'Settings' },
  { href: '/admin/users', label: 'Admin console' },
]

export function Nav() {
  const pathname = usePathname()

  function linkClass(active: boolean): string {
    return `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
    }`
  }

  function renderLink(link: LinkItem) {
    const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? 'page' : undefined}
        className={linkClass(active)}
      >
        {link.label}
      </Link>
    )
  }

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-visible">
      {GROUPS.map((group, i) => (
        <div key={group.label} className="contents lg:block">
          <p
            className={`hidden px-3 pb-1 text-xs font-medium tracking-wide text-zinc-400 uppercase lg:block dark:text-zinc-500 ${
              i === 0 ? '' : 'pt-4'
            }`}
          >
            {group.label}
          </p>
          {group.links.map(renderLink)}
        </div>
      ))}

      <div className="flex gap-1 lg:mt-auto lg:flex-col lg:gap-0 lg:border-t lg:border-zinc-200 lg:pt-4 lg:dark:border-zinc-800">
        <p className="hidden px-3 pb-1 text-xs font-medium tracking-wide text-zinc-400 uppercase lg:block dark:text-zinc-500">
          System
        </p>
        {SYSTEM_LINKS.map(renderLink)}
      </div>
    </nav>
  )
}