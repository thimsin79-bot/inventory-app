'use client'

import { useState } from 'react'
import { getMaintenance, createMaintenance, updateMaintenance, deleteMaintenance } from '@/services/inventoryService'
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

const emptyForm = () => ({
  item_name: '',
  brand: '',
  model: '',
  location: '',
  serial_number: '',
  category: '',
  status: 'Completed',
  cost: '0',
  purchase_date: '',
  supplier_name: '',
  department_name: '',
  date: today(),
  remark: '',
})

type Form = ReturnType<typeof emptyForm>
type ErrorMap = Partial<Record<'item_name' | 'date' | 'cost', string>>

const trimmed = (value: string) => value.trim() || null

export default function MaintenancePage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const state = useAsyncData(getMaintenance)

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  function openCreate() {
    setForm(emptyForm())
    setFormErrors({})
    setFormError(null)
    setCreating(true)
  }

  function openEdit(row: Row) {
    setForm({
      item_name: row.item_name,
      brand: row.brand ?? '',
      model: row.model ?? '',
      location: row.location ?? '',
      serial_number: row.serial_number ?? '',
      category: row.category ?? '',
      status: row.status,
      cost: String(row.cost),
      purchase_date: row.purchase_date ?? '',
      supplier_name: row.supplier_name ?? '',
      department_name: row.department_name ?? '',
      date: row.date,
      remark: row.remark ?? '',
    })
    setFormErrors({})
    setFormError(null)
    setEditing(row)
  }

  async function submit() {
    const cost = Number(form.cost)
    const errors: ErrorMap = {}
    if (!form.item_name.trim()) errors.item_name = 'Item name is required.'
    if (!form.date) errors.date = 'A maintenance date is required.'
    if (!Number.isFinite(cost) || cost < 0) errors.cost = 'Zero or a positive number.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setFormError(null)
    try {
      const payload = {
        item_name: form.item_name.trim(),
        brand: trimmed(form.brand),
        model: trimmed(form.model),
        location: trimmed(form.location),
        serial_number: trimmed(form.serial_number),
        category: trimmed(form.category),
        status: form.status,
        cost,
        purchase_date: trimmed(form.purchase_date),
        supplier_name: trimmed(form.supplier_name),
        department_name: trimmed(form.department_name),
        date: form.date,
        remark: trimmed(form.remark),
      }

      if (editing) {
        await updateMaintenance(editing.id, payload)
        setEditing(null)
        setNotice('Maintenance record updated')
      } else {
        await createMaintenance(payload)
        setCreating(false)
        setNotice('Maintenance record added')
      }
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
    { key: 'item', header: 'Item', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.item_name}</span> },
    { key: 'brand', header: 'Brand', render: (r) => r.brand ?? <span className="text-zinc-400">—</span> },
    { key: 'model', header: 'Model', render: (r) => r.model ?? <span className="text-zinc-400">—</span> },
    { key: 'location', header: 'Location', render: (r) => r.location ?? <span className="text-zinc-400">—</span> },
    { key: 'serial_number', header: 'Serial Number', render: (r) => <span className="font-mono text-xs">{r.serial_number ?? <span className="font-sans text-zinc-400">—</span>}</span> },
    { key: 'category', header: 'Category Maintenance', render: (r) => r.category ?? <span className="text-zinc-400">—</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'cost', header: 'Cost', render: (r) => <span className="tabular-nums">{formatMoney(r.cost)}</span> },
    { key: 'purchase_date', header: 'Date of Purchase', render: (r) => <span className="tabular-nums">{formatDate(r.purchase_date)}</span> },
    { key: 'supplier_name', header: 'Service Supplier', render: (r) => r.supplier_name ?? <span className="text-zinc-400">—</span> },
    { key: 'department_name', header: 'Department', render: (r) => r.department_name ?? <span className="text-zinc-400">—</span> },
    { key: 'date', header: 'Date Maintenance', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    { key: 'remark', header: 'User Remark', render: (r) => r.remark ?? <span className="text-zinc-400">—</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => { setError(null); openEdit(r) }}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => { setError(null); setDeleting(r) }}>
            Delete
          </Button>
        </div>
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
        open={creating || editing !== null}
        title={editing ? `Edit ${editing.item_name}` : 'New maintenance record'}
        onClose={() => { setCreating(false); setEditing(null) }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null) }} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update' : 'Add record'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Item" htmlFor="mt-item" required error={formErrors.item_name} className="sm:col-span-2">
            <Input id="mt-item" value={form.item_name} onChange={(e) => set({ item_name: e.target.value })} />
          </Field>
          <Field label="Brand" htmlFor="mt-brand">
            <Input id="mt-brand" value={form.brand} onChange={(e) => set({ brand: e.target.value })} />
          </Field>
          <Field label="Model" htmlFor="mt-model">
            <Input id="mt-model" value={form.model} onChange={(e) => set({ model: e.target.value })} />
          </Field>
          <Field label="Location" htmlFor="mt-location">
            <Input id="mt-location" value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label="Serial Number" htmlFor="mt-serial">
            <Input id="mt-serial" value={form.serial_number} onChange={(e) => set({ serial_number: e.target.value })} />
          </Field>
          <Field label="Category Maintenance" htmlFor="mt-category">
            <Input id="mt-category" value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="Replace battery, toner service…" />
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
          <Field label="Cost" htmlFor="mt-cost" required error={formErrors.cost}>
            <Input id="mt-cost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => set({ cost: e.target.value })} />
          </Field>
          <Field label="Date of Purchase" htmlFor="mt-purchase">
            <Input id="mt-purchase" type="date" value={form.purchase_date} onChange={(e) => set({ purchase_date: e.target.value })} />
          </Field>
          <Field label="Service Supplier" htmlFor="mt-supplier">
            <Input id="mt-supplier" value={form.supplier_name} onChange={(e) => set({ supplier_name: e.target.value })} />
          </Field>
          <Field label="Department" htmlFor="mt-department">
            <Input id="mt-department" value={form.department_name} onChange={(e) => set({ department_name: e.target.value })} />
          </Field>
          <Field label="Date Maintenance" htmlFor="mt-date" required error={formErrors.date}>
            <Input id="mt-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="User Remark" htmlFor="mt-remark" className="sm:col-span-2">
            <Textarea id="mt-remark" value={form.remark} onChange={(e) => set({ remark: e.target.value })} placeholder="Notes from the user…" />
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
