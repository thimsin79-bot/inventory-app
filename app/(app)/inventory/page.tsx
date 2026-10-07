'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  getInventoryItems,
  createItem,
  updateItem,
  deleteItem,
  recordTransaction,
  getCategories,
  getWarehouses,
  getSuppliers,
  nextBarcode,
} from '@/services/inventoryService'
import type { Tables, Inserts } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Input, PageHeader, StatusBadge, Badge } from '@/components/ui'
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
  const warehouses = useAsyncData(getWarehouses)
  const suppliers = useAsyncData(getSuppliers)

  const categoriesData = categories.data ?? []
  const warehousesData = warehouses.data ?? []
  const suppliersData = suppliers.data ?? []

  const lowStock = useMemo(
    () => (items.data ?? []).filter((i) => i.qty <= i.min_qty),
    [items.data],
  )

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

  async function submitMovement(row: Inserts<'transactions'>, delta: number) {
    if (!moving) return
    const id = moving.id
    const nextQty = moving.qty + delta
    const ok = await run(async () => {
      await recordTransaction(row)
      await updateItem(id, { qty: nextQty })
    }, 'Recorded movement')
    if (ok) setMoving(null)
  }

  const columns: Column<ItemRow>[] = [
    {
      key: 'barcode',
      header: 'Barcode',
      render: (r) => <span className="font-mono text-xs">{r.barcode}</span>,
    },
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span> },
    { key: 'category', header: 'Category', render: (r) => r.category?.name ?? <span className="text-zinc-400">—</span> },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouse?.name ?? <span className="text-zinc-400">—</span> },
    {
      key: 'qty',
      header: 'On hand',
      render: (r) => (
        <span className={r.qty <= r.min_qty ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}>
          {r.qty} {r.unit}
        </span>
      ),
    },
    { key: 'min', header: 'Min', render: (r) => <span className="text-zinc-500">{r.min_qty}</span> },
    { key: 'cost', header: 'Cost', render: (r) => <span className="tabular-nums">{Number(r.cost).toFixed(2)}</span> },
    { key: 'price', header: 'Price', render: (r) => <span className="tabular-nums">{Number(r.price).toFixed(2)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
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

  return (
    <>
      <PageHeader
        title="Inventory"
        description={items.data ? `${items.data.length} items` : undefined}
        actions={
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, barcode, brand…"
              className="w-56"
              aria-label="Search items"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="Filter by category"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">All categories</option>
              {categoriesData.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={openCreate}>
              New item
            </Button>
          </>
        }
      />

      {notice && (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
          {actionError}
        </p>
      )}
      {lowStock.length > 0 && (
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          <Badge tone="warn">{lowStock.length}</Badge> <span className="ml-1">at or below minimum quantity</span>
        </p>
      )}

      <Card>
        <AsyncBoundary loading={items.loading} error={items.error} errorCode={items.errorCode} onRetry={items.reload}>
          <DataTable
            columns={columns}
            rows={items.data ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No items yet" hint="Create your first inventory item, or run supabase/seed.sql for sample data." />}
          />
        </AsyncBoundary>
      </Card>

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
          suppliers={suppliersData}
        />
      </Modal>

      <Modal
        open={moving !== null}
        title="Record stock movement"
        onClose={() => setMoving(null)}
      >
        {moving && (
          <MovementForm
            item={moving}
            warehouses={warehousesData}
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
          {deleting?.barcode})? Past stock transactions referencing it are kept.
        </p>
      </Modal>
    </>
  )
}