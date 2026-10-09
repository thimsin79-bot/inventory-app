'use client'

import { useState } from 'react'
import { getAudits, createAudit, getWarehouses } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { ScreenGate } from '@/components/ScreenGate'
import { useAuth } from '@/components/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Input, Label, PageHeader, Select, StatusBadge } from '@/components/ui'

type Row = Tables<'audits'>

export default function AuditsPage() {
  const { can } = useAuth()
  const manage = can('audits.manage')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ warehouse: '', item_name: '', system_qty: '0', physical_qty: '0' })

  const state = useAsyncData(getAudits)
  const warehouses = useAsyncData(getWarehouses)

  const varianceOf = (r: Row) => r.physical_qty - r.system_qty

  async function submit() {
    const system = Number(form.system_qty)
    const physical = Number(form.physical_qty)
    if (!form.warehouse || !form.item_name.trim() || !Number.isInteger(system) || !Number.isInteger(physical)) {
      setError('Warehouse, item and whole-number quantities are all required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createAudit({
        warehouse: form.warehouse,
        item_name: form.item_name.trim(),
        system_qty: system,
        physical_qty: physical,
      })
      setCreating(false)
      setForm({ warehouse: '', item_name: '', system_qty: '0', physical_qty: '0' })
      setNotice('Audit recorded')
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
          manage && (
            <Button variant="primary" onClick={() => { setError(null); setCreating(true) }}>
              New audit
            </Button>
          )
        }
      />

      {notice && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

      <Card>
        <ScreenGate permission="audits.view">
          <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
            <DataTable
              columns={columns}
              rows={state.data ?? []}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No audits" hint="Record a stock count to reconcile system quantity." />}
            />
          </AsyncBoundary>
        </ScreenGate>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="au-wh">Warehouse</Label>
            <Select id="au-wh" value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })}>
              <option value="">— select —</option>
              {(warehouses.data ?? []).map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="au-item">Item</Label>
            <Input id="au-item" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="au-sys">System qty</Label>
            <Input id="au-sys" type="number" step="1" value={form.system_qty} onChange={(e) => setForm({ ...form, system_qty: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="au-phy">Physical qty</Label>
            <Input id="au-phy" type="number" step="1" value={form.physical_qty} onChange={(e) => setForm({ ...form, physical_qty: e.target.value })} />
          </div>
        </div>
      </Modal>
    </>
  )
}