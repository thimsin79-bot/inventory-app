'use client'

import type { Tables, Inserts } from '@/types/database.types'
import { Input, Label, Select, Textarea } from './ui'

export type ItemFormState = {
  barcode: string
  name: string
  brand: string
  model: string
  description: string
  serial_number: string
  category_id: string
  warehouse_id: string
  supplier_id: string
  department_location: string
  unit: string
  cost: string
  price: string
  min_qty: string
  qty: string
  purchase_date: string
  remark: string
  status: string
}

export const EMPTY_ITEM: ItemFormState = {
  barcode: '',
  name: '',
  brand: '',
  model: '',
  description: '',
  serial_number: '',
  category_id: '',
  warehouse_id: '',
  supplier_id: '',
  department_location: '',
  unit: 'Pc',
  cost: '0',
  price: '0',
  min_qty: '0',
  qty: '0',
  purchase_date: '',
  remark: '',
  status: 'Active',
}

/** Hydrate the form from an existing row; numeric and nullable fields become strings. */
export function itemToForm(item: Tables<'items'>): ItemFormState {
  return {
    barcode: item.barcode,
    name: item.name,
    brand: item.brand ?? '',
    model: item.model ?? '',
    description: item.description ?? '',
    serial_number: item.serial_number ?? '',
    category_id: item.category_id ?? '',
    warehouse_id: item.warehouse_id ?? '',
    supplier_id: item.supplier_id ?? '',
    department_location: item.department_location ?? '',
    unit: item.unit,
    cost: String(item.cost),
    price: String(item.price),
    min_qty: String(item.min_qty),
    qty: String(item.qty),
    purchase_date: item.purchase_date ?? '',
    remark: item.remark ?? '',
    status: item.status,
  }
}

/**
 * Validate the form and convert it into a row for `items`.
 * Returns an error message keyed by field, or the payload on success.
 */
export function itemFormToRow(
  form: ItemFormState,
): { errors: Partial<Record<keyof ItemFormState, string>>; row: Inserts<'items'> } {
  const errors: Partial<Record<keyof ItemFormState, string>> = {}

  if (!form.barcode.trim()) errors.barcode = 'Barcode is required'
  if (!form.name.trim()) errors.name = 'Item name is required'
  if (!form.unit.trim()) errors.unit = 'Unit is required'

  const cost = Number(form.cost)
  const price = Number(form.price)
  const minQty = Number(form.min_qty)
  const qty = Number(form.qty)

  if (!Number.isFinite(cost) || cost < 0) errors.cost = 'Must be a positive number'
  if (!Number.isFinite(price) || price < 0) errors.price = 'Must be a positive number'
  if (!Number.isInteger(minQty) || minQty < 0) errors.min_qty = 'Must be a whole number ≥ 0'
  if (!Number.isInteger(qty) || qty < 0) errors.qty = 'Must be a whole number ≥ 0'

  return {
    errors,
    row: {
      barcode: form.barcode.trim(),
      name: form.name.trim(),
      category_id: form.category_id || null,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      description: form.description.trim() || null,
      serial_number: form.serial_number.trim() || null,
      unit: form.unit.trim(),
      cost,
      price,
      min_qty: minQty,
      qty,
      warehouse_id: form.warehouse_id || null,
      supplier_id: form.supplier_id || null,
      department_location: form.department_location.trim() || null,
      purchase_date: form.purchase_date || null,
      remark: form.remark.trim() || null,
      status: form.status,
    },
  }
}

export function ItemFormFields({
  form,
  onChange,
  errors,
  categories,
  warehouses,
  suppliers,
}: {
  form: ItemFormState
  onChange: (next: ItemFormState) => void
  errors: Partial<Record<keyof ItemFormState, string>>
  categories: Pick<Tables<'categories'>, 'id' | 'name'>[]
  warehouses: Pick<Tables<'warehouses'>, 'id' | 'name'>[]
  suppliers: Pick<Tables<'suppliers'>, 'id' | 'company'>[]
}) {
  const set = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) =>
    onChange({ ...form, [key]: value })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Barcode" error={errors.barcode} id="item-barcode">
        <Input id="item-barcode" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="SCH000001" />
      </Field>
      <Field label="Item Name" error={errors.name} id="item-name">
        <Input id="item-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Whiteboard Marker" />
      </Field>
      <Field label="Brand" id="item-brand">
        <Input id="item-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Model" id="item-model">
        <Input id="item-model" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Serial Number" id="item-serial">
        <Input id="item-serial" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Category" id="item-category">
        <Select id="item-category" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
          <option value="">— none —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Supplier" id="item-supplier">
        <Select id="item-supplier" value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">— none —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.company}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Department / Location" id="item-department">
        <Input
          id="item-department"
          value={form.department_location}
          onChange={(e) => set('department_location', e.target.value)}
          placeholder="e.g. Grade 10 Office"
        />
      </Field>
      <Field label="Warehouse" id="item-warehouse">
        <Select id="item-warehouse" value={form.warehouse_id} onChange={(e) => set('warehouse_id', e.target.value)}>
          <option value="">— none —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status" id="item-status">
        <Select id="item-status" value={form.status} onChange={(e) => set('status', e.target.value)}>
          {['Active', 'Low Stock', 'Out of Stock'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quantity" error={errors.qty} id="item-qty">
        <Input id="item-qty" type="number" step="1" min="0" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
      </Field>
      <Field label="Unit" error={errors.unit} id="item-unit">
        <Input id="item-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="Pc" />
      </Field>
      <Field label="Unit Price" error={errors.price} id="item-price">
        <Input id="item-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
      </Field>
      <Field label="Cost" error={errors.cost} id="item-cost">
        <Input id="item-cost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
      </Field>
      <Field label="Min qty" error={errors.min_qty} id="item-min">
        <Input id="item-min" type="number" step="1" min="0" value={form.min_qty} onChange={(e) => set('min_qty', e.target.value)} />
      </Field>
      <Field label="Date of Purchase" id="item-purchase-date">
        <Input
          id="item-purchase-date"
          type="date"
          value={form.purchase_date}
          onChange={(e) => set('purchase_date', e.target.value)}
        />
      </Field>
      <Field label="Description" id="item-description" full>
        <Textarea
          id="item-description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What this item is"
        />
      </Field>
      <Field label="User Remark" id="item-remark" full>
        <Textarea
          id="item-remark"
          value={form.remark}
          onChange={(e) => set('remark', e.target.value)}
          placeholder="Notes from whoever entered or checked this item"
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  error,
  id,
  full,
  children,
}: {
  label: string
  error?: string
  id: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
