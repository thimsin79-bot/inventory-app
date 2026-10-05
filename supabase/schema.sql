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
-- Roles
-- ==============================================================================
-- Four roles, descending:
--
--   viewer   read every table, change nothing
--   staff    + record movements, requests, audits and purchases
--   manager  + edit reference data (categories, warehouses, suppliers,
--             departments)
--   admin    + manage accounts and roles
--
-- Every policy names its roles explicitly instead of comparing a rank, so a role
-- added in one place but not the other matches nothing and fails closed, rather
-- than silently inheriting the top tier.
--
-- The role lives in `raw_app_meta_data` and reaches the policies through
-- `private.current_role()`. It must NOT be read from `user_metadata`, which the
-- account holder can rewrite via `supabase.auth.updateUser` -- that would let
-- anyone self-promote to admin. Only the Service Role key or the dashboard can
-- write `app_metadata`. `/admin/users` writes it through the Service Role after
-- an admin check.
--
-- Grant a role by hand (dashboard -> Authentication -> user -> app_metadata, or
-- the Management API):
--   UPDATE auth.users
--   SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"role":"staff"}'
--   WHERE email = 'alice@users.invalid';
--
-- An account with no role claim matches no policy below and sees zero rows,
-- which is the correct outcome for an unprivileged self-registered account.

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

-- ==============================================================================
-- Policies
-- ==============================================================================
-- Generated rather than written out longhand: nine tables times four commands is
-- thirty-six policies, and hand-maintained copies of the same two role lists are
-- exactly where a permission matrix rots. The lists below are the single source
-- of truth; `scripts/check-rls.mjs` diffs them against `lib/roles.ts`, which is
-- the client-side mirror the UI reads to decide which buttons to show.
--
-- Two policies per table:
--
--   read on <table>   SELECT, for anyone holding any role
--   write on <table>  INSERT / UPDATE / DELETE, for the roles that may modify it
--
-- `TO authenticated` drops the anonymous role entirely -- no policy below is in
-- force for `anon`, so a session-less request holding only the publishable key
-- matches nothing.
--
-- WITH CHECK is as load-bearing as USING here. Without it a caller could insert
-- a row, or update one, that the USING clause would never have let them see.

DO $policies$
DECLARE
  -- Reference data is org-wide configuration, changed rarely. Operational data
  -- is the day-to-day movement of stock and the paperwork around it.
  reference_tables   text[] := ARRAY['categories', 'suppliers', 'warehouses', 'departments'];
  operational_tables text[] := ARRAY['items', 'purchases', 'transactions', 'requests', 'audits'];
  all_tables         text[] := reference_tables || operational_tables;

  read_roles     text[] := ARRAY['admin', 'manager', 'staff', 'viewer'];
  reference_rw   text[] := ARRAY['admin', 'manager'];
  operational_rw text[] := ARRAY['admin', 'manager', 'staff'];

  t          text;
  writable   text[];
  read_literal text;
  rw_literal   text;
BEGIN
  read_literal := (
    SELECT string_agg(quote_literal(role), ', ' ORDER BY ord)
    FROM unnest(read_roles) WITH ORDINALITY AS u(role, ord)
  );

  FOREACH t IN ARRAY all_tables LOOP
    IF t = ANY (reference_tables) THEN
      writable := reference_rw;
    ELSE
      writable := operational_rw;
    END IF;

    -- Folded to a SQL literal once per table. Combined with the (SELECT ...)
    -- wrapper on current_role(), this keeps the role read as an InitPlan instead
    -- of re-evaluating auth.jwt() per row.
    rw_literal := (
      SELECT string_agg(quote_literal(role), ', ' ORDER BY ord)
      FROM unnest(writable) WITH ORDINALITY AS u(role, ord)
    );

    -- Drop first to keep this script re-runnable: a multi-statement script runs
    -- in one implicit transaction, so a single duplicate-policy error would roll
    -- all of it back. The pre-permission-matrix `staff_access on <table>` and
    -- `Allow public ...` policies are named here too, so re-running retires them.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'staff_access on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public read access on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public modifications on ' || t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'read on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'write on ' || t, t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT private.current_role()) = ANY (ARRAY[%s]))',
      'read on ' || t, t, read_literal
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.current_role()) = ANY (ARRAY[%s]))',
      'write on ' || t, t, rw_literal
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.current_role()) = ANY (ARRAY[%s])) WITH CHECK ((SELECT private.current_role()) = ANY (ARRAY[%s]))',
      'write on ' || t, t, rw_literal, rw_literal
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT private.current_role()) = ANY (ARRAY[%s]))',
      'write on ' || t, t, rw_literal
    );
  END LOOP;
END
$policies$;

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

-- No screen deletes a purchase, transaction, request or audit, and
-- `services/inventoryService.ts` exports no delete for them either -- so DELETE is
-- withheld rather than left to the policies alone. If a delete feature is ever
-- added for one of these, add the grant in the same change. `items` keeps DELETE
-- because the inventory screen does delete items.
GRANT SELECT, INSERT, UPDATE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.audits TO authenticated;

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
