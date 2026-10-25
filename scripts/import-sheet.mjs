// Import inventory items from the ICT Google Sheet into the live database.
//
//   npm run import:sheet            dry run: download, parse, report what would change
//   npm run import:sheet -- --apply insert the new items
//
// The sheet must be shared as "Anyone with the link" (Viewer). Rows are matched on
// the ICT Code (items.barcode): codes already in the database are left alone, so
// re-running is safe. Uses the publishable key from .env.local, like the app does.
// Maintenance History and Broken List tabs are not items and are not imported.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseCsv } from '../utils/csv.ts'

const SHEET_ID = process.env.SHEET_ID ?? '1z8mpX3R985RreT9uKKLwhpRuc87USJc6ruHfD-hDHJ4'
const apply = process.argv.includes('--apply')

// Sheet tab name (exact, trailing spaces included) -> category name in the app.
const TABS = [
  ['Laptop ', 'Laptop'],
  ['Desktop', 'Desktop'],
  ['Printer', 'Printer'],
  ['Projector', 'Projector'],
  ['Monitor', 'Monitor'],
  ['Smart TV', 'Smart TV'],
  ['Tablet', 'Tablet'],
  ['Security Camera', 'Security Camera'],
  ['DVRNVR', 'DVR/NVR'],
  ['Switch', 'Switch'],
  ['Access PointRouter', 'Access Point/Router'],
  ['Accessory', 'Accessory'],
]

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const pad = (n) => String(n).padStart(2, '0')

// '2-Oct-2017', '10-Aug-17', '8/10/2018' (month first), '2026-10-02' or an Excel serial -> YYYY-MM-DD
function parseDate(raw) {
  const s = raw.trim()
  if (!s) return null
  let y, m, d, hit
  if ((hit = /^(\d{1,2})-([A-Za-z]{3})[a-z]*-(\d{2}|\d{4})$/.exec(s))) {
    ;[d, m, y] = [Number(hit[1]), MONTHS[hit[2].toLowerCase()], Number(hit[3])]
  } else if ((hit = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s))) {
    ;[m, d, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])]
  } else if ((hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) {
    ;[y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])]
  } else if (/^\d{5}$/.test(s)) {
    return new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5).toISOString().slice(0, 10)
  } else return undefined
  if (y < 100) y += 2000
  if (!m || m > 12 || d < 1 || d > 31) return undefined
  return `${y}-${pad(m)}-${pad(d)}`
}

// '$4,450.00' -> 4450; blanks, 'N/A' and '$-' -> 0
function parseMoney(raw) {
  const n = Number(raw.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const clean = (v) => {
  const s = (v ?? '').trim()
  return s === '' || /^n\/?a$/i.test(s) ? null : s
}

function env() {
  const out = {}
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !line.startsWith('#')) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '').replace(/^﻿/, '')
  }
  return out
}

// This network drops connections now and then (connect timeouts); retry before giving up.
// Re-sending is safe here: reads are idempotent and inserts are guarded by the barcode check.
async function fetchRetry(input, init) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(input, init)
    } catch (err) {
      if (attempt === 5) throw err
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
}

