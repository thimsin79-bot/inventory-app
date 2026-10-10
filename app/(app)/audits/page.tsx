'use client'

import { useState } from 'react'
import { getAudits, createAudit, getWarehouses } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, StatusBadge } from '@/components/ui'

type Row = Tables<'audits'>

const EMPTY_AUDIT = { warehouse: '', item_name: '', system_qty: '0', physical_qty: '0' }

type ErrorMap = Partial<Record<'warehouse' | 'item_name' | 'system_qty' | 'physical_qty', string>>

export default function AuditsPage() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_AUDIT)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const state = useAsyncData(getAudits)
  const warehouses = useAsyncData(getWarehouses)

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const varianceOf = (r: Row) => r.physical_qty - r.system_qty

  function openCreate() {
    setForm(EMPTY_AUDIT)
    setFormErrors({})
    setFormError(null)
    setCreating(true)
  }

  async function submit() {
    const system = Number(form.system_qty)
    const physical = Number(form.physical_qty)
    const errors: ErrorMap = {}
    if (!form.warehouse) errors.warehouse = 'Choose a warehouse.'
    if (!form.item_name.trim()) errors.item_name = 'Item is required.'
    if (!Number.isInteger(system) || system < 0) errors.system_qty = 'Whole number ≥ 0.'
    if (!Number.isInteger(physical) || physical < 0) errors.physical_qty = 'Whole number ≥ 0.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setFormError(null)
    try {
      await createAudit({
        warehouse: form.warehouse,
        item_name: form.item_name.trim(),
        system_qty: system,
        physical_qty: physical,
      })
      setCreating(false)
      setNotice('Audit recorded')
      state.reload()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Row>[] = [
    { key: 'id', header: 'Ref', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: 'date', header: 'Date', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    { key: 'warehouse', header: 'Warehouse', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.warehouse}</span> },
    { key: 'item', header: 'Item', render: (r) => r.item_name },
    { key: 'system', header: 'System', render: (r) => <span className="tabular-nums">{r.system_qty}</span> },
    { key: 'physical', header: 'Physical', render: (r) => <span className="tabular-nums">{r.physical_qty}</span> },
    {
      key: 'variance',
      header: 'Variance',
      render: (r) => {
        const v = varianceOf(r)
        return (
          <span className={`tabular-nums font-medium ${v === 0 ? 'text-zinc-500' : v < 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {v > 0 ? `+${v}` : v}
          </span>
        )
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Audits"
        description="Physical stock counts compared against system quantity."
        actions={
          <Button variant="primary" onClick={openCreate}>
            New audit
          </Button>
        }
      />

      {notice && <Notice className="mb-3">{notice}</Notice>}

      <Card>
        <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
          <DataTable
            columns={columns}
            rows={state.data ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No audits" hint="Record a stock count to reconcile system quantity." />}
          />
        </AsyncBoundary>
      </Card>

      <Modal
        open={creating}
        title="New stock audit"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Record audit'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Warehouse" htmlFor="au-wh" required error={formErrors.warehouse}>
            <Select id="au-wh" value={form.warehouse} onChange={(e) => set({ warehouse: e.target.value })}>
              <option value="">— select —</option>
              {(warehouses.data ?? []).map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Item" htmlFor="au-item" required error={formErrors.item_name}>
            <Input id="au-item" value={form.item_name} onChange={(e) => set({ item_name: e.target.value })} />
          </Field>
          <Field label="System qty" htmlFor="au-sys" required error={formErrors.system_qty}>
            <Input id="au-sys" type="number" min="0" step="1" value={form.system_qty} onChange={(e) => set({ system_qty: e.target.value })} />
          </Field>
          <Field label="Physical qty" htmlFor="au-phy" required error={formErrors.physical_qty}>
            <Input id="au-phy" type="number" min="0" step="1" value={form.physical_qty} onChange={(e) => set({ physical_qty: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}