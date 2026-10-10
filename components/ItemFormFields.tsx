'use client'

import type { Tables, Inserts } from '@/types/database.types'
import { Field, Input, Select, Textarea } from './ui'

export type ItemFormState = {
  name: string
  category_id: string
  brand: string
  model: string
  description: string
  serial_number: string
  qty: string
  price: string
  purchase_date: string
  supplier_id: string
  department_location: string
  location: string
  remark: string
}

export const EMPTY_ITEM: ItemFormState = {
  name: '',
  category_id: '',
  brand: '',
  model: '',
  description: '',
  serial_number: '',
  qty: '0',
  price: '0',
  purchase_date: '',
  supplier_id: '',
  department_location: '',
  location: '',
  remark: '',
}

/** Hydrate the form from an existing row; numeric and nullable fields become strings. */
export function itemToForm(item: Tables<'items'>): ItemFormState {
  return {
    name: item.name,
    category_id: item.category_id ?? '',
    brand: item.brand ?? '',
    model: item.model ?? '',
    description: item.description ?? '',
    serial_number: item.serial_number ?? '',
    qty: String(item.qty),
    price: String(item.price),
    purchase_date: item.purchase_date ?? '',
    supplier_id: item.supplier_id ?? '',
    department_location: item.department_location ?? '',
    location: item.location ?? '',
    remark: item.remark ?? '',
  }
}

/**
 * Validate the form and convert it into a row for `items`.
 * Returns an error message keyed by field, or the payload on success.
 *
 * The row carries no barcode: the form does not ask for one, so the create
 * path fills it in from `nextBarcode()`. Columns the form does not manage
 * (unit, cost, min_qty, status, warehouse) are left out too and take their
 * column defaults on insert, or their existing value on update.
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
      category_id: form.category_id || null,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      description: form.description.trim() || null,
      serial_number: form.serial_number.trim() || null,
      qty,
      price,
      purchase_date: form.purchase_date || null,
      supplier_id: form.supplier_id || null,
      department_location: form.department_location.trim() || null,
      location: form.location.trim() || null,
      remark: form.remark.trim() || null,
    },
  }
}

export function ItemFormFields({
  form,
  onChange,
  errors,
  categories,
  suppliers,
}: {
  form: ItemFormState
  onChange: (next: ItemFormState) => void
  errors: Partial<Record<keyof ItemFormState, string>>
  categories: Pick<Tables<'categories'>, 'id' | 'name'>[]
  suppliers: Pick<Tables<'suppliers'>, 'id' | 'company'>[]
}) {
  const set = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) =>
    onChange({ ...form, [key]: value })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Item Name" error={errors.name} htmlFor="item-name" required>
        <Input id="item-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Whiteboard Marker" />
      </Field>
      <Field label="Category" htmlFor="item-category">
        <Select id="item-category" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
          <option value="">— none —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Brand" htmlFor="item-brand">
        <Input id="item-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Model" htmlFor="item-model">
        <Input id="item-model" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Description" htmlFor="item-description">
        <Textarea
          id="item-description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What this item is"
        />
      </Field>
      <Field label="Serial Number" htmlFor="item-serial">
        <Input id="item-serial" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Quantity" error={errors.qty} htmlFor="item-qty" required>
        <Input id="item-qty" type="number" step="1" min="0" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
      </Field>
      <Field label="Unit Price" error={errors.price} htmlFor="item-price" required>
        <Input id="item-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
      </Field>
      <Field label="Date of Purchase" htmlFor="item-purchase-date">
        <Input
          id="item-purchase-date"
          type="date"
          value={form.purchase_date}
          onChange={(e) => set('purchase_date', e.target.value)}
        />
      </Field>
      <Field label="Supplier" htmlFor="item-supplier">
        <Select id="item-supplier" value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">— none —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.company}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Department" htmlFor="item-department">
        <Input
          id="item-department"
          value={form.department_location}
          onChange={(e) => set('department_location', e.target.value)}
          placeholder="e.g. Grade 10 Office"
        />
      </Field>
      <Field label="Location" htmlFor="item-location">
        <Input
          id="item-location"
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="e.g. Room B2, 2nd floor"
        />
      </Field>
      <Field label="User Remark" htmlFor="item-remark">
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
