'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  getInventoryItems,
  getPurchases,
  getRequests,
  getMaintenance,
} from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { formatDate, formatMoney } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Card, EmptyState, Label, PageHeader, Select, StatusBadge } from '@/components/ui'

type ItemRow = Tables<'items'> & {
  category: Tables<'categories'> | null
}
type PurchaseRow = Tables<'purchases'> & {
  supplier: Tables<'suppliers'> | null
}

const REPORTS = [
  { id: 'valuation', label: 'Inventory valuation by category' },
  { id: 'purchases', label: 'Purchases by supplier' },
  { id: 'requests', label: 'Requests by department' },
  { id: 'maintenance', label: 'Maintenance by status' },
] as const

type ReportId = (typeof REPORTS)[number]['id']

const dash = <span className="text-zinc-400">—</span>

type ValuationRow = { key: string; category: string; items: number; units: number; cost: number; retail: number; margin: number }
const VALUATION_COLUMNS: Column<ValuationRow>[] = [
  { key: 'category', header: 'Category', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.category}</span> },
  { key: 'items', header: 'Items', render: (r) => <span className="tabular-nums">{r.items}</span> },
  { key: 'units', header: 'Units', render: (r) => <span className="tabular-nums">{r.units}</span> },
  { key: 'cost', header: 'Cost value', render: (r) => <span className="tabular-nums">{formatMoney(r.cost)}</span> },
  { key: 'retail', header: 'Retail value', render: (r) => <span className="tabular-nums">{formatMoney(r.retail)}</span> },
  { key: 'margin', header: 'Margin', render: (r) => <span className="tabular-nums">{formatMoney(r.margin)}</span> },
]

type SupplierRow = { key: string; supplier: string; orders: number; units: number; spend: number; last: string | null }
const SUPPLIER_COLUMNS: Column<SupplierRow>[] = [
  { key: 'supplier', header: 'Supplier', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.supplier}</span> },
  { key: 'orders', header: 'Orders', render: (r) => <span className="tabular-nums">{r.orders}</span> },
  { key: 'units', header: 'Items ordered', render: (r) => <span className="tabular-nums">{r.units}</span> },
  { key: 'spend', header: 'Total spend', render: (r) => <span className="tabular-nums">{formatMoney(r.spend)}</span> },
  { key: 'last', header: 'Last order', render: (r) => <span className="tabular-nums">{r.last ? formatDate(r.last) : dash}</span> },
]

type DepartmentRow = { key: string; department: string; requests: number; pending: number; approved: number; rejected: number; qty: number }
const DEPARTMENT_COLUMNS: Column<DepartmentRow>[] = [
  { key: 'department', header: 'Department', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.department}</span> },
  { key: 'requests', header: 'Requests', render: (r) => <span className="tabular-nums">{r.requests}</span> },
  { key: 'pending', header: 'Pending', render: (r) => <span className="tabular-nums">{r.pending}</span> },
  { key: 'approved', header: 'Approved', render: (r) => <span className="tabular-nums">{r.approved}</span> },
  { key: 'rejected', header: 'Rejected', render: (r) => <span className="tabular-nums">{r.rejected}</span> },
  { key: 'qty', header: 'Total qty', render: (r) => <span className="tabular-nums">{r.qty}</span> },
]

type MaintenanceStatusRow = { key: string; status: string; records: number; cost: number }
const MAINTENANCE_COLUMNS: Column<MaintenanceStatusRow>[] = [
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'records', header: 'Records', render: (r) => <span className="tabular-nums">{r.records}</span> },
  { key: 'cost', header: 'Total cost', render: (r) => <span className="tabular-nums">{formatMoney(r.cost)}</span> },
]

