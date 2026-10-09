'use client'

import { useState } from 'react'
import { getRequests, getDepartments, updateRequestStatus, createRequest } from '@/services/inventoryService'
import type { Tables, Inserts } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate, today } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { ScreenGate } from '@/components/ScreenGate'
import { useAuth } from '@/components/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Input, Label, PageHeader, Select, StatusBadge } from '@/components/ui'

type Row = Tables<'requests'>

const NEXT_STATUSES = ['Approved', 'Rejected', 'Issued', 'Returned'] as const

export default function RequestsPage() {
  const { can } = useAuth()
  const manage = can('requests.manage')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ dept: '', item_name: '', qty: '1', requested_by: '' })

  const state = useAsyncData(getRequests)
  const departments = useAsyncData(getDepartments)

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
    if (!form.dept || !form.item_name.trim() || !form.requested_by.trim() || !Number.isInteger(qty) || qty <= 0) {
      setError('Department, item, requester and a positive quantity are all required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const row: Inserts<'requests'> = {
        dept: form.dept,
        item_name: form.item_name.trim(),
        qty,
        requested_by: form.requested_by.trim(),
      }
      await createRequest(row)
      setCreating(false)
      setForm({ dept: '', item_name: '', qty: '1', requested_by: '' })
      setNotice('Request created')
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
    { key: 'dept', header: 'Department', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.dept}</span> },
    { key: 'item', header: 'Item', render: (r) => r.item_name },
    { key: 'qty', header: 'Qty', render: (r) => <span className="tabular-nums">{r.qty}</span> },
    { key: 'by', header: 'Requested by', render: (r) => r.requested_by },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  if (manage) {
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
  }

  return (
    <>
      <PageHeader
        title="Requests"
        description="Requisitions raised by departments."
        actions={
          manage && (
            <Button variant="primary" onClick={() => { setError(null); setCreating(true) }}>
              New request
            </Button>
          )
        }
      />

      {notice && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

      <Card>
        <ScreenGate permission="requests.view">
          <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
            <DataTable
              columns={columns}
              rows={state.data ?? []}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No requests" hint="Create a requisition, or run supabase/seed.sql." />}
            />
          </AsyncBoundary>
        </ScreenGate>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rq-dept">Department</Label>
            <Select id="rq-dept" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
              <option value="">— select —</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rq-by">Requested by</Label>
            <Input id="rq-by" value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="rq-item">Item</Label>
            <Input id="rq-item" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="rq-qty">Quantity</Label>
            <Input id="rq-qty" type="number" min="1" step="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </div>
          <p className="text-xs text-zinc-500 sm:col-span-2">Dated {formatDate(today())} with status Pending.</p>
        </div>
      </Modal>
    </>
  )
}