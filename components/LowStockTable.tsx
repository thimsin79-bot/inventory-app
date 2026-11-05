import type { Tables } from '@/types/database.types'
import { DataTable, type Column } from './DataTable'
import { Badge, EmptyState } from './ui'

export type LowStockItem = Tables<'items'> & {
  supplier: Tables<'suppliers'> | null
}

/**
 * Items at or below their minimum stock level. Shared by the Stock In and Stock
 * Out modules so both surfaces show the same alert definition: `qty <= min_qty`.
 */
export function LowStockTable({ items }: { items: LowStockItem[] }) {
  const columns: Column<LowStockItem>[] = [
    { key: 'barcode', header: 'Barcode', render: (r) => <span className="font-mono text-xs whitespace-nowrap">{r.barcode}</span> },
    {
      key: 'name',
      header: 'Item',
      render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span>,
    },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier?.company ?? <span className="text-zinc-400">—</span> },
    {
      key: 'qty',
      header: 'On hand',
      render: (r) => (
        <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
          {r.qty} {r.unit}
        </span>
      ),
    },
    {
      key: 'min',
      header: 'Minimum level',
      render: (r) => <span className="tabular-nums">{r.min_qty}</span>,
    },
    {
      key: 'status',
      header: 'Alert',
      render: (r) =>
        r.qty === 0 ? <Badge tone="bad">Out of stock</Badge> : <Badge tone="warn">Low stock</Badge>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={items}
      rowKey={(r) => r.id}
      empty={
        <EmptyState
          title="Stock levels healthy"
          hint="No item is at or below its minimum stock level."
        />
      }
    />
  )
}