async function fetchTab(tab) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`)
  url.searchParams.set('tqx', 'out:csv')
  url.searchParams.set('sheet', tab)
  const res = await fetchRetry(url)
  const text = await res.text()
  if (!res.ok || text.startsWith('<')) throw new Error(`Cannot read tab "${tab.trim()}" (HTTP ${res.status}). Is the sheet shared with "Anyone with the link"?`)
  return parseCsv(text.replace(/^﻿/, ''))
}

const warnings = []
const items = []
const seen = new Map()

for (const [tab, category] of TABS) {
  const table = await fetchTab(tab)
  const [header = [], ...body] = table
  const col = (name) => header.findIndex((h) => h.trim().toLowerCase().replace(/[^a-z]/g, '') === name)
  const c = {
    code: col('ictcode'), brand: col('brand'), model: col('model'), location: col('location'), serial: col('serialnumber'),
    qty: col('qtity') !== -1 ? col('qtity') : col('qty'), price: col('unitprice'), date: col('dateofpurchase'),
    supplier: col('supplier'), dept: col('department'), remark: col('userremark'),
  }
  if (body.length && (c.code === -1 || c.model === -1)) throw new Error(`Tab "${tab.trim()}" has no ICT Code / Model column`)
  const cell = (row, k) => (c[k] === -1 ? '' : (row[c[k]] ?? '').trim())

  body.forEach((row, i) => {
    const where = `${tab.trim()} row ${i + 2}`
    if (row.every((v) => v.trim() === '')) return
    const barcode = cell(row, 'code')
    if (!/^SH-[A-Z-]*\d+$/i.test(barcode)) {
      warnings.push(`${where}: skipped, "${barcode || '(blank)'}" is not a complete ICT code (${cell(row, 'brand')} ${cell(row, 'model')})`)
      return
    }
    if (seen.has(barcode)) {
      warnings.push(`${where}: skipped, ${barcode} already appears in ${seen.get(barcode)}`)
      return
    }
    seen.set(barcode, where)

    const brand = clean(cell(row, 'brand'))
    const model = clean(cell(row, 'model'))?.replace(/-$/, '') ?? null
    const name = !model ? (brand ?? category) : !brand || model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`
    const rawDate = cell(row, 'date')
    const date = parseDate(rawDate)
    if (date === undefined) warnings.push(`${where}: ${barcode} date "${rawDate}" not understood, left empty`)
    const qty = Number.parseInt(cell(row, 'qty'), 10)
    const price = parseMoney(cell(row, 'price'))

    items.push({
      barcode, name, category, brand, model,
      serial_number: clean(cell(row, 'serial')),
      unit: 'Pcs', cost: price, price, qty: Number.isInteger(qty) && qty >= 0 ? qty : 1,
      supplier: clean(cell(row, 'supplier')),
      department_location: clean(cell(row, 'dept')),
      location: clean(cell(row, 'location')),
      purchase_date: date ?? null,
      remark: clean(cell(row, 'remark')),
    })
  })
}

const e = env()
const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  global: { fetch: fetchRetry },
})
const must = (r) => { if (r.error) throw r.error; return r.data }

const have = new Set()
for (let i = 0; i < items.length; i += 100) {
  const codes = items.slice(i, i + 100).map((x) => x.barcode)
  must(await sb.from('items').select('barcode').in('barcode', codes)).forEach((r) => have.add(r.barcode))
}
const fresh = items.filter((x) => !have.has(x.barcode))

const cats = must(await sb.from('categories').select('id,name'))
const sups = must(await sb.from('suppliers').select('id,company'))
const find = (list, key, v) => list.find((x) => x[key].toLowerCase() === v.toLowerCase())
const newCats = [...new Set(fresh.map((x) => x.category))].filter((n) => !find(cats, 'name', n))
const newSups = [...new Set(fresh.map((x) => x.supplier).filter(Boolean))].filter((n) => !find(sups, 'company', n))

const perCategory = {}
for (const x of fresh) perCategory[x.category] = (perCategory[x.category] ?? 0) + 1
console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${items.length} rows read, ${have.size} already in the database, ${fresh.length} to add`)
console.log('to add per category:', perCategory)
console.log('new categories:', newCats, '\nnew suppliers:', newSups)
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ${warnings.join('\n  ')}`)

if (!apply) {
  console.log('\nNothing written. Re-run with --apply to add the items.')
  process.exit(0)
}

// Same id shape as nextId() in services/inventoryService.ts
const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const id = (p) => `${p}-${Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('')}`
for (const name of newCats) cats.push(must(await sb.from('categories').insert({ id: id('CAT'), name }).select().single()))
for (const company of newSups) sups.push(must(await sb.from('suppliers').insert({ id: id('SUP'), company }).select().single()))

let added = 0
for (let i = 0; i < fresh.length; i += 100) {
  const rows = fresh.slice(i, i + 100).map(({ category, supplier, ...rest }) => ({
    ...rest,
    category_id: find(cats, 'name', category)?.id ?? null,
    supplier_id: supplier ? (find(sups, 'company', supplier)?.id ?? null) : null,
  }))
  added += must(await sb.from('items').insert(rows).select('barcode')).length
}
console.log(`\nAdded ${added} item(s).`)
