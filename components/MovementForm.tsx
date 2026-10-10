'use client'

import { useState } from 'react'
import type { Tables } from '@/types/database.types'
import { Button, Field, Input, Label, Select } from './ui'

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
  busy,
  onCancel,
  onSubmit,
}: {
  item: Pick<Tables<'items'>, 'barcode' | 'name' | 'qty'>
  busy: boolean
  onCancel: () => void
  onSubmit: (delta: number) => void
}) {
  const [type, setType] = useState<MovementType>('Stock In')
  const [amount, setAmount] = useState('1')
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
    onSubmit(delta)
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

      <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3 sm:col-span-2 dark:border-zinc-800">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Apply'}
        </Button>
      </div>
    </div>
  )
}