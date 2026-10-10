'use client'

import { useState, type ReactNode } from 'react'
import { Button } from './ui'
import { usePreferences } from '@/components/PreferencesProvider'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

/**
 * Responsive table with client-side pagination. On `sm` and up the rows render
 * as a real table; below that they stack as label/value cards so no screen ever
 * needs horizontal scrolling. Columns are declared by the caller so each screen
 * controls its own layout without a data-grid dependency. The page size comes
 * from the user's browser preference (Settings → rows per page); the pager only
 * renders when a table overflows it.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  rowClassName,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: ReactNode
  rowClassName?: (row: T) => string
}) {
  const { preferences } = usePreferences()
  const pageSize = preferences.pageSize

  // Reset to the first page when the data or page size changes. This is the
  // render-time adjustment React documents for derived state; an effect that
  // called setState would cascade a second render for nothing.
  const dataKey = `${rows.length}:${pageSize}`
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: dataKey, page: 0 })
  if (pageState.key !== dataKey) {
    setPageState({ key: dataKey, page: 0 })
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(pageState.page, pageCount - 1)
  const start = safePage * pageSize
  const visible = rows.length > pageSize ? rows.slice(start, start + pageSize) : rows

  if (rows.length === 0 && empty) return <>{empty}</>

  return (
    <div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${c.className ?? ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40 ${
                  rowClassName?.(row) ?? ''
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-2.5 align-middle text-zinc-700 dark:text-zinc-300 ${c.className ?? ''}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 sm:hidden">
        {visible.map((row) => (
          <div
            key={rowKey(row)}
            className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${rowClassName?.(row) ?? ''}`}
          >
            <dl>
              {columns.map((c) => (
                <div
                  key={c.key}
                  className="border-b border-zinc-100 py-2 first:pt-0 last:border-0 last:pb-0 dark:border-zinc-800/60"
                >
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {c.header}
                  </dt>
                  <dd className="mt-0.5 text-sm leading-6 text-zinc-900 dark:text-zinc-50">{c.render(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {rows.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span>
            Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPageState((p) => ({ ...p, page: Math.max(0, p.page - 1) }))} disabled={safePage === 0}>
              Previous
            </Button>
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setPageState((p) => ({ ...p, page: Math.min(pageCount - 1, p.page + 1) }))} disabled={safePage >= pageCount - 1}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}