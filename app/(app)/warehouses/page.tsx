'use client'

import { getWarehouses } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { ScreenGate } from '@/components/ScreenGate'
import { DataTable, type Column } from '@/components/DataTable'
import { Card, EmptyState, PageHeader } from '@/components/ui'

type Row = Tables<'warehouses'>

const columns: Column<Row>[] = [
  { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span> },
  { key: 'location', header: 'Location', render: (r) => r.location ?? <span className="text-zinc-400">—</span> },
  { key: 'manager', header: 'Manager', render: (r) => r.manager ?? <span className="text-zinc-400">—</span> },
  { key: 'capacity', header: 'Capacity', render: (r) => <span className="tabular-nums">{r.capacity ?? '—'}</span> },
]

export default function WarehousesPage() {
  const state = useAsyncData(getWarehouses)

  return (
    <>
      <PageHeader title="Warehouses" description="Stock locations items are assigned to." />
      <Card>
        <ScreenGate permission="warehouses.view">
          <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
            <DataTable
              columns={columns}
              rows={state.data ?? []}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No warehouses" hint="Run supabase/seed.sql to populate reference data." />}
            />
          </AsyncBoundary>
        </ScreenGate>
      </Card>
    </>
  )
}