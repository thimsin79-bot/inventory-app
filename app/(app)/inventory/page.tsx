'use client'

import { useCallback, useState } from 'react'
import {
  getInventoryItems,
  createItem,
  updateItem,
  deleteItem,
  getCategories,
  getSuppliers,
  nextBarcode,
  createMaintenance,
} from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { formatDate, today } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Badge, SegmentedStatus, Textarea } from '@/components/ui'
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
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState<ItemRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ItemRow | null>(null)
  const [moving, setMoving] = useState<ItemRow | null>(null)
  const [maintaining, setMaintaining] = useState<ItemRow | null>(null)
  const [form, setForm] = useState<ItemFormState>(EMPTY_ITEM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ItemFormState, string>>>({})
  const [maintainForm, setMaintainForm] = useState({
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
  const [maintainErrors, setMaintainErrors] = useState<Partial<Record<'item_name' | 'date' | 'cost', string>>>({})

  const loadItems = useCallback(
    () => getInventoryItems(undefined, { categoryId, search, purchaseDate }) as Promise<ItemRow[]>,
    [categoryId, search, purchaseDate],
  )

  const items = useAsyncData(loadItems)
  const categories = useAsyncData(getCategories)
  const suppliers = useAsyncData(getSuppliers)

  const categoriesData = categories.data ?? []
  const suppliersData = suppliers.data ?? []

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

  function openMaintain(r: ItemRow) {
    setMaintainForm({
      item_name: r.name,
      brand: r.brand ?? '',
      model: r.model ?? '',
      location: r.location ?? '',
      serial_number: r.serial_number ?? '',
      category: r.category?.name ?? '',
      status: '1st',
      cost: '0',
      purchase_date: r.purchase_date ?? '',
      supplier_name: r.supplier?.company ?? '',
      department_name: r.department_location ?? '',
      date: today(),
      remark: r.remark ?? '',
    })
    setMaintainErrors({})
    setActionError(null)
    setMaintaining(r)
  }

  async function submitMaintenance() {
    if (!maintaining) return
    const cost = Number(maintainForm.cost)
    const errors: Partial<Record<'item_name' | 'date' | 'cost', string>> = {}
    if (!maintainForm.item_name.trim()) errors.item_name = 'Item name is required.'
    if (!maintainForm.date) errors.date = 'A maintenance date is required.'
    if (!Number.isFinite(cost) || cost < 0) errors.cost = 'Zero or a positive number.'
    setMaintainErrors(errors)
    if (Object.keys(errors).length > 0) return

    const trimmed = (v: string) => v.trim() || null

    const ok = await run(
      () =>
        createMaintenance({
          item_name: maintainForm.item_name.trim(),
          brand: trimmed(maintainForm.brand),
          model: trimmed(maintainForm.model),
          location: trimmed(maintainForm.location),
          serial_number: trimmed(maintainForm.serial_number),
          category: trimmed(maintainForm.category),
          status: maintainForm.status,
          cost,
          purchase_date: trimmed(maintainForm.purchase_date),
          supplier_name: trimmed(maintainForm.supplier_name),
          department_name: trimmed(maintainForm.department_name),
          date: maintainForm.date,
          remark: trimmed(maintainForm.remark),
        }),
      `Added maintenance record for ${maintainForm.item_name.trim()}`,
    )

    if (ok) {
      setMaintaining(null)
    }
  }

  const columns: Column<ItemRow>[] = [
    {
      key: 'barcode',
      header: 'Barcode',
      render: (r) => <span className="font-mono text-xs whitespace-nowrap">{r.barcode}</span>,
    },
    {
      key: 'name',
      header: 'Item Name',
      render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span>,
    },
    { key: 'category', header: 'Category', render: (r) => r.category?.name ?? <span className="text-zinc-400">—</span> },
    { key: 'brand', header: 'Brand', render: (r) => r.brand ?? <span className="text-zinc-400">—</span> },
    { key: 'model', header: 'Model', render: (r) => r.model ?? <span className="text-zinc-400">—</span> },
    {
      key: 'description',
      header: 'Description',
      render: (r) =>
        r.description ? (
          <span title={r.description} className="block max-w-56 truncate text-zinc-600 dark:text-zinc-300">
            {r.description}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'stock',
      header: 'Quantity',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className={`tabular-nums font-semibold ${stockTone(r) === 'good' ? 'text-zinc-900 dark:text-zinc-100' : 'text-amber-700 dark:text-amber-400'}`}>
            {r.qty}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{r.unit}</span>
          {stockTone(r) !== 'good' && <Badge tone={stockTone(r)}>{stockLabel(r)}</Badge>}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Unit Price',
      render: (r) => <span className="tabular-nums">{Number(r.price).toFixed(2)}</span>,
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
    {
      key: 'remark',
      header: 'User Remark',
      render: (r) =>
        r.remark ? (
          <span title={r.remark} className="block max-w-56 truncate text-zinc-600 dark:text-zinc-300">
            {r.remark}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
  ]

  columns.push({
    key: 'actions',
    header: '',
    className: 'text-right',
    render: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" onClick={() => openMaintain(r)}>
          Maintain
        </Button>
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
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              aria-label="Filter by purchase date"
              className="w-40"
              title="Filter by date of purchase"
            />
            {purchaseDate && (
              <Button size="sm" variant="secondary" onClick={() => setPurchaseDate('')}>
                Clear date
              </Button>
            )}
            <Button variant="primary" onClick={openCreate}>
              New item
            </Button>
          </>
        }
      />

      {notice && <Notice className="mb-3">{notice}</Notice>}
      {actionError && <Notice tone="bad" className="mb-3">{actionError}</Notice>}

      <AsyncBoundary loading={items.loading} error={items.error} errorCode={items.errorCode} onRetry={items.reload}>
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

      <Modal
        open={maintaining !== null}
        title={`Add to Maintenance — ${maintaining?.name ?? ''}`}
        onClose={() => setMaintaining(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMaintaining(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitMaintenance} disabled={busy}>
              {busy ? 'Saving…' : 'Add to Maintenance'}
            </Button>
          </>
        }
      >
        {actionError && <Notice tone="bad" className="mb-3">{actionError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Item" htmlFor="im-item" required error={maintainErrors.item_name} className="sm:col-span-2">
            <Input
              id="im-item"
              value={maintainForm.item_name}
              onChange={(e) => setMaintainForm((f) => ({ ...f, item_name: e.target.value }))}
            />
          </Field>
          <Field label="Brand" htmlFor="im-brand">
            <Input
              id="im-brand"
              value={maintainForm.brand}
              onChange={(e) => setMaintainForm((f) => ({ ...f, brand: e.target.value }))}
            />
          </Field>
          <Field label="Model" htmlFor="im-model">
            <Input
              id="im-model"
              value={maintainForm.model}
              onChange={(e) => setMaintainForm((f) => ({ ...f, model: e.target.value }))}
            />
          </Field>
          <Field label="Location" htmlFor="im-location">
            <Input
              id="im-location"
              value={maintainForm.location}
              onChange={(e) => setMaintainForm((f) => ({ ...f, location: e.target.value }))}
            />
          </Field>
          <Field label="Serial Number" htmlFor="im-serial">
            <Input
              id="im-serial"
              value={maintainForm.serial_number}
              onChange={(e) => setMaintainForm((f) => ({ ...f, serial_number: e.target.value }))}
            />
          </Field>
          <Field label="Category Maintenance" htmlFor="im-category">
            <Input
              id="im-category"
              value={maintainForm.category}
              onChange={(e) => setMaintainForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Replace battery, toner service…"
            />
          </Field>
          <Field label="Statues" htmlFor="im-status">
            <div id="im-status" className="pt-1">
              <SegmentedStatus
                value={maintainForm.status}
                onChange={(val) => setMaintainForm((f) => ({ ...f, status: val }))}
              />
            </div>
          </Field>
          <Field label="Cost" htmlFor="im-cost" required error={maintainErrors.cost}>
            <Input
              id="im-cost"
              type="number"
              step="0.01"
              min="0"
              value={maintainForm.cost}
              onChange={(e) => setMaintainForm((f) => ({ ...f, cost: e.target.value }))}
            />
          </Field>
          <Field label="Date of Purchase" htmlFor="im-purchase">
            <Input
              id="im-purchase"
              type="date"
              value={maintainForm.purchase_date}
              onChange={(e) => setMaintainForm((f) => ({ ...f, purchase_date: e.target.value }))}
            />
          </Field>
          <Field label="Service Supplier" htmlFor="im-supplier">
            <Input
              id="im-supplier"
              value={maintainForm.supplier_name}
              onChange={(e) => setMaintainForm((f) => ({ ...f, supplier_name: e.target.value }))}
            />
          </Field>
          <Field label="Department" htmlFor="im-department">
            <Input
              id="im-department"
              value={maintainForm.department_name}
              onChange={(e) => setMaintainForm((f) => ({ ...f, department_name: e.target.value }))}
            />
          </Field>
          <Field label="Date Maintenance" htmlFor="im-date" required error={maintainErrors.date}>
            <Input
              id="im-date"
              type="date"
              value={maintainForm.date}
              onChange={(e) => setMaintainForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>
          <Field label="User Remark" htmlFor="im-remark" className="sm:col-span-2">
            <Textarea
              id="im-remark"
              value={maintainForm.remark}
              onChange={(e) => setMaintainForm((f) => ({ ...f, remark: e.target.value }))}
              placeholder="Notes from the user…"
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}