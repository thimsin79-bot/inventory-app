'use client'

import { useState } from 'react'
import { getMaintenance, createMaintenance, deleteMaintenance } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Input, Label, PageHeader, Select, StatusBadge, Textarea } from '@/components/ui'

type Row = Tables<'maintenance'>

const STATUSES = ['Completed', 'In Progress', 'Scheduled']

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function MaintenancePage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [form, setForm] = useState({ item_name: '', date: today(), description: '', cost: '0', status: 'Completed' })

  const state = useAsyncData(getMaintenance)

  function openCreate() {
    setError(null)
    setForm({ item_name: '', date: today(), description: '', cost: '0', status: 'Completed' })
    setCreating(true)
  }

  async function submit() {
    const cost = Number(form.cost)
    if (!form.item_name.trim()) {
      setError('Item name is required.')
      return
    }
    if (!form.date) {
      setError('A service date is required.')
      return
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setError('Cost must be zero or a positive number.')
      return
    }
    setBusy(true)
    setError(null)
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
      setError(errorMessage(e))
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
    { key: 'cost', header: 'Cost', render: (r) => <span className="tabular-nums">{Number(r.cost).toFixed(2)}</span> },
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

      {notice && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="mt-item">Item</Label>
            <Input id="mt-item" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="mt-date">Date</Label>
            <Input id="mt-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="mt-cost">Cost</Label>
            <Input id="mt-cost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="mt-status">Status</Label>
            <Select id="mt-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="mt-desc">Description</Label>
            <Textarea id="mt-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was done…" />
          </div>
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
