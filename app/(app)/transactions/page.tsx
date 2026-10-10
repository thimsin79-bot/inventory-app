'use client'

import { useMemo, useState } from 'react'
import { getTransactions } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { formatDate } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Badge, Card, EmptyState, PageHeader, Select, StatusBadge } from '@/components/ui'
import { MOVEMENT_TYPES } from '@/components/MovementForm'

type Row = Tables<'transactions'>

export default function TransactionsPage() {
  const [type, setType] = useState('all')
  const state = useAsyncData(getTransactions)

  const rows = useMemo(() => {
    const all = state.data ?? []
    return type === 'all' ? all : all.filter((t) => t.type === type)
  }, [state.data, type])

  const columns: Column<Row>[] = [
    { key: 'id', header: 'Ref', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: 'date', header: 'Date', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    { key: 'item', header: 'Item', render: (r) => (
      <div>
        <div className="font-medium text-zinc-900 dark:text-zinc-100">{r.item_name}</div>
        <div className="font-mono text-xs text-zinc-500">{r.item_barcode}</div>
      </div>
    ) },
    { key: 'type', header: 'Type', render: (r) => <StatusBadge status={r.type} /> },
    {
      key: 'qty',
      header: 'Qty',
      render: (r) => (
        <span className={`tabular-nums ${r.qty < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>{r.qty}</span>
      ),
    },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouse ?? <span className="text-zinc-400">—</span> },
    { key: 'ref', header: 'Reference', render: (r) => r.ref ?? <span className="text-zinc-400">—</span> },
    { key: 'remark', header: 'Remark', render: (r) => r.remark ?? <span className="text-zinc-400">—</span> },
  ]

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Stock movements recorded from the inventory screen."
        actions={
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by movement type" className="w-44">
            <option value="all">All types</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        }
      />
      <Card>
        <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
          {rows.length === 0 ? (
            <EmptyState title="No transactions" hint="Record a stock movement from the Inventory screen." />
          ) : (
            <>
              <div className="border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Showing {rows.length} of {(state.data ?? []).length}{' '}
                <Badge tone="info">most recent 50</Badge>
              </div>
              <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
            </>
          )}
        </AsyncBoundary>
      </Card>
    </>
  )
}