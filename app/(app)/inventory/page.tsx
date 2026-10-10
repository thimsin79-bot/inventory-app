'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  getInventoryItems,
  createItem,
  updateItem,
  deleteItem,
  getCategories,
  getSuppliers,
  nextBarcode,
} from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Input, Notice, PageHeader, Select, Badge } from '@/components/ui'
import {
  EMPTY_ITEM,
  ItemFormFields,
  itemFormToRow,
  itemToForm,
  type ItemFormState,
} from '@/components/ItemFormFields'
import { MovementForm } from '@/components/MovementForm'

type ItemRow = Tables<'items'> & {
  category: Tables<'categories'> | null
  warehouse: Tables<'warehouses'> | null
  supplier: Tables<'suppliers'> | null
}

function stockTone(r: Pick<ItemRow, 'qty' | 'min_qty'>): 'good' | 'warn' | 'bad' {
  if (r.qty === 0) return 'bad'
  if (r.qty <= r.min_qty) return 'warn'
  return 'good'
}

function stockLabel(r: Pick<ItemRow, 'qty' | 'min_qty'>): string {
  if (r.qty === 0) return 'Out'
  if (r.qty <= r.min_qty) return 'Low'
  return 'In stock'
}

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState<ItemRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ItemRow | null>(null)
  const [moving, setMoving] = useState<ItemRow | null>(null)
  const [form, setForm] = useState<ItemFormState>(EMPTY_ITEM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ItemFormState, string>>>({})

  const loadItems = useCallback(
    () => getInventoryItems(undefined, { categoryId, search }) as Promise<ItemRow[]>,
    [categoryId, search],
  )

  const items = useAsyncData(loadItems)
  const categories = useAsyncData(getCategories)
  const suppliers = useAsyncData(getSuppliers)

  const categoriesData = categories.data ?? []
  const suppliersData = suppliers.data ?? []

  const stats = useMemo(() => {
    const rows = items.data ?? []
    let units = 0
    let value = 0
    let lowStock = 0
    for (const i of rows) {
      units += i.qty
      value += i.qty * Number(i.price)
      if (i.qty <= i.min_qty) lowStock++
    }
    return { totalItems: rows.length, units, value, lowStock }
  }, [items.data])

  const run = useCallback(
    async (fn: () => Promise<unknown>, success: string) => {
      setBusy(true)
      setActionError(null)
      try {
        await fn()
        setNotice(success)
        items.reload()
        return true
      } catch (e) {
        setActionError(errorMessage(e))
        return false
      } finally {
        setBusy(false)
      }
    },
    [items],
  )

  function openCreate() {
    setForm(EMPTY_ITEM)
    setFormErrors({})
    setActionError(null)
    setCreating(true)
  }

  function openEdit(row: ItemRow) {
    setForm(itemToForm(row))
    setFormErrors({})
    setActionError(null)
    setEditing(row)
  }

  async function submitItem() {
    const { errors, row } = itemFormToRow(form)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    const ok = editing
      ? await run(() => updateItem(editing.id, row), `Updated ${row.name}`)
      : await run(async () => createItem({ ...row, barcode: await nextBarcode() }), `Created ${row.name}`)

    if (ok) {
      setEditing(null)
      setCreating(false)
    }
  }

  async function submitMovement(delta: number) {
    if (!moving) return
    const ok = await run(() => updateItem(moving.id, { qty: moving.qty + delta }), 'Quantity adjusted')
    if (ok) setMoving(null)
  }

  const columns: Column<ItemRow>[] = [
    {
      key: 'barcode',
      header: 'Barcode',
      render: (r) => <span className="font-mono text-xs">{r.barcode}</span>,
    },
    {
      key: 'name',
      header: 'Item Name',
      render: (r) => (
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {r.name}
          {(r.brand || r.model) && (
            <span className="ml-1.5 font-normal text-zinc-400">
              · {r.brand}
              {r.model && `${r.brand ? ' ' : ''}${r.model}`}
            </span>
          )}
        </span>
      ),
    },
    { key: 'category', header: 'Category', render: (r) => r.category?.name ?? <span className="text-zinc-400">—</span> },
    {
      key: 'stock',
      header: 'Stock',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className={`tabular-nums font-semibold ${stockTone(r) === 'good' ? 'text-zinc-900 dark:text-zinc-100' : 'text-amber-700 dark:text-amber-400'}`}>
            {r.qty}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{r.unit}</span>
          <Badge tone={stockTone(r)}>{stockLabel(r)}</Badge>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Unit Price',
      render: (r) => <span className="tabular-nums">{Number(r.price).toFixed(2)}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      render: (r) => <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{(r.qty * Number(r.price)).toFixed(2)}</span>,
    },
    {
      key: 'serial',
      header: 'Serial No.',
      render: (r) =>
        r.serial_number ? <span className="font-mono text-xs">{r.serial_number}</span> : <span className="text-zinc-400">—</span>,
    },
    {
      key: 'purchase_date',
      header: 'Date of Purchase',
      render: (r) => (r.purchase_date ? formatDate(r.purchase_date) : <span className="text-zinc-400">—</span>),
    },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier?.company ?? <span className="text-zinc-400">—</span> },
    {
      key: 'dept',
      header: 'Department',
      render: (r) => r.department_location ?? <span className="text-zinc-400">—</span>,
    },
    {
      key: 'location',
      header: 'Location',
      render: (r) => r.location ?? <span className="text-zinc-400">—</span>,
    },
  ]

  columns.push({
    key: 'actions',
    header: '',
    className: 'text-right',
    render: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" onClick={() => setMoving(r)}>
          Move
        </Button>
        <Button size="sm" onClick={() => openEdit(r)}>
          Edit
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDeleting(r)}>
          Delete
        </Button>
      </div>
    ),
  })

  const tiles = [
    { label: 'Items tracked', value: stats.totalItems.toLocaleString() },
    { label: 'Units on hand', value: stats.units.toLocaleString() },
    { label: 'Stock value', value: stats.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { label: 'At or below min', value: stats.lowStock.toLocaleString(), tone: stats.lowStock > 0 ? 'warn' : 'good' },
  ] as const

  return (
    <>
      <PageHeader
        title="Inventory"
        description={items.data ? `${items.data.length} items across the catalog` : undefined}
        actions={
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, barcode, brand…"
              className="w-64"
              aria-label="Search items"
            />
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="Filter by category"
              className="w-44"
            >
              <option value="all">All categories</option>
              {categoriesData.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={openCreate}>
              New item
            </Button>
          </>
        }
      />

      {notice && <Notice className="mb-3">{notice}</Notice>}
      {actionError && <Notice tone="bad" className="mb-3">{actionError}</Notice>}

      <AsyncBoundary loading={items.loading} error={items.error} errorCode={items.errorCode} onRetry={items.reload}>
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label} className="px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t.label}</p>
              <p
                className={`mt-1 text-2xl font-semibold tabular-nums ${
                  'tone' in t && t.tone === 'warn'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-zinc-900 dark:text-zinc-50'
                }`}
              >
                {t.value}
              </p>
            </Card>
          ))}
        </div>

        <Card>
          <DataTable
            columns={columns}
            rows={items.data ?? []}
            rowKey={(r) => r.id}
            rowClassName={(r) => (r.qty <= r.min_qty ? 'bg-amber-50/50 dark:bg-amber-950/20' : '')}
            empty={
              <EmptyState
                title="No items yet"
                hint="Create your first inventory item, or run supabase/seed.sql for sample data."
              />
            }
          />
        </Card>
      </AsyncBoundary>

      <Modal
        open={creating || editing !== null}
        title={editing ? `Edit ${editing.name}` : 'New inventory item'}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={submitItem} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create item'}
            </Button>
          </>
        }
      >
        <ItemFormFields
          form={form}
          onChange={setForm}
          errors={formErrors}
          categories={categoriesData}
          suppliers={suppliersData}
        />
      </Modal>

      <Modal
        open={moving !== null}
        title="Adjust quantity"
        onClose={() => setMoving(null)}
      >
        {moving && (
          <MovementForm
            item={moving}
            busy={busy}
            onCancel={() => setMoving(null)}
            onSubmit={submitMovement}
          />
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete item"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (!deleting) return
                const ok = await run(() => deleteItem(deleting.id), `Deleted ${deleting.name}`)
                if (ok) setDeleting(null)
              }}
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Delete <span className="font-medium text-zinc-900 dark:text-zinc-100">{deleting?.name}</span> (
          {deleting?.barcode})? This cannot be undone.
        </p>
      </Modal>
    </>
  )
}