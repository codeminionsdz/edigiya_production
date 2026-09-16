-- Metadata-only verification for 20260920.
-- Do not query vault.decrypted_secrets.secret or decrypted_secret.

SELECT p.oid::regprocedure AS function_signature,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'create_or_replace_digital_unit_secret';

SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'create_or_replace_digital_unit_secret'
ORDER BY grantee, privilege_type;

SELECT table_name, row_security
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('digital_inventory_units', 'digital_unit_secret_versions');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('digital_inventory_units', 'digital_unit_secret_versions')
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
  'public.digital_inventory_units'::regclass,
  'public.digital_unit_secret_versions'::regclass
)
ORDER BY table_name, conname;

SELECT indexrelid::regclass AS index_name, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('digital_inventory_units', 'digital_unit_secret_versions')
ORDER BY index_name;

-- Runtime testing requires isolated QA data and an approved Vault key UUID.
-- Never place a real secret in this script. With zero units, mark runtime
-- create/replace testing NOT TESTABLE rather than creating production rows.
