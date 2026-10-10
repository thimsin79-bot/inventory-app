'use client'

import { useState } from 'react'
import type { Tables, Inserts } from '@/types/database.types'
import { Button, Field, Input, Label, Select, Textarea } from './ui'

export const MOVEMENT_TYPES = ['Stock In', 'Stock Out', 'Transfer', 'Adjustment', 'Return Out'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

/**
 * How each movement type affects `items.qty`.
 * Adjustment carries its own sign; transfers move stock between warehouses so
 * the item total is unchanged; everything else is derived from the direction.
 */
export function movementDelta(type: MovementType, amount: number): number {
  switch (type) {
    case 'Stock In':
      return Math.abs(amount)
    case 'Stock Out':
    case 'Return Out':
      return -Math.abs(amount)
    case 'Transfer':
      return 0
    case 'Adjustment':
      return amount
  }
}

/** Movements where the user types a negative number to reduce stock. */
export const SIGNED_TYPES: MovementType[] = ['Adjustment']

export function MovementForm({
  item,
  warehouses,
  busy,
  onCancel,
  onSubmit,
}: {
  item: Pick<Tables<'items'>, 'barcode' | 'name' | 'qty'>
  warehouses: Pick<Tables<'warehouses'>, 'id' | 'name'>[]
  busy: boolean
  onCancel: () => void
  onSubmit: (row: Inserts<'transactions'>, delta: number) => void
}) {
  const [type, setType] = useState<MovementType>('Stock In')
  const [amount, setAmount] = useState('1')
  const [warehouse, setWarehouse] = useState('')
  const [ref, setRef] = useState('')
  const [remark, setRemark] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)

  function submit() {
    const n = Number(amount)
    const signed = SIGNED_TYPES.includes(type)

    if (!Number.isInteger(n)) {
      setAmountError('Enter a whole number.')
      return
    }
    if (signed ? n === 0 : n <= 0) {
      setAmountError(signed ? 'Adjustment cannot be zero.' : 'Enter a whole number greater than zero.')
      return
    }

    const delta = movementDelta(type, n)
    if (item.qty + delta < 0) {
      setAmountError(`Only ${item.qty} in stock.`)
      return
    }

    setAmountError(null)
    onSubmit(
      {
        item_barcode: item.barcode,
        item_name: item.name,
        warehouse: warehouse || null,
        type,
        qty: n,
        ref: ref.trim() || null,
        remark: remark.trim() || null,
      },
      delta,
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Item</Label>
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-800/50">
          {item.name} <span className="text-zinc-500">({item.barcode})</span>
        </p>
      </div>

      <Field label="Type" htmlFor="mv-type" required>
        <Select id="mv-type" value={type} onChange={(e) => setType(e.target.value as MovementType)}>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={SIGNED_TYPES.includes(type) ? 'Change (+/-)' : 'Quantity'}
        htmlFor="mv-amount"
        required
        error={amountError ?? undefined}
      >
        <Input id="mv-amount" type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>

      <Field label="Warehouse" htmlFor="mv-warehouse">
        <Select id="mv-warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
          <option value="">— none —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Reference" htmlFor="mv-ref">
        <Input id="mv-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PO-2026-014, ISS-0341…" />
      </Field>

      <Field label="Remark" htmlFor="mv-remark" className="sm:col-span-2">
        <Textarea id="mv-remark" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Optional" />
      </Field>

      <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3 sm:col-span-2 dark:border-zinc-800">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Record movement'}
        </Button>
      </div>
    </div>
  )
}