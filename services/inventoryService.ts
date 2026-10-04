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

