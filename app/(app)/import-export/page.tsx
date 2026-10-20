'use client'

import { useCallback, useState } from 'react'
import {
  getInventoryItems,
  getCategories,
  getSuppliers,
  getWarehouses,
  createCategory,
  createSupplier,
  createItem,
  updateItem,
  nextBarcode,
} from '@/services/inventoryService'
import type { Tables, Updates } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { today } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Button, Card, Field, Input, Notice, PageHeader, Spinner } from '@/components/ui'
import { itemsToCsv, parseItemCsv, ITEM_CSV_COLUMNS, type ItemCsvError, type ItemCsvParse } from '@/lib/itemsCsv'

type ItemRow = Tables<'items'> & {
  category: Tables<'categories'> | null
  warehouse: Tables<'warehouses'> | null
  supplier: Tables<'suppliers'> | null
}

type Preview = ItemCsvParse & { fileName: string }

type ImportResult = {
  created: number
  updated: number
  failures: ItemCsvError[]
  createdCategories: string[]
  createdSuppliers: string[]
  unknownWarehouses: string[]
}

const loadItems = () => getInventoryItems() as Promise<ItemRow[]>

const ERROR_COLUMNS: Column<ItemCsvError>[] = [
  { key: 'line', header: 'Row', render: (r) => <span className="tabular-nums">{r.line}</span> },
  { key: 'item', header: 'Item', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.item}</span> },
  { key: 'messages', header: 'Problem', render: (r) => r.messages.join(' ') },
]

