import { parseCsv, toCsv } from '@/utils/csv'

/**
 * The CSV contract for the Import / Export screen.
 *
 * Headers are the stable snake_case column names (matched case-insensitively),
 * never the display labels, so a file this app exported always re-imports.
 * Category / supplier / warehouse travel as names, not ids, so the file is
 * readable and portable across environments.
 *
 * Blank cell semantics on import: the field is skipped — a new item takes its
 * column default, an existing item keeps its current value.
 */

export const ITEM_CSV_COLUMNS = [
  'barcode',
  'name',
  'category',
  'brand',
  'model',
  'description',
  'serial_number',
  'unit',
  'cost',
  'price',
  'min_qty',
  'qty',
  'warehouse',
  'supplier',
  'department_location',
  'location',
  'purchase_date',
  'remark',
  'status',
] as const

export type ItemCsvRow = {
  line: number
  barcode: string | null
  name: string
  category: string | null
  brand: string | null
  model: string | null
  description: string | null
  serial_number: string | null
  unit: string | null
  cost: number | null
  price: number | null
  min_qty: number | null
  qty: number | null
  warehouse: string | null
  supplier: string | null
  department_location: string | null
  location: string | null
  purchase_date: string | null
  remark: string | null
  status: string | null
}

export type ItemCsvError = { line: number; item: string; messages: string[] }

export type ItemCsvParse = {
  fatal: string | null
  rows: ItemCsvRow[]
  errors: ItemCsvError[]
  unknownHeaders: string[]
}

type ExportableItem = {
  barcode: string
  name: string
  category: { name: string } | null
  brand: string | null
  model: string | null
  description: string | null
  serial_number: string | null
  unit: string
  cost: number
  price: number
  min_qty: number
  qty: number
  warehouse: { name: string } | null
  supplier: { company: string } | null
  department_location: string | null
  location: string | null
  purchase_date: string | null
  remark: string | null
  status: string
}

/** Render the full item list as CSV text (no BOM — the caller adds it). */
export function itemsToCsv(items: ExportableItem[]): string {
  const rows: (string | number | null)[][] = [[...ITEM_CSV_COLUMNS]]
  for (const i of items) {
    rows.push([
      i.barcode,
      i.name,
      i.category?.name ?? '',
      i.brand,
      i.model,
      i.description,
      i.serial_number,
      i.unit,
      i.cost,
      i.price,
      i.min_qty,
      i.qty,
      i.warehouse?.name ?? '',
      i.supplier?.company ?? '',
      i.department_location,
      i.location,
      i.purchase_date,
      i.remark,
      i.status,
    ])
  }
  return toCsv(rows)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const NUMBER_LABELS: Record<string, string> = {
  cost: 'Cost',
  price: 'Unit price',
  min_qty: 'Minimum quantity',
  qty: 'Quantity',
}

function parseNumberCell(label: string, raw: string, integer: boolean): { value: number | null; error: string | null } {
  if (raw === '') return { value: null, error: null }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    return { value: null, error: `${label} must be ${integer ? 'a whole number' : 'a number'} ≥ 0.` }
  }
  return { value: n, error: null }
}

function parseDateCell(raw: string): { value: string | null; error: string | null } {
  if (raw === '') return { value: null, error: null }
  if (!ISO_DATE.test(raw) || Number.isNaN(Date.parse(raw))) {
    return { value: null, error: 'Date of purchase must be YYYY-MM-DD (e.g. 2026-01-31).' }
  }
  return { value: raw, error: null }
}

/**
 * Parse and validate an items CSV. Structural problems (no usable header,
 * missing `name` column, unclosed quote) come back as `fatal`; recoverable
 * per-row problems land in `errors` so the rest of the file can still import.
 * Line numbers are spreadsheet rows: the header is row 1.
 */
export function parseItemCsv(text: string): ItemCsvParse {
  const empty: Omit<ItemCsvParse, 'fatal'> = { rows: [], errors: [], unknownHeaders: [] }

  let table: string[][]
  try {
    table = parseCsv(text)
  } catch (e) {
    return { fatal: e instanceof Error ? e.message : 'The file could not be read.', ...empty }
  }

  if (table.length === 0) return { fatal: 'The file is empty.', ...empty }

  const headers = table[0].map((h) => h.trim().toLowerCase())
  const known = new Set<string>(ITEM_CSV_COLUMNS)
  const unknownHeaders = headers.filter((h) => h !== '' && !known.has(h))

  if (!headers.includes('name')) {
    return { fatal: "The header row must include a 'name' column.", rows: [], errors: [], unknownHeaders }
  }

  const col = (key: string) => headers.indexOf(key)

  const rows: ItemCsvRow[] = []
  const errors: ItemCsvError[] = []
  const barcodeSeen = new Map<string, number>()

  for (let r = 1; r < table.length; r++) {
    const cells = table[r]
    const line = r + 1
    const cell = (key: string) => {
      const i = col(key)
      return i === -1 ? '' : (cells[i] ?? '').trim()
    }
    const messages: string[] = []

    const name = cell('name')
    if (!name) messages.push('Item name is required.')

    const barcode = cell('barcode') || null
    if (barcode) {
      const firstLine = barcodeSeen.get(barcode)
      if (firstLine !== undefined) {
        messages.push(`Barcode ${barcode} is duplicated (first seen on row ${firstLine}).`)
      }
    }

    const cost = parseNumberCell(NUMBER_LABELS.cost, cell('cost'), false)
    const price = parseNumberCell(NUMBER_LABELS.price, cell('price'), false)
    const minQty = parseNumberCell(NUMBER_LABELS.min_qty, cell('min_qty'), true)
    const qty = parseNumberCell(NUMBER_LABELS.qty, cell('qty'), true)
    const purchaseDate = parseDateCell(cell('purchase_date'))

    for (const result of [cost, price, minQty, qty, purchaseDate]) {
      if (result.error) messages.push(result.error)
    }

    if (messages.length > 0) {
      errors.push({ line, item: name || '(no name)', messages })
      continue
    }

    // Only rows that will actually import reserve their barcode, so a row that
    // failed validation for another reason does not block a later valid row.
    if (barcode) barcodeSeen.set(barcode, line)

    rows.push({
      line,
      barcode,
      name,
      category: cell('category') || null,
      brand: cell('brand') || null,
      model: cell('model') || null,
      description: cell('description') || null,
      serial_number: cell('serial_number') || null,
      unit: cell('unit') || null,
      cost: cost.value,
      price: price.value,
      min_qty: minQty.value,
      qty: qty.value,
      warehouse: cell('warehouse') || null,
      supplier: cell('supplier') || null,
      department_location: cell('department_location') || null,
      location: cell('location') || null,
      purchase_date: purchaseDate.value,
      remark: cell('remark') || null,
      status: cell('status') || null,
    })
  }

  return { fatal: null, rows, errors, unknownHeaders }
}
