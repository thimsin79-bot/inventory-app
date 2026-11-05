'use client'

import { useCallback, useState } from 'react'
import {
  getRequests,
  createRequest,
  updateRequestStatus,
  getDepartments,
  getInventoryItems,
  updateItem,
} from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { LowStockTable, type LowStockItem } from '@/components/LowStockTable'
import { Modal } from '@/components/Modal'
import {
  Button,
  Card,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui'

type RequestRow = Tables<'requests'>

const EMPTY_ISSUE = { dept: '', item_id: '', qty: '1', requested_by: '' }

type IssueForm = typeof EMPTY_ISSUE
type ErrorMap = Partial<Record<keyof IssueForm, string>>

export default function StockOutPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const [form, setForm] = useState<IssueForm>(EMPTY_ISSUE)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const loadRequests = useCallback(() => getRequests(), [])
  const loadItems = useCallback(() => getInventoryItems() as Promise<LowStockItem[]>, [])

  const requests = useAsyncData(loadRequests)
  const items = useAsyncData(loadItems)
  const departments = useAsyncData(getDepartments)

  const requestsData = requests.data ?? []
  const itemsData = items.data ?? []
  const departmentsData = departments.data ?? []

  const lowStock = itemsData.filter((i) => i.qty <= i.min_qty).sort((a, b) => a.qty - b.qty)
  const pending = requestsData.filter((r) => r.status === 'Pending').length
  const outOfStock = itemsData.filter((i) => i.qty === 0).length
  const selectedItem = itemsData.find((i) => i.id === form.item_id)

  function openIssue() {
    setForm(EMPTY_ISSUE)
    setFormErrors({})
    setFormError(null)
    setIssueOpen(true)
  }

  async function setStatus(row: RequestRow, status: string) {
    setBusy(true)
    setError(null)
    try {
      await updateRequestStatus(row.id, status)
      setNotice(`${row.id} → ${status}`)
      requests.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function issueRequest(row: RequestRow) {
    const item = itemsData.find((i) => i.name.trim().toLowerCase() === row.item_name.trim().toLowerCase())
    if (!item) {
      setError(`No inventory item named "${row.item_name}". Add it in Inventory first.`)
      return
    }
    if (row.qty > item.qty) {
      setError(`Only ${item.qty} ${item.unit} of ${item.name} in stock.`)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await updateItem(item.id, { qty: item.qty - row.qty })
      await updateRequestStatus(row.id, 'Issued')
      setNotice(`Issued ${row.qty} ${item.unit} of ${item.name}`)
      requests.reload()
      items.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitIssue() {
    const qty = Number(form.qty)
    const errors: ErrorMap = {}
    if (!form.dept) errors.dept = 'Choose a department.'
    if (!selectedItem) errors.item_id = 'Choose an item.'
    if (!form.requested_by.trim()) errors.requested_by = 'Requester is required.'
    if (!Number.isInteger(qty) || qty <= 0) {
      errors.qty = 'Whole number greater than zero.'
    } else if (selectedItem && qty > selectedItem.qty) {
      errors.qty = `Only ${selectedItem.qty} ${selectedItem.unit} in stock.`
    }
    setFormErrors(errors)
    if (Object.keys(errors).length > 0 || !selectedItem) return

    setBusy(true)
    setFormError(null)
    try {
      await updateItem(selectedItem.id, { qty: selectedItem.qty - qty })
      await createRequest({
        dept: form.dept,
        item_name: selectedItem.name,
        qty,
        requested_by: form.requested_by.trim(),
        status: 'Issued',
      })
      setIssueOpen(false)
      setNotice(`Issued ${qty} ${selectedItem.unit} of ${selectedItem.name} to ${form.dept}`)
      requests.reload()
      items.reload()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<RequestRow>[] = [
    { key: 'id', header: 'Ref', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: 'date', header: 'Date', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    {
      key: 'dept',
      header: 'Department',
      render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.dept}</span>,
    },
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
        {r.status === 'Pending' && (
          <>
            <Button size="sm" disabled={busy} onClick={() => setStatus(r, 'Approved')}>
              Approve
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setStatus(r, 'Rejected')}>
              Reject
            </Button>
          </>
        )}
        {r.status === 'Approved' && (
          <Button size="sm" disabled={busy} onClick={() => issueRequest(r)}>
            Issue
          </Button>
        )}
      </div>
    ),
  })

  const tiles = [
    { label: 'Requests', value: requestsData.length.toLocaleString() },
    { label: 'Pending approval', value: pending.toLocaleString(), tone: pending > 0 ? 'warn' : 'good' },
    { label: 'Low stock alerts', value: lowStock.length.toLocaleString(), tone: lowStock.length > 0 ? 'warn' : 'good' },
    { label: 'Out of stock', value: outOfStock.toLocaleString(), tone: outOfStock > 0 ? 'bad' : 'good' },
  ] as const

  return (
    <>
      <PageHeader
        title="Stock Out"
        description="Issue inventory to departments and track low stock."
        actions={
          <Button variant="primary" onClick={openIssue}>
            Stock out
          </Button>
        }
      />

      {notice && <Notice className="mb-3">{notice}</Notice>}
      {error && <Notice tone="bad" className="mb-3">{error}</Notice>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t.label}</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                'tone' in t && t.tone === 'warn'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'tone' in t && t.tone === 'bad'
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-zinc-900 dark:text-zinc-50'
              }`}
            >
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Department requests</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Approve a pending request, then issue it to reduce stock. New stock-out records are issued immediately.
          </p>
        </div>
        <AsyncBoundary loading={requests.loading} error={requests.error} errorCode={requests.errorCode} onRetry={requests.reload}>
          <DataTable
            columns={columns}
            rows={requestsData}
            rowKey={(r) => r.id}
            empty={<div className="px-4 py-10 text-center text-sm text-zinc-500">No requests yet.</div>}
          />
        </AsyncBoundary>
      </Card>

      <Card>
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Low stock alerts</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Items at or below their minimum stock level, with supplier and minimum level.
          </p>
        </div>
        <AsyncBoundary loading={items.loading} error={items.error} errorCode={items.errorCode} onRetry={items.reload}>
          <LowStockTable items={lowStock} />
        </AsyncBoundary>
      </Card>

      <Modal
        open={issueOpen}
        title="Stock out"
        onClose={() => setIssueOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIssueOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitIssue} disabled={busy}>
              {busy ? 'Saving…' : 'Issue stock'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Department" htmlFor="so-dept" required error={formErrors.dept}>
            <Select
              id="so-dept"
              value={form.dept}
              onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))}
            >
              <option value="">— select —</option>
              {departmentsData.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Requested by" htmlFor="so-by" required error={formErrors.requested_by}>
            <Input
              id="so-by"
              value={form.requested_by}
              onChange={(e) => setForm((f) => ({ ...f, requested_by: e.target.value }))}
            />
          </Field>

          <Field
            label="Item"
            htmlFor="so-item"
            required
            error={formErrors.item_id}
            hint={selectedItem ? `Available: ${selectedItem.qty} ${selectedItem.unit} · Min level: ${selectedItem.min_qty}` : undefined}
            className="sm:col-span-2"
          >
            <Select
              id="so-item"
              value={form.item_id}
              onChange={(e) => setForm((f) => ({ ...f, item_id: e.target.value }))}
            >
              <option value="">— select —</option>
              {itemsData.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.barcode}) · {i.qty} {i.unit}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quantity" htmlFor="so-qty" required error={formErrors.qty}>
            <Input
              id="so-qty"
              type="number"
              min="1"
              step="1"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