export default function ImportExportPage() {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const items = useAsyncData(loadItems)

  async function exportCsv() {
    setBusy('export')
    setError(null)
    try {
      const rows = (await getInventoryItems()) as ItemRow[]
      const csv = `\uFEFF${itemsToCsv(rows)}`
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventory-${today()}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setNotice(`Exported ${rows.length} item${rows.length === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setNotice(null)
    setResult(null)
    try {
      const parsed = parseItemCsv(await file.text())
      setPreview({ fileName: file.name, ...parsed })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const runImport = useCallback(async () => {
    if (!preview) return
    setBusy('import')
    setError(null)
    try {
      setProgress('Loading current items…')
      const current = (await getInventoryItems()) as ItemRow[]
      const byBarcode = new Map(current.map((i) => [i.barcode, i.id]))

      const categories = await getCategories()
      const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]))
      const suppliers = await getSuppliers()
      const supByName = new Map(suppliers.map((s) => [s.company.trim().toLowerCase(), s.id]))
      const warehouses = await getWarehouses()
      const whByName = new Map(warehouses.map((w) => [w.name.trim().toLowerCase(), w.id]))

      let created = 0
      let updated = 0
      const createdCategories = new Set<string>()
      const createdSuppliers = new Set<string>()
      const unknownWarehouses = new Set<string>()
      const failures: ItemCsvError[] = []

      for (let i = 0; i < preview.rows.length; i++) {
        const row = preview.rows[i]
        setProgress(`Importing ${i + 1} of ${preview.rows.length}…`)

        try {
          const payload: Updates<'items'> & { name: string } = { name: row.name }

          if (row.category) {
            const key = row.category.trim().toLowerCase()
            const hit = catByName.get(key)
            if (hit) {
              payload.category_id = hit
            } else {
              const added = await createCategory({ name: row.category.trim() })
              catByName.set(key, added.id)
              createdCategories.add(added.name)
              payload.category_id = added.id
            }
          }

          if (row.supplier) {
            const key = row.supplier.trim().toLowerCase()
            const hit = supByName.get(key)
            if (hit) {
              payload.supplier_id = hit
            } else {
              const added = await createSupplier({ company: row.supplier.trim() })
              supByName.set(key, added.id)
              createdSuppliers.add(added.company)
              payload.supplier_id = added.id
            }
          }

          if (row.warehouse) {
            const hit = whByName.get(row.warehouse.trim().toLowerCase())
            if (hit) payload.warehouse_id = hit
            else unknownWarehouses.add(row.warehouse)
          }

          if (row.brand) payload.brand = row.brand
          if (row.model) payload.model = row.model
          if (row.description) payload.description = row.description
          if (row.serial_number) payload.serial_number = row.serial_number
          if (row.unit) payload.unit = row.unit
          if (row.cost !== null) payload.cost = row.cost
          if (row.price !== null) payload.price = row.price
          if (row.min_qty !== null) payload.min_qty = row.min_qty
          if (row.qty !== null) payload.qty = row.qty
          if (row.department_location) payload.department_location = row.department_location
          if (row.location) payload.location = row.location
          if (row.purchase_date) payload.purchase_date = row.purchase_date
          if (row.remark) payload.remark = row.remark
          if (row.status) payload.status = row.status

          const existingId = row.barcode ? byBarcode.get(row.barcode) : undefined
          if (existingId) {
            await updateItem(existingId, payload)
            updated++
          } else {
            const barcode = row.barcode ?? (await nextBarcode())
            const inserted = await createItem({ ...payload, barcode })
            byBarcode.set(inserted.barcode, inserted.id)
            created++
          }
        } catch (e) {
          failures.push({ line: row.line, item: row.name || '(no name)', messages: [errorMessage(e)] })
        }
      }

      setResult({
        created,
        updated,
        failures,
        createdCategories: [...createdCategories],
        createdSuppliers: [...createdSuppliers],
        unknownWarehouses: [...unknownWarehouses],
      })
      setPreview(null)
      setNotice(`Import finished: ${created} created, ${updated} updated${failures.length > 0 ? `, ${failures.length} failed` : ''}.`)
      items.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }, [preview, items])

  return (
    <>
      <PageHeader
        title="Import / Export"
        description="Move the inventory list in and out of the app as a CSV file."
      />

      {notice && <Notice className="mb-3">{notice}</Notice>}
      {error && <Notice tone="bad" className="mb-3">{error}</Notice>}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Export</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Download every item in inventory — not just the rows currently shown on the Inventory screen.
            The file uses the same columns the import accepts, so it can be edited in Excel and imported
            back to update the same items.
          </p>
          <div className="mt-3">
            <Button variant="primary" onClick={exportCsv} disabled={busy !== null}>
              {busy === 'export' ? 'Preparing…' : 'Download items CSV'}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Import</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Upload a CSV with a header row. Rows whose <span className="font-mono text-xs">barcode</span> matches an
            existing item update it; new or blank barcodes create items. Categories and suppliers are matched
            by name and created when missing; unknown warehouse names are skipped with a warning. Leave a cell
            empty to keep the column default (new items) or the current value (existing items).
          </p>
          <div className="mt-3 grid gap-3">
            <Field label="CSV file" htmlFor="ie-file">
              <Input id="ie-file" type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy !== null} />
            </Field>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Columns: <span className="font-mono">{ITEM_CSV_COLUMNS.join(', ')}</span>
            </p>
          </div>
        </Card>
      </div>

      {preview && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{preview.fileName}</p>
              {preview.fatal ? null : (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {preview.rows.length} ready to import, {preview.errors.length} with errors.
                </p>
              )}
            </div>
            {preview.fatal === null && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy !== null}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={runImport}
                  disabled={busy !== null || preview.rows.length === 0}
                >
                  {busy === 'import' ? (progress ?? 'Importing…') : `Import ${preview.rows.length} row${preview.rows.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            )}
          </div>

          {preview.fatal && <Notice tone="bad" className="mt-3">{preview.fatal}</Notice>}

          {preview.fatal === null && preview.unknownHeaders.length > 0 && (
            <Notice className="mt-3">Ignored unknown columns: {preview.unknownHeaders.join(', ')}</Notice>
          )}

          {preview.fatal === null && preview.errors.length > 0 && (
            <div className="mt-3">
              <DataTable
                columns={ERROR_COLUMNS}
                rows={preview.errors}
                rowKey={(r) => String(r.line)}
                empty={null}
              />
            </div>
          )}
        </Card>
      )}

      {result && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Last import result</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {result.created} created, {result.updated} updated
            {result.failures.length > 0 ? `, ${result.failures.length} failed.` : '.'}
          </p>
          {result.createdCategories.length > 0 && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Categories created: {result.createdCategories.join(', ')}.
            </p>
          )}
          {result.createdSuppliers.length > 0 && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Suppliers created: {result.createdSuppliers.join(', ')}.
            </p>
          )}
          {result.unknownWarehouses.length > 0 && (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              Warehouses not found (left empty): {result.unknownWarehouses.join(', ')}. Add them on the Warehouses
              table first, then re-import to attach these items.
            </p>
          )}
          {result.failures.length > 0 && (
            <div className="mt-3">
              <DataTable
                columns={ERROR_COLUMNS}
                rows={result.failures}
                rowKey={(r) => String(r.line)}
                empty={null}
              />
            </div>
          )}
        </Card>
      )}

      <AsyncBoundary loading={items.loading} error={items.error} errorCode={items.errorCode} onRetry={items.reload}>
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {items.data?.length ?? 0} item{items.data?.length === 1 ? '' : 's'} currently in inventory.
            {busy === 'import' && progress && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Spinner /> {progress}
              </span>
            )}
          </p>
        </Card>
      </AsyncBoundary>
    </>
  )
}
