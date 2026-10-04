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
    unit TEXT NOT NULL DEFAULT 'Pc',
    cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    min_qty INTEGER NOT NULL DEFAULT 0,
    qty INTEGER NOT NULL DEFAULT 0,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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
-- Access model
-- ==============================================================================
-- Data access is role-gated, not merely authenticated. A signed-in user with no
-- role claim gets zero rows.
--
-- The role lives in `raw_app_meta_data`, which only the service role and the
-- dashboard can write. It must NOT be read from `user_metadata`, because that
-- is user-editable and would let anyone self-promote to admin.
--
-- Grant a role to a user (dashboard -> Authentication -> user -> app_metadata,
-- or the Management API):
--   {"role": "staff"}   read + write
--   {"role": "admin"}   read + write
--
-- `/signup` is open by default, so an unprivileged account can be created by
-- anyone. That is acceptable here *only* because no role is attached to it --
-- a self-registered account matches no policy below. Disable open signup in
-- the dashboard (Authentication -> Sign In / Providers -> email -> "Allow
-- new users to sign up" off) so the surface is not there at all.

-- Kept out of `public` so it is not part of the Data API surface. SECURITY
-- INVOKER (the default) on purpose: it reads the caller's own JWT and grants
-- nothing, so it cannot be used to escalate.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role'),
    ''
  );
$$;

-- Postgres has no CREATE POLICY IF NOT EXISTS, so drop first to keep this
-- script re-runnable. A multi-statement script runs in one implicit
-- transaction, so a single duplicate-policy error would roll all of it back.
-- The old `Allow public ...` policies are dropped by name so re-running this
-- script also retires them.
DROP POLICY IF EXISTS "Allow public read access on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public read access on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow public read access on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Allow public read access on departments" ON public.departments;
DROP POLICY IF EXISTS "Allow public read access on items" ON public.items;
DROP POLICY IF EXISTS "Allow public read access on purchases" ON public.purchases;
DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public read access on requests" ON public.requests;
DROP POLICY IF EXISTS "Allow public read access on audits" ON public.audits;

DROP POLICY IF EXISTS "Allow public modifications on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public modifications on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow public modifications on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Allow public modifications on departments" ON public.departments;
DROP POLICY IF EXISTS "Allow public modifications on items" ON public.items;
DROP POLICY IF EXISTS "Allow public modifications on purchases" ON public.purchases;
DROP POLICY IF EXISTS "Allow public modifications on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public modifications on requests" ON public.requests;
DROP POLICY IF EXISTS "Allow public modifications on audits" ON public.audits;

DROP POLICY IF EXISTS "staff_access on categories" ON public.categories;
DROP POLICY IF EXISTS "staff_access on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "staff_access on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "staff_access on departments" ON public.departments;
DROP POLICY IF EXISTS "staff_access on items" ON public.items;
DROP POLICY IF EXISTS "staff_access on purchases" ON public.purchases;
DROP POLICY IF EXISTS "staff_access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "staff_access on requests" ON public.requests;
DROP POLICY IF EXISTS "staff_access on audits" ON public.audits;

-- `TO authenticated` drops the anonymous role entirely: no policy below is in
-- force for `anon`, so a session-less request using only the publishable key
-- matches nothing. WITH CHECK is required on the write half as well -- without
-- it a caller could insert or reassign rows that the USING clause never saw.
CREATE POLICY "staff_access on categories" ON public.categories FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

CREATE POLICY "staff_access on suppliers" ON public.suppliers FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

CREATE POLICY "staff_access on warehouses" ON public.warehouses FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

CREATE POLICY "staff_access on departments" ON public.departments FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

CREATE POLICY "staff_access on items" ON public.items FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

CREATE POLICY "staff_access on purchases" ON public.purchases FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

CREATE POLICY "staff_access on transactions" ON public.transactions FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

CREATE POLICY "staff_access on requests" ON public.requests FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

CREATE POLICY "staff_access on audits" ON public.audits FOR ALL TO authenticated
  USING ((SELECT private.current_role()) IN ('admin', 'staff'))
  WITH CHECK ((SELECT private.current_role()) IN ('admin', 'staff'));

-- ==============================================================================
-- Table grants
-- ==============================================================================
-- RLS is not sufficient on its own: Postgres evaluates grants first, and a role
-- with no table grant gets `permission denied for table` regardless of policy.
-- Supabase stopped auto-exposing new public-schema tables to the Data API
-- (enforced for all projects on 2026-10-30), so these are granted explicitly
-- per table rather than via ALL TABLES IN SCHEMA public, to avoid handing the
-- authenticated role access to anything added later by accident.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;

REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.suppliers FROM anon;
REVOKE ALL ON public.warehouses FROM anon;
REVOKE ALL ON public.departments FROM anon;
REVOKE ALL ON public.items FROM anon;
REVOKE ALL ON public.purchases FROM anon;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.requests FROM anon;
REVOKE ALL ON public.audits FROM anon;

-- Same protection for tables created after this script runs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
