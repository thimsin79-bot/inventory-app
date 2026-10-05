'use client'

import { useCallback, useState } from 'react'
import { getPurchases, createPurchase, updatePurchase, getSuppliers } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate, formatMoney } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Input, Label, PageHeader, Select, StatusBadge } from '@/components/ui'
import { usePermissions } from '@/components/Permissions'

type Row = Tables<'purchases'> & { supplier: Tables<'suppliers'> | null }

const STATUSES = ['Pending', 'Partial', 'Received', 'Cancelled'] as const

export default function PurchasesPage() {
  const { writeOperational } = usePermissions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ supplier_id: '', invoice: '', items_count: '1', total: '0.00' })

  const loadPurchases = useCallback(() => getPurchases() as Promise<Row[]>, [])

  const state = useAsyncData(loadPurchases)
  const suppliers = useAsyncData(getSuppliers)

  async function setStatus(row: Row, status: string) {
    setBusy(true)
    setError(null)
    try {
      await updatePurchase(row.id, { status })
      setNotice(`${row.id} → ${status}`)
      state.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    const itemsCount = Number(form.items_count)
    const total = Number(form.total)
    if (!form.supplier_id || !Number.isInteger(itemsCount) || itemsCount < 0 || !Number.isFinite(total) || total < 0) {
      setError('Choose a supplier and enter a valid item count and total.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createPurchase({
        supplier_id: form.supplier_id,
        invoice: form.invoice.trim() || null,
        items_count: itemsCount,
        total,
      })
      setCreating(false)
      setForm({ supplier_id: '', invoice: '', items_count: '1', total: '0.00' })
      setNotice('Purchase order created')
      state.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Row>[] = [
    { key: 'id', header: 'PO', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: 'date', header: 'Date', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier?.company ?? <span className="text-zinc-400">—</span> },
    { key: 'invoice', header: 'Invoice', render: (r) => r.invoice ?? <span className="text-zinc-400">—</span> },
    { key: 'count', header: 'Items', render: (r) => <span className="tabular-nums">{r.items_count}</span> },
    { key: 'total', header: 'Total', render: (r) => <span className="tabular-nums font-medium">{formatMoney(r.total)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  if (writeOperational) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-1">
          {STATUSES.filter((s) => s !== r.status).map((s) => (
            <Button key={s} size="sm" disabled={busy} onClick={() => setStatus(r, s)}>
              {s}
            </Button>
          ))}
        </div>
      ),
    })
  }

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Purchase orders raised with suppliers."
        actions={
          writeOperational ? (
            <Button variant="primary" onClick={() => { setError(null); setCreating(true) }}>
              New purchase
            </Button>
          ) : undefined
        }
      />

      {notice && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

      <Card>
        <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
          <DataTable
            columns={columns}
            rows={state.data ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No purchase orders" hint="Raise one against a supplier to get started." />}
          />
        </AsyncBoundary>
      </Card>

      <Modal
        open={creating}
        title="New purchase order"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Create purchase'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="po-supplier">Supplier</Label>
            <Select id="po-supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">— select —</option>
              {(suppliers.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="po-invoice">Invoice</Label>
            <Input id="po-invoice" value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="po-count">Item count</Label>
            <Input id="po-count" type="number" min="0" step="1" value={form.items_count} onChange={(e) => setForm({ ...form, items_count: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="po-total">Total</Label>
            <Input id="po-total" type="number" min="0" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
          </div>
        </div>
      </Modal>
    </>
  )
}