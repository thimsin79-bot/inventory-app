import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const CLEAR_TABLES = [
  'categories',
  'suppliers',
  'warehouses',
  'departments',
  'items',
  'purchases',
  'transactions',
  'requests',
  'audits',
  'maintenance',
]
const ALL_TABLES = [...CLEAR_TABLES, 'company_settings']

let passed = 0
let failed = 0

function check(label, condition) {
  if (condition) {
    passed++
    console.log(`  pass  ${label}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}`)
  }
}

function loadEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}

let env
try {
  env = loadEnv(join(ROOT, '.env.local'))
} catch {
  console.error('cannot read .env.local — nothing to test against')
  process.exit(1)
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const token = env.SUPABASE_ACCESS_TOKEN ? env.SUPABASE_ACCESS_TOKEN.trim() : ''

if (!url || !key || !token) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_ACCESS_TOKEN in .env.local')
  process.exit(1)
}

const project = new URL(url).hostname.split('.')[0]

function rowsOf(data) {
  if (!Array.isArray(data)) return []
  if (data.length === 1 && data[0] && Array.isArray(data[0].rows)) return data[0].rows
  return data
}

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`management API ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function counts() {
  const sql = ALL_TABLES.map((t) => `select '${t}' as t, count(*)::int as n from public.${t}`).join(' union all ')
  const rows = rowsOf(await runSql(sql))
  const byName = Object.fromEntries(rows.map((r) => [r.t, r.n]))
  return Object.fromEntries(ALL_TABLES.map((t) => [t, byName[t] ?? 0]))
}

async function clear() {
  await runSql(`truncate table ${CLEAR_TABLES.map((t) => `public.${t}`).join(', ')}`)
}

async function rest(method, path, body, quiet = false) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: method === 'GET' || method === 'DELETE' ? 'return=minimal' : 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok && !quiet) {
    const short = typeof data === 'string' ? data : JSON.stringify(data)
    console.log(`        ${method} ${path} → HTTP ${res.status} ${short.slice(0, 220)}`)
  }
  return { status: res.status, ok: res.ok, data }
}

function mismatched(row, payload) {
  if (!row) return Object.keys(payload)
  return Object.keys(payload).filter((k) => {
    const want = payload[k]
    const got = row[k]
    if (want === null) return got !== null
    if (typeof want === 'number') return Number(got) !== want
    return String(got) !== String(want)
  })
}

function reportMismatches(mismatches) {
  if (mismatches.length) console.log(`        mismatched: ${mismatches.join(', ')}`)
}

const MODULES = [
  {
    name: 'categories (Categories screen)',
    table: 'categories',
    idKey: 'id',
    create: {
      id: 'SMK-CAT-1',
      name: 'Smoke Category',
      description: 'Category created by the form smoke test',
    },
    update: { name: 'Smoke Category (edited)', description: 'Edited by the form smoke test' },
    deleteCheck: 'ok',
  },
  {
    name: 'suppliers (Suppliers screen)',
    table: 'suppliers',
    idKey: 'id',
    create: {
      id: 'SMK-SUP-1',
      company: 'Smoke Supply Co',
      contact: 'Alex Doe',
      phone: '+1 555 0100',
      email: 'alex@smoke.test',
      address: '1 Smoke Street',
    },
    update: { company: 'Smoke Supply Co (edited)', email: 'billing@smoke.test' },
    deleteCheck: 'ok',
  },
  {
    name: 'departments (Departments screen)',
    table: 'departments',
    idKey: 'id',
    create: { id: 'SMK-DEP-1', name: 'Smoke Department', head: 'Jordan Head' },
    update: { head: 'Casey Head (edited)' },
    deleteCheck: 'ok',
  },
  {
    name: 'items (Inventory screen)',
    table: 'items',
    idKey: 'barcode',
    create: {
      barcode: 'SCH999999',
      name: 'Smoke Item',
      category_id: 'SMK-CAT-1',
      brand: 'SmokeBrand',
      model: 'MK-1',
      description: 'Item created by the form smoke test',
      serial_number: 'SN-1',
      qty: 5,
      price: 12.5,
      purchase_date: '2026-10-10',
      supplier_id: 'SMK-SUP-1',
      department_location: 'Grade 10 Office',
      remark: 'Entered by the form smoke test',
    },
    defaults: { unit: 'Pc', status: 'Active', cost: 0, min_qty: 0 },
    update: { name: 'Smoke Item (edited)', qty: 9, price: 20.75, remark: 'Edited by the form smoke test' },
    deleteCheck: 'ok',
  },
  {
    name: 'purchases (Purchases screen)',
    table: 'purchases',
    idKey: 'id',
    create: {
      id: 'PO-2026-SMKT',
      supplier_id: 'SMK-SUP-1',
      invoice: 'INV-SMOKE-1',
      items_count: 3,
      total: 149.99,
    },
    defaults: { status: 'Pending' },
    update: { status: 'Received', invoice: 'INV-SMOKE-1-EDITED', total: 175.5 },
    deleteCheck: 'withheld',
  },
  {
    name: 'transactions (Transactions screen)',
    table: 'transactions',
    idKey: 'id',
    create: {
      id: 'TXN-SMKT1',
      item_barcode: 'SCH999999',
      item_name: 'Smoke Item',
      warehouse: 'SMK Warehouse',
      type: 'Stock In',
      qty: 5,
      ref: 'REF-SMOKE-1',
      remark: 'Recorded by the form smoke test',
    },
    update: { qty: 7, ref: 'REF-SMOKE-EDITED' },
    deleteCheck: 'withheld',
  },
  {
    name: 'requests (Requests screen)',
    table: 'requests',
    idKey: 'id',
    create: {
      id: 'REQ-SMKT1',
      dept: 'Smoke Department',
      item_name: 'Smoke Item',
      qty: 2,
      requested_by: 'Jordan Requester',
    },
    defaults: { status: 'Pending' },
    update: { status: 'Approved', qty: 4 },
    deleteCheck: 'withheld',
  },
  {
    name: 'audits (Audits screen)',
    table: 'audits',
    idKey: 'id',
    create: {
      id: 'AUD-SMKT1',
      warehouse: 'Smoke Warehouse',
      item_name: 'Smoke Item',
      system_qty: 10,
      physical_qty: 8,
    },
    defaults: { status: 'Pending' },
    update: { physical_qty: 10 },
    deleteCheck: 'withheld',
  },
  {
    name: 'maintenance (Maintenance screen)',
    table: 'maintenance',
    idKey: 'id',
    create: {
      id: 'MNT-SMKT1',
      item_name: 'Smoke Item',
      date: '2026-10-10',
      description: 'Service recorded by the form smoke test',
      cost: 42.5,
      status: 'Completed',
    },
    update: { status: 'In Progress', cost: 45.25 },
    deleteCheck: 'ok',
  },
]

function filterFor(spec) {
  return `${spec.idKey}=eq.${encodeURIComponent(spec.create[spec.idKey])}`
}

async function createAndEdit(spec) {
  console.log(spec.name)
  const filter = filterFor(spec)

  const created = await rest('POST', `${spec.table}?select=*`, spec.create)
  const row = Array.isArray(created.data) ? created.data[0] : null
  check('create returns the inserted row', created.ok && !!row)

  const mismatches = mismatched(row, spec.create)
  check(`every form field lands in ${spec.table}`, mismatches.length === 0)
  reportMismatches(mismatches)

  if (spec.defaults) {
    const bad = mismatched(row, spec.defaults)
    check(`column defaults fill ${Object.keys(spec.defaults).join(', ')}`, bad.length === 0)
    reportMismatches(bad)
  }

  const fetched = await rest('GET', `${spec.table}?select=*&${filter}`)
  check('read back by id', fetched.ok && Array.isArray(fetched.data) && fetched.data.length === 1)

  const edited = await rest('PATCH', `${spec.table}?${filter}`, spec.update)
  const editedRow = Array.isArray(edited.data) ? edited.data[0] : null
  check('edit returns the updated row', edited.ok && !!editedRow)

  const badEdits = mismatched(editedRow, spec.update)
  check('every edited field lands', badEdits.length === 0)
  reportMismatches(badEdits)
}

async function runDelete(spec) {
  if (spec.deleteCheck === 'none') return
  console.log(spec.name)
  const filter = filterFor(spec)
  const res = await rest('DELETE', `${spec.table}?${filter}`, undefined, spec.deleteCheck === 'withheld')

  if (spec.deleteCheck === 'withheld') {
    check('DELETE stays withheld (no screen deletes it)', res.status >= 400)
    return
  }

  check('delete removes the row', res.status === 204)
  const after = await rest('GET', `${spec.table}?select=*&${filter}`)
  check('row is gone after delete', after.ok && Array.isArray(after.data) && after.data.length === 0)
}

async function checkCompanySettings() {
  console.log('company_settings (kept, Settings screen)')
  const fetched = await rest('GET', 'company_settings?select=*&id=eq.1')
  const row = Array.isArray(fetched.data) ? fetched.data[0] : null
  check('row id 1 is readable', fetched.ok && !!row)

  const columns = ['name', 'address', 'phone', 'email', 'logo_path']
  check('every Settings column reads', row ? columns.every((c) => c in row) : false)

  if (row) {
    const saved = await rest('PATCH', 'company_settings?id=eq.1', {
      name: row.name,
      address: row.address,
      phone: row.phone,
      email: row.email,
      logo_path: row.logo_path,
      updated_at: new Date().toISOString(),
    })
    const savedRow = Array.isArray(saved.data) ? saved.data[0] : null
    check('the Settings save path writes the same values back', saved.ok && !!savedRow)
    const bad = mismatched(savedRow, { name: row.name, address: row.address, phone: row.phone, email: row.email, logo_path: row.logo_path })
    check('Settings values are unchanged by the save', bad.length === 0)
    reportMismatches(bad)
  }

  const deleted = await rest('DELETE', 'company_settings?id=eq.1', undefined, true)
  check('DELETE stays withheld (nothing deletes the settings row)', deleted.status >= 400)
}

async function main() {
  console.log('live smoke test: every screen table and form field, through the publishable key')
  console.log('DESTRUCTIVE: clears all rows in ten tables; company_settings keeps its row')
  console.log('\nrow counts before clearing')
  const before = await counts()
  console.table(before)

  await clear()
  const after = await counts()
  console.log('\nrow counts after clearing')
  console.table(after)
  check('every table except company_settings is empty', CLEAR_TABLES.every((t) => after[t] === 0))
  check('company_settings is untouched', after.company_settings === before.company_settings)

  console.log('\nevery table reads through the publishable key')
  for (const t of ALL_TABLES) {
    const res = await rest('GET', `${t}?select=*`)
    check(`${t} responds with rows`, res.ok && Array.isArray(res.data))
  }

  console.log('\ncreate, read back, then edit — the payload each screen submits')
  for (const spec of MODULES) await createAndEdit(spec)

  await checkCompanySettings()

  console.log('\ndelete paths')
  for (const spec of MODULES) await runDelete(spec)

  await clear()
  const final = await counts()
  console.log('\nrow counts after clearing the smoke test rows')
  console.table(final)
  check('every table except company_settings is empty again', CLEAR_TABLES.every((t) => final[t] === 0))
  check('company_settings still has its row', final.company_settings === before.company_settings)

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(1)
})
