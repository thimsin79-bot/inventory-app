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

-- Postgres has no CREATE POLICY IF NOT EXISTS, so drop first to keep this
-- script re-runnable. A multi-statement script runs in one implicit
-- transaction, so a single duplicate-policy error would roll all of it back.
DROP POLICY IF EXISTS "Allow public read access on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public read access on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow public read access on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Allow public read access on departments" ON public.departments;
DROP POLICY IF EXISTS "Allow public read access on items" ON public.items;
DROP POLICY IF EXISTS "Allow public read access on purchases" ON public.purchases;
DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public read access on requests" ON public.requests;
DROP POLICY IF EXISTS "Allow public read access on audits" ON public.audits;

-- Allow public read access (for anon & authenticated users)
CREATE POLICY "Allow public read access on categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access on suppliers" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Allow public read access on warehouses" ON public.warehouses FOR SELECT USING (true);
CREATE POLICY "Allow public read access on departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Allow public read access on items" ON public.items FOR SELECT USING (true);
CREATE POLICY "Allow public read access on purchases" ON public.purchases FOR SELECT USING (true);
CREATE POLICY "Allow public read access on transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow public read access on requests" ON public.requests FOR SELECT USING (true);
CREATE POLICY "Allow public read access on audits" ON public.audits FOR SELECT USING (true);

-- WARNING (SECURITY): these grant the anon/publishable key full INSERT/UPDATE/
-- DELETE on every table. The publishable key ships in the client bundle, so
-- anyone who loads the site can rewrite all inventory data. Replace with
-- `TO authenticated` + a role check before this project is exposed to a
-- network you do not control.
DROP POLICY IF EXISTS "Allow public modifications on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public modifications on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow public modifications on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Allow public modifications on departments" ON public.departments;
DROP POLICY IF EXISTS "Allow public modifications on items" ON public.items;
DROP POLICY IF EXISTS "Allow public modifications on purchases" ON public.purchases;
DROP POLICY IF EXISTS "Allow public modifications on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public modifications on requests" ON public.requests;
DROP POLICY IF EXISTS "Allow public modifications on audits" ON public.audits;

-- Allow public modifications during development
CREATE POLICY "Allow public modifications on categories" ON public.categories FOR ALL USING (true);
CREATE POLICY "Allow public modifications on suppliers" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "Allow public modifications on warehouses" ON public.warehouses FOR ALL USING (true);
CREATE POLICY "Allow public modifications on departments" ON public.departments FOR ALL USING (true);
CREATE POLICY "Allow public modifications on items" ON public.items FOR ALL USING (true);
CREATE POLICY "Allow public modifications on purchases" ON public.purchases FOR ALL USING (true);
CREATE POLICY "Allow public modifications on transactions" ON public.transactions FOR ALL USING (true);
CREATE POLICY "Allow public modifications on requests" ON public.requests FOR ALL USING (true);
CREATE POLICY "Allow public modifications on audits" ON public.audits FOR ALL USING (true);
