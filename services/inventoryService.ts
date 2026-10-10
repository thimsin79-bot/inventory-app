import { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { Database, Inserts, Updates } from '@/types/database.types'

type Client = SupabaseClient<Database>

function getClient(client?: Client): Client {
  return client ?? (createBrowserClient() as unknown as Client)
}

/**
 * `transactions`, `requests`, `audits` and `purchases` all use a TEXT primary
 * key with no column default (only `items.id` has one), so an id has to be
 * supplied on insert. Generating it here keeps the format in one place instead
 * of every caller inventing its own.
 */
function nextId(prefix: string, length: number): string {
  // Excludes I/O/0/1 to avoid transcription mistakes when read off a screen.
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${prefix}-${out}`
}

/**
 * Fetch all inventory items, optionally filtered by category or search term
 */
export async function getInventoryItems(client?: Client, options?: {
  categoryId?: string
  search?: string
}) {
  const supabase = getClient(client)
  let query = supabase
    .from('items')
    .select(`
      *,
      category:categories(*),
      warehouse:warehouses(*)
    `)
    .order('name', { ascending: true })

  if (options?.categoryId && options.categoryId !== 'all') {
    query = query.eq('category_id', options.categoryId)
  }

  if (options?.search) {
    query = query.or(`name.ilike.%${options.search}%,barcode.ilike.%${options.search}%,brand.ilike.%${options.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Fetch an item by its barcode
 */
export async function getItemByBarcode(barcode: string, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      category:categories(*),
      warehouse:warehouses(*)
    `)
    .eq('barcode', barcode)
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch all categories
 */
export async function getCategories(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Create a category. The id is generated here because the column has no default.
 */
export async function createCategory(category: Inserts<'categories'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('categories')
    .insert({ id: nextId('CAT', 4), ...category })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update a category
 */
export async function updateCategory(id: string, updates: Updates<'categories'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a category. Fails if any inventory item still references it (FK), and
 * that Postgres error is surfaced to the caller.
 */
export async function deleteCategory(id: string, client?: Client) {
  const supabase = getClient(client)
  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) throw error
  return true
}

/**
 * Fetch all warehouses / store locations
 */
export async function getWarehouses(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Fetch all suppliers
 */
export async function getSuppliers(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('company', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Create a supplier. The id is generated here because the column has no default.
 */
export async function createSupplier(supplier: Inserts<'suppliers'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ id: nextId('SUP', 4), ...supplier })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update a supplier
 */
export async function updateSupplier(id: string, updates: Updates<'suppliers'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a supplier. Fails if a purchase order or item still references it, and
 * that Postgres error is surfaced to the caller.
 */
export async function deleteSupplier(id: string, client?: Client) {
  const supabase = getClient(client)
  const { error } = await supabase.from('suppliers').delete().eq('id', id)

  if (error) throw error
  return true
}

/**
 * Fetch recent inventory transactions
 */
export async function getTransactions(client?: Client, limit = 50) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

/**
 * Fetch requisitions / requests
 */
export async function getRequests(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Next free barcode for a new item.
 *
 * The item form does not ask for a barcode, so the create path calls this
 * instead. Barcodes are `SCH` plus a zero-padded number, which keeps them in
 * numeric order lexically, so one descending read finds the top one. Two
 * concurrent creates can still collide on the unique constraint; the loser
 * gets the Postgres error surfaced by `createItem` and can retry.
 */
export async function nextBarcode(client?: Client): Promise<string> {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('items')
    .select('barcode')
    .like('barcode', 'SCH%')
    .order('barcode', { ascending: false })
    .limit(1)

  if (error) throw error

  const top = data?.[0]?.barcode ?? ''
  const highest = Number.parseInt(top.slice(3), 10)
  const next = Number.isNaN(highest) ? 1 : highest + 1
  return `SCH${String(next).padStart(6, '0')}`
}

/**
 * Create a new inventory item
 */
export async function createItem(item: Inserts<'items'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('items')
    .insert(item)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update an existing inventory item
 */
export async function updateItem(id: string, updates: Updates<'items'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete an inventory item
 */
export async function deleteItem(id: string, client?: Client) {
  const supabase = getClient(client)
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

/**
 * Record a stock transaction
 */
export async function recordTransaction(transaction: Inserts<'transactions'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('transactions')
    .insert({ id: nextId('TXN', 6), ...transaction })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch all departments
 */
export async function getDepartments(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Create a department. The id is generated here because the column has no default.
 */
export async function createDepartment(department: Inserts<'departments'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('departments')
    .insert({ id: nextId('DEP', 4), ...department })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update a department
 */
export async function updateDepartment(id: string, updates: Updates<'departments'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('departments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a department. Requests store the department by name, not id, so there is
 * no foreign key to block this.
 */
export async function deleteDepartment(id: string, client?: Client) {
  const supabase = getClient(client)
  const { error } = await supabase.from('departments').delete().eq('id', id)

  if (error) throw error
  return true
}

/**
 * Fetch purchase orders
 */
export async function getPurchases(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('purchases')
    .select(`
      *,
      supplier:suppliers(*)
    `)
    .order('date', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Create a purchase order
 */
export async function createPurchase(purchase: Inserts<'purchases'>, client?: Client) {
  const supabase = getClient(client)
  const year = new Date().getFullYear()
  const { data, error } = await supabase
    .from('purchases')
    .insert({ id: nextId(`PO-${year}`, 4), ...purchase })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update a purchase order (e.g. change status)
 */
export async function updatePurchase(id: string, updates: Updates<'purchases'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('purchases')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch stock audits
 */
export async function getAudits(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Create a stock audit
 */
export async function createAudit(audit: Inserts<'audits'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('audits')
    .insert({ id: nextId('AUD', 5), ...audit })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch maintenance history records
 */
export async function getMaintenance(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('maintenance')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Create a maintenance history record
 */
export async function createMaintenance(record: Inserts<'maintenance'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('maintenance')
    .insert({ id: nextId('MNT', 5), ...record })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a maintenance history record
 */
export async function deleteMaintenance(id: string, client?: Client) {
  const supabase = getClient(client)
  const { error } = await supabase
    .from('maintenance')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

/**
 * Fetch the single company/org configuration row (Settings). Returns null when
 * supabase/seed.sql has not run yet.
 */
export async function getCompanySettings(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Save the company/org configuration row. Upserts on id 1, so the first save
 * creates the row and every subsequent save updates it.
 */
export async function saveCompanySettings(settings: Updates<'company_settings'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('company_settings')
    .upsert({ id: 1, ...settings, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Upload a logo into the public `logos` bucket and return its object path for
 * `company_settings.logo_path`. Files are named by timestamp so a re-upload does
 * not collide or linger in a browser cache.
 */
export async function uploadCompanyLogo(file: File, client?: Client) {
  const supabase = getClient(client)
  const extension = (file.name.match(/\.(\w+)$/)?.[1] ?? 'png').toLowerCase()
  const path = `school-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

/**
 * Public URL for a logo object in the `logos` bucket. Cheap: getPublicUrl is
 * pure URL construction and never makes a network request.
 */
export function companyLogoUrl(path: string | null): string | null {
  if (!path) return null
  return getClient().storage.from('logos').getPublicUrl(path).data.publicUrl
}

/**
 * Create a requisition request
 */
export async function createRequest(request: Inserts<'requests'>, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('requests')
    .insert({ id: nextId('REQ', 5), ...request })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Change the status of a requisition request
 */
export async function updateRequestStatus(id: string, status: string, client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

