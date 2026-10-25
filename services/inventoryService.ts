import { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { Database, Inserts, Updates } from '@/types/database.types'

type Client = SupabaseClient<Database>

function getClient(client?: Client): Client {
  return client ?? (createBrowserClient() as unknown as Client)
}

/**
 * `requests` and `purchases` both use a TEXT primary
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
  purchaseDate?: string
}) {
  const supabase = getClient(client)
  let query = supabase
    .from('items')
    .select(`
      *,
      category:categories(*),
      warehouse:warehouses(*),
      supplier:suppliers(*)
    `)
    .order('name', { ascending: true })

  if (options?.categoryId && options.categoryId !== 'all') {
    query = query.eq('category_id', options.categoryId)
  }

  if (options?.search) {
    query = query.or(`name.ilike.%${options.search}%,barcode.ilike.%${options.search}%,brand.ilike.%${options.search}%`)
  }

  if (options?.purchaseDate) {
    query = query.eq('purchase_date', options.purchaseDate)
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
 * Fetch maintenance history records
 */
export async function getMaintenance(client?: Client) {
  const supabase = getClient(client)
  const { data, error } = await supabase
    .from('maintenance')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw error
  if (!data) return []

  // If live table still has the legacy schema (description column instead of brand/model/etc),
  // parse the packaged metadata back into their respective fields so the UI displays them.
  return data.map((row) => {
    const raw = row as unknown as Record<string, unknown>
    if (raw.description && typeof raw.description === 'string' && !raw.brand && !raw.model && !raw.category) {
      const parts = raw.description.split(' | ')
      const meta: Record<string, string> = {}
      for (const part of parts) {
        const colonIdx = part.indexOf(': ')
        if (colonIdx !== -1) {
          const key = part.slice(0, colonIdx).trim()
          const val = part.slice(colonIdx + 2).trim()
          meta[key] = val
        }
      }
      return {
        ...row,
        brand: (raw.brand as string | null) ?? meta['Brand'] ?? null,
        model: (raw.model as string | null) ?? meta['Model'] ?? null,
        location: (raw.location as string | null) ?? meta['Location'] ?? null,
        serial_number: (raw.serial_number as string | null) ?? meta['Serial'] ?? null,
        category: (raw.category as string | null) ?? meta['Category'] ?? null,
        supplier_name: (raw.supplier_name as string | null) ?? meta['Supplier'] ?? null,
        department_name: (raw.department_name as string | null) ?? meta['Department'] ?? null,
        purchase_date: (raw.purchase_date as string | null) ?? meta['Purchase Date'] ?? null,
        remark: (raw.remark as string | null) ?? meta['Remark'] ?? (parts.length === 1 && !parts[0].includes(': ') ? parts[0] : null),
      }
    }
    return row
  })
}

/**
 * Create a maintenance history record
 */
export async function createMaintenance(record: Inserts<'maintenance'>, client?: Client) {
  const supabase = getClient(client)
  const id = nextId('MNT', 5)

  // Try standard insert with all expanded columns
  const { data, error } = await supabase
    .from('maintenance')
    .insert({ id, ...record })
    .select()
    .single()

  if (!error) return data

  // If live database has not run the ALTER TABLE migration yet (missing 'brand' column),
  // fall back to the live schema and pack the extra metadata into description so the record is not lost.
  if (error.message?.includes("'brand'") || error.message?.includes('schema cache')) {
    const details = [
      record.brand && `Brand: ${record.brand}`,
      record.model && `Model: ${record.model}`,
      record.location && `Location: ${record.location}`,
      record.serial_number && `Serial: ${record.serial_number}`,
      record.category && `Category: ${record.category}`,
      record.supplier_name && `Supplier: ${record.supplier_name}`,
      record.department_name && `Department: ${record.department_name}`,
      record.purchase_date && `Purchase Date: ${record.purchase_date}`,
      record.remark && `Remark: ${record.remark}`,
    ]
      .filter(Boolean)
      .join(' | ')

    const fallbackRecord: Record<string, unknown> = {
      id,
      item_name: record.item_name,
      date: record.date,
      cost: record.cost,
      status: record.status,
      description: details || null,
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('maintenance')
      .insert(fallbackRecord as unknown as Inserts<'maintenance'>)
      .select()
      .single()

    if (fallbackError) throw fallbackError
    return fallbackData
  }

  throw error
}

/**
 * Update a maintenance history record
 */
export async function updateMaintenance(id: string, updates: Updates<'maintenance'>, client?: Client) {
  const supabase = getClient(client)

  // Try standard update with all expanded columns
  const { data, error } = await supabase
    .from('maintenance')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (!error) return data

  // If live database has not run the ALTER TABLE migration yet (missing 'brand' column),
  // fall back to the live schema and pack the extra metadata into description.
  if (error.message?.includes("'brand'") || error.message?.includes('schema cache')) {
    const details = [
      updates.brand && `Brand: ${updates.brand}`,
      updates.model && `Model: ${updates.model}`,
      updates.location && `Location: ${updates.location}`,
      updates.serial_number && `Serial: ${updates.serial_number}`,
      updates.category && `Category: ${updates.category}`,
      updates.supplier_name && `Supplier: ${updates.supplier_name}`,
      updates.department_name && `Department: ${updates.department_name}`,
      updates.purchase_date && `Purchase Date: ${updates.purchase_date}`,
      updates.remark && `Remark: ${updates.remark}`,
    ]
      .filter(Boolean)
      .join(' | ')

    const fallbackRecord: Record<string, unknown> = {}
    if (updates.item_name !== undefined) fallbackRecord.item_name = updates.item_name
    if (updates.date !== undefined) fallbackRecord.date = updates.date
    if (updates.cost !== undefined) fallbackRecord.cost = updates.cost
    if (updates.status !== undefined) fallbackRecord.status = updates.status
    fallbackRecord.description = details || null

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('maintenance')
      .update(fallbackRecord as unknown as Updates<'maintenance'>)
      .eq('id', id)
      .select()
      .single()

    if (fallbackError) throw fallbackError
    return fallbackData
  }

  throw error
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

/**
 * Verify a username/password pair against the `login_user` database function.
 * The function returns just `ok` and a display name; password hashes never
 * leave the database. The /login page calls this and, on `ok`, writes the
 * client-side signed-in flag that gates the (app) screens.
 *
 * Usernames are matched case-insensitively by resolving the stored spelling
 * from `list_login_users` when the straight attempt fails, so `Sin` can sign in
 * as `sin` even on a database whose `login_user` still compares exactly.
 */
export async function loginUser(
  username: string,
  password: string,
  client?: Client,
): Promise<{ ok: boolean; display_name: string | null }> {
  const supabase = getClient(client)
  const attempt = async (name: string) => {
    const { data, error } = await supabase
      .rpc('login_user', { p_username: name, p_password: password })
      .maybeSingle()

    if (error) throw error
    return { ok: data?.ok ?? false, display_name: data?.display_name ?? null }
  }

  const direct = await attempt(username)
  if (direct.ok) return direct

  let canonical: string | null = null
  try {
    const users = await getLoginUsers(client)
    const lower = username.toLowerCase()
    canonical = users.find((u) => u.username.toLowerCase() === lower)?.username ?? null
  } catch {
    // A failed list call must not mask the credential answer below.
  }

  if (canonical && canonical !== username) return attempt(canonical)
  return direct
}

export type LoginUserRow = {
  username: string
  display_name: string | null
  created_at: string
}

/**
 * List the /login accounts (username, display name, created at) through the
 * `list_login_users` function. It never returns a password hash.
 */
export async function getLoginUsers(client?: Client): Promise<LoginUserRow[]> {
  const supabase = getClient(client)
  const { data, error } = await supabase.rpc('list_login_users')

  if (error) throw error
  return data ?? []
}

/**
 * Create a /login account. The password is hashed inside the database by
 * `create_login_user` (bcrypt via pgcrypto); the plaintext is sent over the
 * request and never stored. Returns false when the username is taken or the
 * password is too short (< 4 characters).
 *
 * Usernames are stored lowercased so sign-in is case-insensitive and two
 * casings can never become separate accounts.
 */
export async function createLoginUser(
  username: string,
  password: string,
  displayName?: string,
  client?: Client,
): Promise<boolean> {
  const supabase = getClient(client)
  const normalized = username.trim().toLowerCase()

  const existing = await getLoginUsers(client)
  if (existing.some((u) => u.username.toLowerCase() === normalized)) return false

  const { data, error } = await supabase.rpc('create_login_user', {
    p_username: normalized,
    p_password: password,
    p_display_name: displayName?.trim() || null,
  })

  if (error) throw error
  return data ?? false
}

/** Remove a /login account. Returns false if the username did not exist. */
export async function deleteLoginUser(username: string, client?: Client): Promise<boolean> {
  const supabase = getClient(client)
  const { data, error } = await supabase.rpc('delete_login_user', { p_username: username })

  if (error) throw error
  return data ?? false
}

