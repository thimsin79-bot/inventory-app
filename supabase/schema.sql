-- ==============================================================================
-- Inventory Management System - Supabase Schema
-- Run this in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    manager TEXT,
    capacity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Departments
CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    head TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Items (Inventory)
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    brand TEXT,
    model TEXT,
    description TEXT,
    serial_number TEXT,
    unit TEXT NOT NULL DEFAULT 'Pc',
    cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    min_qty INTEGER NOT NULL DEFAULT 0,
    qty INTEGER NOT NULL DEFAULT 0,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
    department_location TEXT,
    purchase_date DATE,
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Columns added after the first deploy. `CREATE TABLE IF NOT EXISTS` above is a
-- no-op on a database that already has `items`, so these ALTERs are what actually
-- apply the new fields to the live table. Each is idempotent: a re-run of this
-- file is expected (see CLAUDE.md section 5).
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS department_location TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS remark TEXT;

-- PostgREST caches the schema it exposes; without this the API keeps answering
-- "Could not find the 'x' column of 'items' in the schema cache" until its next
-- automatic reload, even though the column exists.
NOTIFY pgrst 'reload schema';

-- 7. Purchases
CREATE TABLE IF NOT EXISTS public.purchases (
    id TEXT PRIMARY KEY,
    supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice TEXT,
    items_count INTEGER DEFAULT 0,
    total NUMERIC(10,2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    item_barcode TEXT NOT NULL,
    item_name TEXT NOT NULL,
    warehouse TEXT,
    type TEXT NOT NULL,
    qty INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    ref TEXT,
    remark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Requisitions / Requests
CREATE TABLE IF NOT EXISTS public.requests (
    id TEXT PRIMARY KEY,
    dept TEXT NOT NULL,
    item_name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    requested_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Stock Audits
CREATE TABLE IF NOT EXISTS public.audits (
    id TEXT PRIMARY KEY,
    warehouse TEXT NOT NULL,
    item_name TEXT NOT NULL,
    system_qty INTEGER NOT NULL,
    physical_qty INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_items_barcode ON public.items (barcode);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_warehouse ON public.items (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transactions_barcode ON public.transactions (item_barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);
CREATE INDEX IF NOT EXISTS idx_requests_date ON public.requests (date);

-- ==============================================================================
-- Row Level Security (RLS) & Policies
-- ==============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- Policies
-- ==============================================================================
-- There is no authentication and no role ladder. The app talks to the database
-- with the publishable key, which PostgREST presents as the `anon` role, so every
-- request from this application is an `anon` request and there is nothing in the
-- JWT to branch on.
--
-- That means these policies grant `anon` full read and write on all nine tables.
-- **They are not a security boundary.** Anyone who can reach the Supabase project
-- can read and write all of it. The only gate in front of this app is Vercel
-- Deployment Protection (Project Settings -> Deployment Protection), which
-- 302s anonymous traffic to Vercel SSO. If that is switched off, or the Supabase
-- project is reached directly, the data is open. The policies below exist so the
-- app functions, not so it is safe.
--
-- Two policies per table, generated rather than written out longhand because nine
-- tables times four commands is thirty-six statements to keep in step:
--
--   read on <table>   SELECT
--   write on <table>  INSERT / UPDATE / DELETE
--
-- `TO anon` rather than the default `TO public`, so the grant is an accurate
-- statement about who this is for. It also fails closed: if accounts are ever
-- reintroduced, a signed-in `authenticated` request matches nothing until the
-- policies are revisited deliberately.
--
-- WITH CHECK is as load-bearing as USING. Without it a caller could insert a row,
-- or update one, that the USING clause would never have let them see.

DO $policies$
DECLARE
  all_tables text[] := ARRAY[
    'categories', 'suppliers', 'warehouses', 'departments',
    'items', 'purchases', 'transactions', 'requests', 'audits'
  ];

  t text;
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    -- Drop first to keep this script re-runnable: a multi-statement script runs
    -- in one implicit transaction, so a single duplicate-policy error would roll
    -- all of it back. The role-ladder and pre-role-ladder policies are named here
    -- too, so re-running retires them.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'staff_access on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public read access on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public modifications on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'read on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'write on ' || t, t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
      'read on ' || t, t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO anon WITH CHECK (true)',
      'write on ' || t, t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO anon USING (true) WITH CHECK (true)',
      'write on ' || t, t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO anon USING (true)',
      'write on ' || t, t
    );
  END LOOP;
END
$policies$;

-- The `private` schema and `private.current_role()` are dropped: with no roles
-- there is nothing for the function to read. Dropping rather than leaving them
-- means a re-run cannot be silently shadowed by a leftover claim check.
DROP FUNCTION IF EXISTS private.current_role();
DROP SCHEMA IF EXISTS private CASCADE;

-- ==============================================================================
-- Table grants
-- ==============================================================================
-- RLS is not sufficient on its own: Postgres evaluates grants first, and a role
-- with no table grant gets `permission denied for table` regardless of policy.
-- Supabase stopped auto-exposing new public-schema tables to the Data API
-- (enforced for all projects on 2026-10-30), so these are granted explicitly
-- per table rather than via ALL TABLES IN SCHEMA public, to avoid handing `anon`
-- access to anything added later by accident.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon;

-- The one limit that survives the removal of roles: no screen deletes a purchase,
-- transaction, request or audit, and `services/inventoryService.ts` exports no
-- delete for them either -- so DELETE is withheld rather than left to the
-- policies alone. If a delete feature is ever added for one of these, add the
-- grant in the same change. `items` keeps DELETE because the inventory screen
-- does delete items.
GRANT SELECT, INSERT, UPDATE ON public.purchases TO anon;
GRANT SELECT, INSERT, UPDATE ON public.transactions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.audits TO anon;

-- `authenticated` is granted nothing, so an account that still exists in the
-- Supabase project from before cannot be used as a way in.
REVOKE ALL ON public.categories FROM authenticated;
REVOKE ALL ON public.suppliers FROM authenticated;
REVOKE ALL ON public.warehouses FROM authenticated;
REVOKE ALL ON public.departments FROM authenticated;
REVOKE ALL ON public.items FROM authenticated;
REVOKE ALL ON public.purchases FROM authenticated;
REVOKE ALL ON public.transactions FROM authenticated;
REVOKE ALL ON public.requests FROM authenticated;
REVOKE ALL ON public.audits FROM authenticated;
