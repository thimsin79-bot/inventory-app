'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { getInventoryItems, getRequests, getTransactions } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { formatDate, formatMoney } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'

type ItemRow = Tables<'items'>
type TxnRow = Tables<'transactions'>
type RequestRow = Tables<'requests'>

export default function DashboardPage() {
  const loadOverview = useCallback(async () => {
    const [items, requests, transactions] = await Promise.all([
      getInventoryItems() as Promise<ItemRow[]>,
      getRequests(),
      getTransactions(undefined, 8),
    ])
    return { items, requests, transactions }
  }, [])

  const state = useAsyncData(loadOverview)

  const stats = useMemo(() => {
    const items = state.data?.items ?? []
    const requests = state.data?.requests ?? []
    let units = 0
    let costValue = 0
    let retailValue = 0
    let lowStock = 0
    for (const i of items) {
      units += i.qty
      costValue += i.qty * Number(i.cost)
      retailValue += i.qty * Number(i.price)
      if (i.qty <= i.min_qty) lowStock++
    }
    return {
      totalItems: items.length,
      units,
      costValue,
      retailValue,
      lowStock,
      pendingRequests: requests.filter((r) => r.status === 'Pending').length,
    }
  }, [state.data])

  const lowStockItems = useMemo(
    () => (state.data?.items ?? []).filter((i) => i.qty <= i.min_qty).slice(0, 8),
    [state.data],
  )

  const txnColumns: Column<TxnRow>[] = [
    { key: 'date', header: 'Date', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    { key: 'item', header: 'Item', render: (r) => r.item_name },
    { key: 'type', header: 'Type', render: (r) => <StatusBadge status={r.type} /> },
    { key: 'qty', header: 'Qty', render: (r) => <span className="tabular-nums">{r.qty}</span> },
    { key: 'ref', header: 'Reference', render: (r) => r.ref ?? <span className="text-zinc-400">—</span> },
  ]

  const lowColumns: Column<ItemRow>[] = [
    { key: 'barcode', header: 'Barcode', render: (r) => <span className="font-mono text-xs">{r.barcode}</span> },
    { key: 'name', header: 'Item', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span> },
    { key: 'qty', header: 'On hand', render: (r) => <span className="tabular-nums font-semibold text-amber-700 dark:text-amber-400">{r.qty}</span> },
    { key: 'min', header: 'Min', render: (r) => <span className="tabular-nums text-zinc-500">{r.min_qty}</span> },
    { key: 'unit', header: 'Unit', render: (r) => r.unit },
  ]

  const tiles = [
    { label: 'Items tracked', value: stats.totalItems.toLocaleString() },
    { label: 'Units on hand', value: stats.units.toLocaleString() },
    { label: 'Stock value (cost)', value: formatMoney(stats.costValue) },
    { label: 'Retail value', value: formatMoney(stats.retailValue) },
    { label: 'At or below min', value: stats.lowStock.toLocaleString(), tone: stats.lowStock > 0 ? 'warn' : 'good' },
    { label: 'Pending requests', value: stats.pendingRequests.toLocaleString(), tone: stats.pendingRequests > 0 ? 'info' : 'good' },
  ] as const

  return (
    <>
      <PageHeader title="Dashboard" description="Inventory position across all warehouses." />

      <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {tiles.map((t) => (
              <Card key={t.label} className="px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t.label}</p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    'tone' in t && t.tone === 'warn'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-zinc-900 dark:text-zinc-50'
                  }`}
                >
                  {t.value}
                </p>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Needs restocking</h2>
                <Link href="/inventory" className="text-xs text-sky-700 hover:underline dark:text-sky-400">
                  View inventory
                </Link>
              </div>
              <DataTable
                columns={lowColumns}
                rows={lowStockItems}
                rowKey={(r) => r.id}
                empty={<EmptyState title="Stock levels healthy" hint="No item is at or below its minimum quantity." />}
              />
            </Card>

            <Card>
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent stock movements</h2>
                <Link href="/transactions" className="text-xs text-sky-700 hover:underline dark:text-sky-400">
                  All transactions
                </Link>
              </div>
              <DataTable
                columns={txnColumns}
                rows={state.data?.transactions ?? []}
                rowKey={(r) => r.id}
                empty={<EmptyState title="No movements yet" hint="Record one from the Inventory screen." />}
              />
            </Card>
          </div>

          {state.data && state.data.requests.filter((r) => r.status === 'Pending').length > 0 && (
            <Card className="mt-6 px-4 py-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {state.data.requests.filter((r: RequestRow) => r.status === 'Pending').length} request(s)
                </span>{' '}
                awaiting approval.{' '}
                <Link href="/requests" className="text-sky-700 hover:underline dark:text-sky-400">
                  Review requests
                </Link>
              </p>
            </Card>
          )}
          </AsyncBoundary>
    </>
  )
}
