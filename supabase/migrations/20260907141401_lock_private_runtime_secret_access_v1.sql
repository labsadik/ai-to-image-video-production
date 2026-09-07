-- Keep the private runtime secret store inaccessible to all client/public roles.
-- The table is accessed only through server-owned SECURITY DEFINER functions.
-- Applied to Supabase project yyeidanzflitrstvooxw as migration
-- 20260907141401_lock_private_runtime_secret_access_v1.

BEGIN;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON TABLE private.runtime_secrets FROM PUBLIC;
REVOKE ALL ON TABLE private.runtime_secrets FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;
