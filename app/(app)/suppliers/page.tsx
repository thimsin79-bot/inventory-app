'use client'

import { getSuppliers } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Card, EmptyState, PageHeader } from '@/components/ui'

type Row = Tables<'suppliers'>

const columns: Column<Row>[] = [
  { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: 'company', header: 'Company', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.company}</span> },
  { key: 'contact', header: 'Contact', render: (r) => r.contact ?? <span className="text-zinc-400">—</span> },
  { key: 'phone', header: 'Phone', render: (r) => r.phone ?? <span className="text-zinc-400">—</span> },
  {
    key: 'email',
    header: 'Email',
    render: (r) =>
      r.email ? (
        <a href={`mailto:${r.email}`} className="text-sky-700 hover:underline dark:text-sky-400">
          {r.email}
        </a>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  { key: 'address', header: 'Address', render: (r) => r.address ?? <span className="text-zinc-400">—</span> },
]

export default function SuppliersPage() {
  const state = useAsyncData(getSuppliers)

  return (
    <>
      <PageHeader title="Suppliers" description="Vendors referenced by purchase orders." />
      <Card>
        <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
          <DataTable
            columns={columns}
            rows={state.data ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No suppliers" hint="Run supabase/seed.sql to populate reference data." />}
          />
        </AsyncBoundary>
      </Card>
    </>
  )
}