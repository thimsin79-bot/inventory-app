'use client'

import { useState } from 'react'
import { getMaintenance, createMaintenance, deleteMaintenance } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate, formatMoney, today } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, StatusBadge, Textarea } from '@/components/ui'

type Row = Tables<'maintenance'>

const STATUSES = ['Completed', 'In Progress', 'Scheduled']

const emptyForm = () => ({ item_name: '', date: today(), description: '', cost: '0', status: 'Completed' })

type ErrorMap = Partial<Record<'item_name' | 'date' | 'cost', string>>

export default function MaintenancePage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const state = useAsyncData(getMaintenance)

  const set = (patch: Partial<ReturnType<typeof emptyForm>>) => setForm((f) => ({ ...f, ...patch }))

  function openCreate() {
    setForm(emptyForm())
    setFormErrors({})
    setFormError(null)
    setCreating(true)
  }

  async function submit() {
    const cost = Number(form.cost)
    const errors: ErrorMap = {}
    if (!form.item_name.trim()) errors.item_name = 'Item name is required.'
    if (!form.date) errors.date = 'A service date is required.'
    if (!Number.isFinite(cost) || cost < 0) errors.cost = 'Zero or a positive number.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setFormError(null)
    try {
      await createMaintenance({
        item_name: form.item_name.trim(),
        date: form.date,
        description: form.description.trim() || null,
        cost,
        status: form.status,
      })
      setCreating(false)
      setNotice('Maintenance record added')
      state.reload()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    setError(null)
    try {
      await deleteMaintenance(deleting.id)
      setNotice('Maintenance record deleted')
      setDeleting(null)
      state.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Row>[] = [
    { key: 'id', header: 'Ref', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: 'date', header: 'Date', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    { key: 'item', header: 'Item', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.item_name}</span> },
    { key: 'description', header: 'Description', render: (r) => r.description ?? <span className="text-zinc-400">—</span> },
    { key: 'cost', header: 'Cost', render: (r) => <span className="tabular-nums">{formatMoney(r.cost)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <Button size="sm" variant="danger" onClick={() => { setError(null); setDeleting(r) }}>
          Delete
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Maintenance History"
        description="Servicing and repair log for equipment across the school."
        actions={
          <Button variant="primary" onClick={openCreate}>
            New record
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
            empty={<EmptyState title="No maintenance records" hint="Log servicing and repairs to keep an equipment history." />}
          />
        </AsyncBoundary>
      </Card>

      <Modal
        open={creating}
        title="New maintenance record"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Add record'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Item" htmlFor="mt-item" required error={formErrors.item_name} className="sm:col-span-2">
            <Input id="mt-item" value={form.item_name} onChange={(e) => set({ item_name: e.target.value })} />
          </Field>
          <Field label="Date" htmlFor="mt-date" required error={formErrors.date}>
            <Input id="mt-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Cost" htmlFor="mt-cost" required error={formErrors.cost}>
            <Input id="mt-cost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => set({ cost: e.target.value })} />
          </Field>
          <Field label="Status" htmlFor="mt-status">
            <Select id="mt-status" value={form.status} onChange={(e) => set({ status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="mt-desc" className="sm:col-span-2">
            <Textarea id="mt-desc" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="What was done…" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete maintenance record"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Delete the record for <span className="font-medium text-zinc-900 dark:text-zinc-100">{deleting?.item_name}</span> on{' '}
          {deleting ? formatDate(deleting.date) : ''}? This cannot be undone.
        </p>
      </Modal>
    </>
  )
}