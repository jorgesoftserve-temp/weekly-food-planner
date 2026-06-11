-- =============================================================================
-- sys_grant_public_schema_privileges
--
-- Restores the standard Supabase role/privilege model on a clean DB.
--
-- Problem: Supabase normally bootstraps table grants during `supabase init` /
-- project provisioning. When migrations are the ONLY setup path (i.e. a clean
-- `supabase db reset`), those bootstrapped grants are absent and the three
-- application roles (anon, authenticated, service_role) end up with only
-- TRUNCATE, REFERENCES, TRIGGER on public tables -- not SELECT/INSERT/UPDATE/
-- DELETE.  This silently breaks the integration suite (service-role SELECTs
-- are denied) and would break any deployed environment started from scratch.
--
-- Security note: granting table-level DML to `anon` is correct and intentional
-- in the Supabase model.  RLS (enabled on every table in
-- 20260523000500_rls_enable_tables.sql) is the actual security boundary.  A
-- table-level grant without a matching RLS policy yields zero row access.  The
-- grants here are permissive at the table layer so RLS policies can be the
-- sole, auditable gating mechanism -- exactly as Supabase's hosted platform
-- operates.
-- =============================================================================

-- 1. Schema usage -- roles must be able to resolve objects in public.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. DML on all EXISTING tables (idempotent: GRANT is a no-op if already held).
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;

-- 3. Sequence access for any serial / uuid_generate_v4() surrogate keys.
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;

-- 4. Execute on all existing helper functions (fn_*, sys_*).
GRANT EXECUTE
  ON ALL FUNCTIONS IN SCHEMA public
  TO anon, authenticated, service_role;

-- 5. Default privileges so every FUTURE table/sequence/function created by
--    the `postgres` role (the role that migrations run as) also inherits these
--    grants automatically -- no separate grant migration needed when a new
--    table is added.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS
  TO anon, authenticated, service_role;
