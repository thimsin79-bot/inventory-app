import type { Database } from './database.types'

export type Category = Database['public']['Tables']['categories']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type Warehouse = Database['public']['Tables']['warehouses']['Row']
export type Department = Database['public']['Tables']['departments']['Row']
export type Item = Database['public']['Tables']['items']['Row']
export type Purchase = Database['public']['Tables']['purchases']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type Request = Database['public']['Tables']['requests']['Row']
export type Audit = Database['public']['Tables']['audits']['Row']

export interface ItemWithRelations extends Item {
  category?: Category | null
  warehouse?: Warehouse | null
}

export type ItemStatus = 'Active' | 'Low Stock' | 'Out of Stock' | 'Discontinued'
export type TransactionType = 'Stock In' | 'Stock Out' | 'Transfer' | 'Adjustment' | 'Return Out'
export type RequestStatus = 'Pending' | 'Approved' | 'Issued' | 'Rejected' | 'Returned'
export type PurchaseStatus = 'Received' | 'Pending' | 'Partial' | 'Cancelled'
export type AuditStatus = 'Matched' | 'Adjusted' | 'Pending'

