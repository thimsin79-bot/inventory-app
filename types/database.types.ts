export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          company: string
          contact: string | null
          phone: string | null
          email: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company: string
          contact?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company?: string
          contact?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          id: string
          name: string
          location: string | null
          manager: string | null
          capacity: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          manager?: string | null
          capacity?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          manager?: string | null
          capacity?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          name: string
          head: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          head?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          head?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          id: string
          barcode: string
          name: string
          category_id: string | null
          brand: string | null
          model: string | null
          description: string | null
          serial_number: string | null
          unit: string
          cost: number
          price: number
          min_qty: number
          qty: number
          warehouse_id: string | null
          supplier_id: string | null
          department_location: string | null
          purchase_date: string | null
          remark: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          barcode: string
          name: string
          category_id?: string | null
          brand?: string | null
          model?: string | null
          description?: string | null
          serial_number?: string | null
          unit?: string
          cost?: number
          price?: number
          min_qty?: number
          qty?: number
          warehouse_id?: string | null
          supplier_id?: string | null
          department_location?: string | null
          purchase_date?: string | null
          remark?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          barcode?: string
          name?: string
          category_id?: string | null
          brand?: string | null
          model?: string | null
          description?: string | null
          serial_number?: string | null
          unit?: string
          cost?: number
          price?: number
          min_qty?: number
          qty?: number
          warehouse_id?: string | null
          supplier_id?: string | null
          department_location?: string | null
          purchase_date?: string | null
          remark?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      purchases: {
        Row: {
          id: string
          supplier_id: string | null
          date: string
          invoice: string | null
          items_count: number
          total: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          supplier_id?: string | null
          date?: string
          invoice?: string | null
          items_count?: number
          total?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string | null
          date?: string
          invoice?: string | null
          items_count?: number
          total?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          id: string
          item_barcode: string
          item_name: string
          warehouse: string | null
          type: string
          qty: number
          date: string
          ref: string | null
          remark: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_barcode: string
          item_name: string
          warehouse?: string | null
          type: string
          qty: number
          date?: string
          ref?: string | null
          remark?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_barcode?: string
          item_name?: string
          warehouse?: string | null
          type?: string
          qty?: number
          date?: string
          ref?: string | null
          remark?: string | null
          created_at?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          id: string
          dept: string
          item_name: string
          qty: number
          date: string
          requested_by: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          dept: string
          item_name: string
          qty: number
          date?: string
          requested_by: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          dept?: string
          item_name?: string
          qty?: number
          date?: string
          requested_by?: string
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      audits: {
        Row: {
          id: string
          warehouse: string
          item_name: string
          system_qty: number
          physical_qty: number
          date: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          warehouse: string
          item_name: string
          system_qty?: number
          physical_qty?: number
          date?: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          warehouse?: string
          item_name?: string
          system_qty?: number
          physical_qty?: number
          date?: string
          status?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

