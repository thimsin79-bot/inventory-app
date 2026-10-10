'use client'

import { getDepartments } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Card, EmptyState, PageHeader } from '@/components/ui'

type Row = Tables<'departments'>

const columns: Column<Row>[] = [
  { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span> },
  { key: 'head', header: 'Head', render: (r) => r.head ?? <span className="text-zinc-400">—</span> },
]

export default function DepartmentsPage() {
  const state = useAsyncData(getDepartments)

  return (
    <>
      <PageHeader title="Departments" description="Teams that raise requisition requests." />
      <Card>
        <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
          <DataTable
            columns={columns}
            rows={state.data ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No departments" hint="Run supabase/seed.sql to populate reference data." />}
          />
        </AsyncBoundary>
      </Card>
    </>
  )
}