/** Newest date wins; ISO `YYYY-MM-DD` strings compare correctly lexically. */
function latest(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportId>('valuation')

  const load = useCallback(async () => {
    const [items, purchases, requests, maintenance] = await Promise.all([
      getInventoryItems() as Promise<ItemRow[]>,
      getPurchases() as Promise<PurchaseRow[]>,
      getRequests(),
      getMaintenance(),
    ])
    return { items, purchases, requests, maintenance }
  }, [])

  const state = useAsyncData(load)

  const valuation = useMemo(() => {
    const map = new Map<string, ValuationRow>()
    for (const i of state.data?.items ?? []) {
      const category = i.category?.name ?? 'Uncategorized'
      const row = map.get(category) ?? { key: category, category, items: 0, units: 0, cost: 0, retail: 0, margin: 0 }
      row.items += 1
      row.units += i.qty
      row.cost += i.qty * Number(i.cost)
      row.retail += i.qty * Number(i.price)
      row.margin = row.retail - row.cost
      map.set(category, row)
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost)
  }, [state.data])

  const suppliers = useMemo(() => {
    const map = new Map<string, SupplierRow>()
    for (const p of state.data?.purchases ?? []) {
      const supplier = p.supplier?.company ?? 'Unassigned'
      const row = map.get(supplier) ?? { key: supplier, supplier, orders: 0, units: 0, spend: 0, last: null }
      row.orders += 1
      row.units += p.items_count
      row.spend += Number(p.total)
      row.last = latest(row.last, p.date)
      map.set(supplier, row)
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend)
  }, [state.data])

  const departments = useMemo(() => {
    const map = new Map<string, DepartmentRow>()
    for (const r of state.data?.requests ?? []) {
      const row = map.get(r.dept) ?? { key: r.dept, department: r.dept, requests: 0, pending: 0, approved: 0, rejected: 0, qty: 0 }
      const status = r.status.toLowerCase()
      row.requests += 1
      row.qty += r.qty
      if (status === 'pending') row.pending += 1
      else if (status === 'approved') row.approved += 1
      else if (status === 'rejected') row.rejected += 1
      map.set(r.dept, row)
    }
    return [...map.values()].sort((a, b) => b.requests - a.requests)
  }, [state.data])

  const maintenance = useMemo(() => {
    const map = new Map<string, MaintenanceStatusRow>()
    for (const m of state.data?.maintenance ?? []) {
      const row = map.get(m.status) ?? { key: m.status, status: m.status, records: 0, cost: 0 }
      row.records += 1
      row.cost += Number(m.cost)
      map.set(m.status, row)
    }
    return [...map.values()].sort((a, b) => b.records - a.records)
  }, [state.data])

  const stats = useMemo(() => {
    const items = state.data?.items ?? []
    let units = 0
    let costValue = 0
    let retailValue = 0
    for (const i of items) {
      units += i.qty
      costValue += i.qty * Number(i.cost)
      retailValue += i.qty * Number(i.price)
    }
    const maintenanceSpend = (state.data?.maintenance ?? []).reduce((sum, m) => sum + Number(m.cost), 0)
    return { totalItems: items.length, units, costValue, retailValue, margin: retailValue - costValue, maintenanceSpend }
  }, [state.data])

  const tiles = [
    { label: 'Items tracked', value: stats.totalItems.toLocaleString() },
    { label: 'Units on hand', value: stats.units.toLocaleString() },
    { label: 'Stock value (cost)', value: formatMoney(stats.costValue) },
    { label: 'Retail value', value: formatMoney(stats.retailValue) },
    { label: 'Potential margin', value: formatMoney(stats.margin) },
    { label: 'Maintenance spend', value: formatMoney(stats.maintenanceSpend) },
  ]

  return (
    <>
      <PageHeader title="Reports" description="Read-only summaries computed from the same data as each screen." />

      <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {tiles.map((t) => (
            <Card key={t.label} className="px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{t.value}</p>
            </Card>
          ))}
        </div>

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="w-full sm:w-72">
              <Label htmlFor="report-kind">Report</Label>
              <Select
                id="report-kind"
                value={report}
                onChange={(e) => setReport(e.target.value as ReportId)}
              >
                {REPORTS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {report === 'valuation' && (
            <DataTable
              columns={VALUATION_COLUMNS}
              rows={valuation}
              rowKey={(r) => r.key}
              empty={<EmptyState title="No inventory to value" hint="Add items on the Inventory screen, or run supabase/seed.sql." />}
            />
          )}
          {report === 'purchases' && (
            <DataTable
              columns={SUPPLIER_COLUMNS}
              rows={suppliers}
              rowKey={(r) => r.key}
              empty={<EmptyState title="No purchase orders" hint="Record orders on the Purchases screen." />}
            />
          )}
          {report === 'requests' && (
            <DataTable
              columns={DEPARTMENT_COLUMNS}
              rows={departments}
              rowKey={(r) => r.key}
              empty={<EmptyState title="No requests" hint="Requisitions appear on the Requests screen." />}
            />
          )}
          {report === 'maintenance' && (
            <DataTable
              columns={MAINTENANCE_COLUMNS}
              rows={maintenance}
              rowKey={(r) => r.key}
              empty={<EmptyState title="No maintenance records" hint="Log servicing and repairs on the Maintenance screen." />}
            />
          )}
        </Card>
      </AsyncBoundary>
    </>
  )
}