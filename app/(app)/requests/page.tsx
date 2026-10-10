'use client'

import { useState } from 'react'
import { getRequests, getDepartments, updateRequestStatus, createRequest } from '@/services/inventoryService'
import type { Tables, Inserts } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate, today } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, StatusBadge } from '@/components/ui'

type Row = Tables<'requests'>

const NEXT_STATUSES = ['Approved', 'Rejected', 'Issued', 'Returned'] as const

const EMPTY_REQUEST = { dept: '', item_name: '', qty: '1', requested_by: '' }

type ErrorMap = Partial<Record<'dept' | 'item_name' | 'qty' | 'requested_by', string>>

export default function RequestsPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_REQUEST)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const state = useAsyncData(getRequests)
  const departments = useAsyncData(getDepartments)

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function openCreate() {
    setForm(EMPTY_REQUEST)
    setFormErrors({})
    setFormError(null)
    setCreating(true)
  }

  async function setStatus(row: Row, status: string) {
    setBusy(true)
    setError(null)
    try {
      await updateRequestStatus(row.id, status)
      setNotice(`${row.id} → ${status}`)
      state.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    const qty = Number(form.qty)
    const errors: ErrorMap = {}
    if (!form.dept) errors.dept = 'Choose a department.'
    if (!form.item_name.trim()) errors.item_name = 'Item is required.'
    if (!form.requested_by.trim()) errors.requested_by = 'Requester is required.'
    if (!Number.isInteger(qty) || qty <= 0) errors.qty = 'Whole number greater than zero.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setFormError(null)
    try {
      const row: Inserts<'requests'> = {
        dept: form.dept,
        item_name: form.item_name.trim(),
        qty,
        requested_by: form.requested_by.trim(),
      }
      await createRequest(row)
      setCreating(false)
      setNotice('Request created')
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
    { key: 'dept', header: 'Department', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.dept}</span> },
    { key: 'item', header: 'Item', render: (r) => r.item_name },
    { key: 'qty', header: 'Qty', render: (r) => <span className="tabular-nums">{r.qty}</span> },
    { key: 'by', header: 'Requested by', render: (r) => r.requested_by },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  columns.push({
    key: 'actions',
    header: '',
    className: 'text-right',
    render: (r) => (
      <div className="flex flex-wrap justify-end gap-1">
        {NEXT_STATUSES.filter((s) => s !== r.status).map((s) => (
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
        title="Requests"
        description="Requisitions raised by departments."
        actions={
          <Button variant="primary" onClick={openCreate}>
            New request
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
            empty={<EmptyState title="No requests" hint="Create a requisition, or run supabase/seed.sql." />}
          />
        </AsyncBoundary>
      </Card>

      <Modal
        open={creating}
        title="New requisition request"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Create request'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Department" htmlFor="rq-dept" required error={formErrors.dept}>
            <Select id="rq-dept" value={form.dept} onChange={(e) => set({ dept: e.target.value })}>
              <option value="">— select —</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Requested by" htmlFor="rq-by" required error={formErrors.requested_by}>
            <Input id="rq-by" value={form.requested_by} onChange={(e) => set({ requested_by: e.target.value })} />
          </Field>
          <Field label="Item" htmlFor="rq-item" required error={formErrors.item_name}>
            <Input id="rq-item" value={form.item_name} onChange={(e) => set({ item_name: e.target.value })} />
          </Field>
          <Field label="Quantity" htmlFor="rq-qty" required error={formErrors.qty}>
            <Input id="rq-qty" type="number" min="1" step="1" value={form.qty} onChange={(e) => set({ qty: e.target.value })} />
          </Field>
          <p className="text-xs text-zinc-500 sm:col-span-2 dark:text-zinc-400">
            Dated {formatDate(today())} with status Pending.
          </p>
        </div>
      </Modal>
    </>
  )
}