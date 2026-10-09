'use client'

import { getCategories } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { ScreenGate } from '@/components/ScreenGate'
import { DataTable, type Column } from '@/components/DataTable'
import { Card, EmptyState, PageHeader } from '@/components/ui'

type Row = Tables<'categories'>

const columns: Column<Row>[] = [
  { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span> },
  { key: 'description', header: 'Description', render: (r) => r.description ?? <span className="text-zinc-400">—</span> },
]

export default function CategoriesPage() {
  const state = useAsyncData(getCategories)

  return (
    <>
      <PageHeader
        title="Categories"
        description="Reference data used to classify inventory items."
      />
      <Card>
        <ScreenGate permission="categories.view">
          <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
            <DataTable
              columns={columns}
              rows={state.data ?? []}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No categories" hint="Run supabase/seed.sql to populate reference data." />}
            />
          </AsyncBoundary>
        </ScreenGate>
      </Card>
    </>
  )
}