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
          location: string | null
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
          location?: string | null
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
          location?: string | null
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
      maintenance: {
        Row: {
          id: string
          item_name: string
          date: string
          description: string | null
          cost: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          item_name: string
          date?: string
          description?: string | null
          cost?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          item_name?: string
          date?: string
          description?: string | null
          cost?: number
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          id: number
          name: string
          address: string | null
          phone: string | null
          email: string | null
          logo_path: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_path?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          username: string
          password_hash: string
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          username: string
          password_hash: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          username?: string
          password_hash?: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      login_user: {
        Args: {
          p_username: string
          p_password: string
        }
        Returns: {
          ok: boolean
          display_name: string | null
        }[]
      }
      list_login_users: {
        Args: Record<string, never>
        Returns: {
          username: string
          display_name: string | null
          created_at: string
        }[]
      }
      create_login_user: {
        Args: {
          p_username: string
          p_password: string
          p_display_name: string | null
        }
        Returns: boolean
      }
      delete_login_user: {
        Args: {
          p_username: string
        }
        Returns: boolean
      }
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

