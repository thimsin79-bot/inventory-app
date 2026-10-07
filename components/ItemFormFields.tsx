'use client'

import type { Tables, Inserts } from '@/types/database.types'
import { Input, Label, Select, Textarea } from './ui'

export type ItemFormState = {
  name: string
  brand: string
  model: string
  description: string
  serial_number: string
  qty: string
  price: string
  purchase_date: string
  supplier_id: string
  department_location: string
  remark: string
}

export const EMPTY_ITEM: ItemFormState = {
  name: '',
  brand: '',
  model: '',
  description: '',
  serial_number: '',
  qty: '0',
  price: '0',
  purchase_date: '',
  supplier_id: '',
  department_location: '',
  remark: '',
}

/** Hydrate the form from an existing row; numeric and nullable fields become strings. */
export function itemToForm(item: Tables<'items'>): ItemFormState {
  return {
    name: item.name,
    brand: item.brand ?? '',
    model: item.model ?? '',
    description: item.description ?? '',
    serial_number: item.serial_number ?? '',
    qty: String(item.qty),
    price: String(item.price),
    purchase_date: item.purchase_date ?? '',
    supplier_id: item.supplier_id ?? '',
    department_location: item.department_location ?? '',
    remark: item.remark ?? '',
  }
}

/**
 * Validate the form and convert it into a row for `items`.
 * Returns an error message keyed by field, or the payload on success.
 *
 * The row carries no barcode: the form does not ask for one, so the create
 * path fills it in from `nextBarcode()`. Columns the form does not manage
 * (unit, cost, min_qty, status, category, warehouse) are left out too and take
 * their column defaults on insert, or their existing value on update.
 */
export function itemFormToRow(
  form: ItemFormState,
): { errors: Partial<Record<keyof ItemFormState, string>>; row: Omit<Inserts<'items'>, 'barcode'> } {
  const errors: Partial<Record<keyof ItemFormState, string>> = {}

  if (!form.name.trim()) errors.name = 'Item name is required'

  const qty = Number(form.qty)
  const price = Number(form.price)

  if (!Number.isInteger(qty) || qty < 0) errors.qty = 'Must be a whole number ≥ 0'
  if (!Number.isFinite(price) || price < 0) errors.price = 'Must be a positive number'

  return {
    errors,
    row: {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      description: form.description.trim() || null,
      serial_number: form.serial_number.trim() || null,
      qty,
      price,
      purchase_date: form.purchase_date || null,
      supplier_id: form.supplier_id || null,
      department_location: form.department_location.trim() || null,
      remark: form.remark.trim() || null,
    },
  }
}

export function ItemFormFields({
  form,
  onChange,
  errors,
  suppliers,
}: {
  form: ItemFormState
  onChange: (next: ItemFormState) => void
  errors: Partial<Record<keyof ItemFormState, string>>
  suppliers: Pick<Tables<'suppliers'>, 'id' | 'company'>[]
}) {
  const set = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) =>
    onChange({ ...form, [key]: value })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Item Name" error={errors.name} id="item-name">
        <Input id="item-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Whiteboard Marker" />
      </Field>
      <Field label="Brand" id="item-brand">
        <Input id="item-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Model" id="item-model">
        <Input id="item-model" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Description" id="item-description">
        <Textarea
          id="item-description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What this item is"
        />
      </Field>
      <Field label="Serial Number" id="item-serial">
        <Input id="item-serial" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Quantity" error={errors.qty} id="item-qty">
        <Input id="item-qty" type="number" step="1" min="0" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
      </Field>
      <Field label="Unit Price" error={errors.price} id="item-price">
        <Input id="item-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
      </Field>
      <Field label="Date of Purchase" id="item-purchase-date">
        <Input
          id="item-purchase-date"
          type="date"
          value={form.purchase_date}
          onChange={(e) => set('purchase_date', e.target.value)}
        />
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
