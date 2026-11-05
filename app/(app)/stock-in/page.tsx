'use client'

import { useCallback, useState } from 'react'
import {
  getPurchases,
  createPurchase,
  updatePurchase,
  getInventoryItems,
  updateItem,
  getSuppliers,
} from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate, formatMoney } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { LowStockTable, type LowStockItem } from '@/components/LowStockTable'
import { Modal } from '@/components/Modal'
import { Button, Card, Field, Input, Notice, PageHeader, Select } from '@/components/ui'

type PurchaseRow = Tables<'purchases'> & { supplier: Tables<'suppliers'> | null }

const EMPTY_RECEIVE = {
  purchase_id: '',
  supplier_id: '',
  item_id: '',
  qty: '1',
  min_qty: '',
  invoice: '',
  total: '0.00',
}

type ReceiveForm = typeof EMPTY_RECEIVE
type ErrorMap = Partial<Record<keyof ReceiveForm, string>>

const RECEIVABLE = ['Pending', 'Partial']

export default function StockInPage() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [sourcePurchase, setSourcePurchase] = useState<PurchaseRow | null>(null)
  const [form, setForm] = useState<ReceiveForm>(EMPTY_RECEIVE)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const loadPurchases = useCallback(() => getPurchases() as Promise<PurchaseRow[]>, [])
  const loadItems = useCallback(() => getInventoryItems() as Promise<LowStockItem[]>, [])

  const purchases = useAsyncData(loadPurchases)
  const items = useAsyncData(loadItems)
  const suppliers = useAsyncData(getSuppliers)

  const purchasesData = purchases.data ?? []
  const itemsData = items.data ?? []
  const suppliersData = suppliers.data ?? []

  const lowStock = itemsData.filter((i) => i.qty <= i.min_qty).sort((a, b) => a.qty - b.qty)
  const awaiting = purchasesData.filter((p) => RECEIVABLE.includes(p.status)).length
  const outOfStock = itemsData.filter((i) => i.qty === 0).length
  const selectedItem = itemsData.find((i) => i.id === form.item_id)

  function openReceive(row?: PurchaseRow) {
    setSourcePurchase(row ?? null)
    setForm({
      purchase_id: row?.id ?? '',
      supplier_id: row?.supplier_id ?? '',
      item_id: '',
      qty: '1',
      min_qty: '',
      invoice: row?.invoice ?? '',
      total: row ? String(row.total) : '0.00',
    })
    setFormErrors({})
    setFormError(null)
    setReceiveOpen(true)
  }

  function choosePurchase(id: string) {
    const purchase = purchasesData.find((p) => p.id === id)
    if (!purchase) {
      setForm((f) => ({ ...f, purchase_id: '' }))
      return
    }
    setForm((f) => ({
      ...f,
      purchase_id: purchase.id,
      supplier_id: purchase.supplier_id ?? f.supplier_id,
      invoice: purchase.invoice ?? '',
      total: String(purchase.total),
    }))
  }

  function chooseItem(id: string) {
    const item = itemsData.find((i) => i.id === id)
    setForm((f) => ({ ...f, item_id: id, min_qty: item ? String(item.min_qty) : f.min_qty }))
  }

  async function submitReceive() {
    const qty = Number(form.qty)
    const min = form.min_qty === '' ? null : Number(form.min_qty)
    const total = Number(form.total)
    const item = itemsData.find((i) => i.id === form.item_id)

    const errors: ErrorMap = {}
    if (!form.supplier_id) errors.supplier_id = 'Choose a supplier.'
    if (!item) errors.item_id = 'Choose an item.'
    if (!Number.isInteger(qty) || qty <= 0) errors.qty = 'Whole number greater than zero.'
    if (min !== null && (!Number.isInteger(min) || min < 0)) errors.min_qty = 'Whole number zero or more.'
    if (!form.purchase_id && (!Number.isFinite(total) || total < 0)) errors.total = 'Zero or a positive number.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0 || !item) return

    setBusy(true)
    setFormError(null)
    try {
      if (form.purchase_id) {
        await updatePurchase(form.purchase_id, { status: 'Received' })
      } else {
        await createPurchase({
          supplier_id: form.supplier_id,
          invoice: form.invoice.trim() || null,
          items_count: 1,
          total,
          status: 'Received',
        })
      }
      await updateItem(item.id, { qty: item.qty + qty, min_qty: min ?? item.min_qty })
      setReceiveOpen(false)
      setNotice(`Received ${qty} ${item.unit} of ${item.name}`)
      purchases.reload()
      items.reload()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const purchaseColumns: Column<PurchaseRow>[] = [
    { key: 'id', header: 'PO', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: 'date', header: 'Date', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier?.company ?? <span className="text-zinc-400">—</span> },
    { key: 'invoice', header: 'Invoice', render: (r) => r.invoice ?? <span className="text-zinc-400">—</span> },
    { key: 'items', header: 'Items', render: (r) => <span className="tabular-nums">{r.items_count}</span> },
    { key: 'total', header: 'Total', render: (r) => <span className="tabular-nums font-medium">{formatMoney(r.total)}</span> },
    { key: 'status', header: 'Status', render: (r) => r.status },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) =>
        RECEIVABLE.includes(r.status) ? (
          <Button size="sm" disabled={busy} onClick={() => openReceive(r)}>
            Receive
          </Button>
        ) : null,
    },
  ]

  const tiles = [
    { label: 'Purchase orders', value: purchasesData.length.toLocaleString() },
    { label: 'Awaiting receipt', value: awaiting.toLocaleString(), tone: awaiting > 0 ? 'warn' : 'good' },
    { label: 'Low stock alerts', value: lowStock.length.toLocaleString(), tone: lowStock.length > 0 ? 'warn' : 'good' },
    { label: 'Out of stock', value: outOfStock.toLocaleString(), tone: outOfStock > 0 ? 'bad' : 'good' },
  ] as const

  const receivable = purchasesData.filter(
    (p) => RECEIVABLE.includes(p.status) || p.id === form.purchase_id,
  )

  return (
    <>
      <PageHeader
        title="Stock In"
        description="Receive purchase orders from suppliers into inventory."
        actions={
          <Button variant="primary" onClick={() => openReceive()}>
            Receive stock
          </Button>
        }
      />

      {notice && <Notice className="mb-3">{notice}</Notice>}

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
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Purchase orders</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Receive an order to add its quantity to stock. A new receipt also creates a purchase record.
          </p>
        </div>
        <AsyncBoundary loading={purchases.loading} error={purchases.error} errorCode={purchases.errorCode} onRetry={purchases.reload}>
          <DataTable
            columns={purchaseColumns}
            rows={purchasesData}
            rowKey={(r) => r.id}
            empty={<div className="px-4 py-10 text-center text-sm text-zinc-500">No purchase orders yet.</div>}
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
        open={receiveOpen}
        title={sourcePurchase ? `Receive ${sourcePurchase.id}` : 'Receive stock'}
        onClose={() => setReceiveOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiveOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitReceive} disabled={busy}>
              {busy ? 'Saving…' : 'Receive stock'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Purchase order" htmlFor="si-po" hint="Optional — leave blank to create a new received purchase." className="sm:col-span-2">
            <Select id="si-po" value={form.purchase_id} onChange={(e) => choosePurchase(e.target.value)}>
              <option value="">— no purchase order —</option>
              {receivable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.supplier?.company ?? 'No supplier'}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Supplier" htmlFor="si-supplier" required error={formErrors.supplier_id}>
            <Select
              id="si-supplier"
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            >
              <option value="">— select —</option>
              {suppliersData.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Item"
            htmlFor="si-item"
            required
            error={formErrors.item_id}
            hint={selectedItem ? `On hand: ${selectedItem.qty} ${selectedItem.unit} · Min level: ${selectedItem.min_qty}` : undefined}
          >
            <Select id="si-item" value={form.item_id} onChange={(e) => chooseItem(e.target.value)}>
              <option value="">— select —</option>
              {itemsData.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.barcode})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quantity" htmlFor="si-qty" required error={formErrors.qty}>
            <Input
              id="si-qty"
              type="number"
              min="1"
              step="1"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
          </Field>

          <Field
            label="Minimum stock level"
            htmlFor="si-min"
            error={formErrors.min_qty}
            hint="Low-stock alerts trigger at or below this level."
          >
            <Input
              id="si-min"
              type="number"
              min="0"
              step="1"
              value={form.min_qty}
              onChange={(e) => setForm((f) => ({ ...f, min_qty: e.target.value }))}
            />
          </Field>

          {!form.purchase_id && (
            <>
              <Field label="Invoice" htmlFor="si-invoice">
                <Input
                  id="si-invoice"
                  value={form.invoice}
                  onChange={(e) => setForm((f) => ({ ...f, invoice: e.target.value }))}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Total" htmlFor="si-total" required error={formErrors.total}>
                <Input
                  id="si-total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.total}
                  onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
                />
              </Field>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
