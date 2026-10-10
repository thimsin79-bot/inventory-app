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
NOTIFY pgrst, 'reload schema';

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

-- 8. Requisitions / Requests
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

-- 9. Stock Audits
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

-- 10. Maintenance History
-- A simple log of servicing and repairs: who/what was maintained, when, and at
-- what cost. It is not tied to `items` by a foreign key -- the log keeps its own
-- item text so a record survives an item being renamed or deleted.
CREATE TABLE IF NOT EXISTS public.maintenance (
    id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PostgREST caches the schema it exposes; without this the API keeps answering
-- "Could not find the table 'public.maintenance' in the schema cache" until its
-- next automatic reload, even though the table exists.
NOTIFY pgrst, 'reload schema';

-- 11. Company Settings
-- Single-row configuration holding the school's identity (name, address,
-- contact, logo) shown across the app. The CHECK forces exactly one row and the
-- Settings screen upserts on id 1. `logo_path` names an object in the `logos`
-- storage bucket, not an external URL.
CREATE TABLE IF NOT EXISTS public.company_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name TEXT NOT NULL DEFAULT '',
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_path TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Logo storage. A public bucket so the logo serves without a signed URL; the
-- Settings screen uploads with the anon role, and the policies below are the
-- whole storage story for this bucket. The bucket insert is idempotent.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 5242880, ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

DROP POLICY IF EXISTS "logos public read" ON storage.objects;
DROP POLICY IF EXISTS "logos anon upload" ON storage.objects;
DROP POLICY IF EXISTS "logos anon update" ON storage.objects;
DROP POLICY IF EXISTS "logos anon delete" ON storage.objects;
CREATE POLICY "logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "logos anon upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'logos');
CREATE POLICY "logos anon update" ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'logos') WITH CHECK (bucket_id = 'logos');
CREATE POLICY "logos anon delete" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'logos');

-- PostgREST caches the schema it exposes; without this the API keeps answering
-- "Could not find the table 'public.company_settings' in the schema cache" until
-- its next automatic reload, even though the table exists.
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_items_barcode ON public.items (barcode);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_warehouse ON public.items (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_requests_date ON public.requests (date);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON public.maintenance (date);

-- ==============================================================================
-- Row Level Security (RLS) & Policies
-- ==============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- Policies
-- ==============================================================================
-- The app talks to the database with the public (publishable) key, and there is
-- no sign-in layer any more, so PostgREST presents every request as the `anon`
-- role. RLS stays enabled and the policies below are the whole truth about row
-- access: `TO anon USING (true)` / `WITH CHECK (true)` make the tables readable
-- and writable by anyone holding the publishable key, which is the intended
-- state of this build -- the Admin Console is the only gated part of the app,
-- and it is gated by the shared secret in the API layer, not here.
--
-- One policy per table per command -- four per table, generated rather than
-- written out longhand because ten tables times four commands is forty
-- statements to keep in step. Policy names are unique per table, so the three
-- write policies cannot share one name; each carries its command:
--
--   read on <table>            SELECT
--   write on <table> (insert)  INSERT
--   write on <table> (update)  UPDATE
--   write on <table> (delete)  DELETE
--
-- WITH CHECK is as load-bearing as USING. Without it a caller could insert a row,
-- or update one, that the USING clause would never have let them see.

DO $policies$
DECLARE
  all_tables text[] := ARRAY[
    'categories', 'suppliers', 'warehouses', 'departments',
    'items', 'purchases', 'requests', 'audits', 'maintenance',
    'company_settings'
  ];

  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    -- Drop every policy that already exists on the table. This script runs in
    -- one implicit transaction, so a single duplicate-policy error would roll
    -- all of it back, and a leftover policy from an earlier grant scheme would
    -- otherwise keep granting access next to the ones created below. Dropping
    -- by lookup rather than by name list also retires names this file has never
    -- heard of. Pre-2026-10-09 policies are named here too, so a re-run retires
    -- them even on a table where the lookup comes back empty.
    FOR p IN SELECT polname FROM pg_policy WHERE polrelid = format('public.%I', t)::regclass LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.polname, t);
    END LOOP;
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
      'write on ' || t || ' (insert)', t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO anon USING (true) WITH CHECK (true)',
      'write on ' || t || ' (update)', t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO anon USING (true)',
      'write on ' || t || ' (delete)', t
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
-- per table rather than via ALL TABLES IN SCHEMA public, to avoid handing a role
-- access to anything added later by accident.
--
-- Grants are additive, and the live database predates this file: earlier runs
-- left `anon` with every table privilege, including DELETE on the four tables
-- below and TRUNCATE / REFERENCES / TRIGGER anywhere -- none of which any screen
-- uses. A grant is invisible next to a policy, so revoking first is what makes
-- the GRANTs that follow the whole truth on any starting state. Both `anon` and
-- `authenticated` are revoked before anything is granted, so the GRANTs below
-- are the whole truth about who can touch the data.
REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.suppliers FROM anon;
REVOKE ALL ON public.warehouses FROM anon;
REVOKE ALL ON public.departments FROM anon;
REVOKE ALL ON public.items FROM anon;
REVOKE ALL ON public.purchases FROM anon;
REVOKE ALL ON public.requests FROM anon;
REVOKE ALL ON public.audits FROM anon;
REVOKE ALL ON public.maintenance FROM anon;
REVOKE ALL ON public.company_settings FROM anon;

REVOKE ALL ON public.categories FROM authenticated;
REVOKE ALL ON public.suppliers FROM authenticated;
REVOKE ALL ON public.warehouses FROM authenticated;
REVOKE ALL ON public.departments FROM authenticated;
REVOKE ALL ON public.items FROM authenticated;
REVOKE ALL ON public.purchases FROM authenticated;
REVOKE ALL ON public.requests FROM authenticated;
REVOKE ALL ON public.audits FROM authenticated;
REVOKE ALL ON public.maintenance FROM authenticated;
REVOKE ALL ON public.company_settings FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon;
-- The Maintenance screen deletes records, so it keeps DELETE too. The log is
-- append-only in spirit (a record of work done) but a mistyped entry is worth
-- being able to remove.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance TO anon;

-- The one limit beyond the anon/authenticated split: no screen deletes a
-- purchase, request or audit, and `services/inventoryService.ts`
-- exports no delete for them either -- so DELETE is withheld at the grant. If a
-- delete feature is ever added for one of these, add the grant in the same
-- change. `items` keeps DELETE because the inventory screen does delete items.
GRANT SELECT, INSERT, UPDATE ON public.purchases TO anon;
GRANT SELECT, INSERT, UPDATE ON public.requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.audits TO anon;
-- company_settings is written only by the Settings screen upserting on id 1;
-- nothing deletes the row, so DELETE is withheld like the three tables above.
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO anon;
