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
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, StatusBadge } from '@/components/ui'

type Row = Tables<'purchases'> & { supplier: Tables<'suppliers'> | null }

const STATUSES = ['Pending', 'Partial', 'Received', 'Cancelled'] as const

const EMPTY_PURCHASE = { supplier_id: '', invoice: '', items_count: '1', total: '0.00' }

type ErrorMap = Partial<Record<'supplier_id' | 'items_count' | 'total', string>>

export default function PurchasesPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_PURCHASE)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const loadPurchases = useCallback(() => getPurchases() as Promise<Row[]>, [])

  const state = useAsyncData(loadPurchases)
  const suppliers = useAsyncData(getSuppliers)

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function openCreate() {
    setForm(EMPTY_PURCHASE)
    setFormErrors({})
    setFormError(null)
    setCreating(true)
  }

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
    const errors: ErrorMap = {}
    if (!form.supplier_id) errors.supplier_id = 'Choose a supplier.'
    if (!Number.isInteger(itemsCount) || itemsCount < 0) errors.items_count = 'Whole number ≥ 0.'
    if (!Number.isFinite(total) || total < 0) errors.total = 'Zero or a positive number.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setFormError(null)
    try {
      await createPurchase({
        supplier_id: form.supplier_id,
        invoice: form.invoice.trim() || null,
        items_count: itemsCount,
        total,
      })
      setCreating(false)
      setNotice('Purchase order created')
      state.reload()
    } catch (e) {
      setFormError(errorMessage(e))
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

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Purchase orders raised with suppliers."
        actions={
          <Button variant="primary" onClick={openCreate}>
            New purchase
          </Button>
        }
      />

      {notice && <Notice className="mb-3">{notice}</Notice>}
      {error && <Notice tone="bad" className="mb-3">{error}</Notice>}

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
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier" htmlFor="po-supplier" required error={formErrors.supplier_id}>
            <Select id="po-supplier" value={form.supplier_id} onChange={(e) => set({ supplier_id: e.target.value })}>
              <option value="">— select —</option>
              {(suppliers.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice" htmlFor="po-invoice">
            <Input id="po-invoice" value={form.invoice} onChange={(e) => set({ invoice: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Item count" htmlFor="po-count" required error={formErrors.items_count}>
            <Input id="po-count" type="number" min="0" step="1" value={form.items_count} onChange={(e) => set({ items_count: e.target.value })} />
          </Field>
          <Field label="Total" htmlFor="po-total" required error={formErrors.total}>
            <Input id="po-total" type="number" min="0" step="0.01" value={form.total} onChange={(e) => set({ total: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}