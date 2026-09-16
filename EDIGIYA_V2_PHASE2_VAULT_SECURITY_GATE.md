# Edigiya V2 — Supabase Vault Security Gate

## Decision

**VAULT GATE: BLOCKED**

The local project does not have a reliable read-only connection to the
production Supabase Dashboard or SQL metadata with which to verify Vault's
actual availability, enabled state, project/plan state, or live privileges.
The public application configuration is not sufficient evidence for those
checks. No Vault was enabled, no secret was created, and no database object was
modified.

Phase 2 remains blocked. This report deliberately does not infer a production
PASS from documentation or from the presence of a Supabase URL.

## 1. Official capability verified

Current official Supabase documentation states that Vault is a Postgres
extension and dashboard feature for storing encrypted secrets. It describes
authenticated encryption on disk, a `vault.secrets` table, and a
`vault.decrypted_secrets` view that decrypts values at query time. It also
explicitly warns that access to the decrypted view gives access to plaintext.

Source: [Supabase Vault documentation](https://supabase.com/docs/guides/database/vault)

The same documentation states that each project has its own root encryption
key, that same-project restores preserve the key, and that manual dump/restore
to another project requires the documented root-key portability procedure.
Those are documented capabilities, not live confirmation for Edigiya.

Supabase currently labels Vault as Public Alpha on its features page. That
feature maturity must be accepted explicitly for production use.

Source: [Supabase Vault feature page](https://supabase.com/features/vault)

Supabase's current pgsodium documentation says Supabase does not recommend
pgsodium-based approaches and recommends Vault instead. It also warns about the
operational complexity and misconfiguration risk of older transparent-column
encryption/server-key-management approaches.

Source: [Supabase pgsodium documentation](https://supabase.com/docs/guides/database/extensions/pgsodium)

## 2. Current project availability

### Verified locally

- The project has Supabase application configuration and a server-side service
  role key name.
- No local migration enables `supabase_vault` or creates a Vault wrapper.
- No application code references `vault.secrets`,
  `vault.decrypted_secrets`, or `vault.create_secret`.
- No local KMS/Vault client or secret-decryption boundary exists.
- No environment values were printed.

### Not verified

The following cannot be established from the local repository alone:

- whether Vault is enabled in the real project;
- whether the actual project/plan currently permits or exposes Vault;
- whether the `vault` schema exists remotely;
- whether `vault.secrets` and `vault.decrypted_secrets` exist remotely;
- current grants for `anon`, `authenticated`, `service_role`, `postgres`, or
  other roles;
- whether the Data API exposes any Vault object;
- whether the project's backup/restore procedure has been tested.

Therefore Check 1 is BLOCKED by missing live evidence.

## 3. Decrypted view and privilege model

The exact documented object name is `vault.decrypted_secrets`. The official
documentation says the view returns a decrypted value and must be protected,
but it does not establish the live Edigiya project's grants. Supabase's API
security documentation also states that RLS does not apply to functions and
that every `SECURITY DEFINER` function must be reviewed carefully.

Source: [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)

### Live answers currently available

| Principal/question | Result |
|---|---|
| Can `anon` query the decrypted view? | UNVERIFIED |
| Can `authenticated` query it? | UNVERIFIED |
| Can `service_role` query it? | UNVERIFIED; do not assume either outcome |
| Is it exposed through PostgREST? | UNVERIFIED |
| Can the access be revoked? | Documented as a privilege-management task, but not verified in this project |

The current gate cannot pass until these are checked in the actual project.

## 4. Server-only decryption boundary

A future boundary is feasible in PostgreSQL, but it has not been created or
tested. The safest model is:

`authorized server operation`
→ verify account/order or guest grant
→ verify paid + delivered state
→ verify order-item allocation
→ retrieve one Vault secret
→ return only through the authorized delivery response

If a `SECURITY DEFINER` function is used, the function must be placed in a
non-exposed schema, use a pinned empty `search_path`, schema-qualify every
object, have narrowly granted `EXECUTE`, and be revoked from `PUBLIC`, `anon`,
and `authenticated` unless those roles genuinely need it. Supabase's official
function guidance recommends `security invoker` by default and requires a
controlled `search_path` for `security definer` functions.

Sources:

- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Row Level Security guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase function privilege guidance](https://supabase.com/docs/guides/troubleshooting/how-can-i-revoke-the-execution-of-a-postgresql-function-2GYb0A)

This is a design conclusion, not a claim that the future function is safe
without a live privilege review.

## 5. Service-role threat analysis

The service role is not a harmless application key. Supabase documents that
secret/service-role keys bypass RLS and must remain only in secure,
developer-controlled backend components.

Source: [Supabase API keys and service-role access](https://supabase.com/docs/guides/getting-started/api-keys)

If `SUPABASE_SERVICE_ROLE_KEY` is compromised:

- the attacker may access all data permitted by the role's table/function
  grants, including any Vault decryption path that is granted to it;
- RLS cannot be relied upon to contain the incident;
- a narrow Vault function can reduce accidental exposure through normal app
  paths, but cannot make a compromised role harmless if that role can invoke
  the function or read the decrypted view;
- the key must be revoked/rotated and the incident audited.

The future architecture must avoid generic `select *` access to Vault and must
not grant customer-facing roles any Vault privileges.

## 6. Secret creation and retrieval

Official documentation describes `vault.create_secret(...)` as a supported
creation mechanism and `vault.decrypted_secrets` as the documented retrieval
view. No real secret was created during this review.

Creation risks that must be controlled operationally:

- never paste production credential values into committed SQL files;
- avoid storing secret values in migration history or shared SQL editor
  snippets;
- keep Vault metadata names/descriptions non-sensitive;
- ensure SQL/editor/audit logging does not capture secret-bearing statements;
- use a restricted server/admin workflow for creation.

The future application should return only an opaque Vault ID in ordinary unit
metadata. The decrypted value must be read only inside a narrowly authorized
server operation. RLS on ordinary tables does not by itself secure the
decrypted view.

## 7. Rotation and versioning

Separate the two concepts:

### A. Vault/project encryption key

Supabase documentation describes a per-project root key managed outside the
database and explains portability/restore behavior. This must be validated in
the actual project's Dashboard and recovery procedure.

### B. Business secret replacement

Vault does not automatically rotate Netflix passwords, license keys, or other
business payloads. Edigiya must manage business-secret versioning, replacement,
revocation, and allocation state. A business secret should have an opaque
version/reference and a lifecycle independent of the project root-key lifecycle.

No claim of automatic Netflix credential rotation is made.

## 8. Backup and restore

Official Supabase documentation states that same-project pause/restore and
point-in-time/in-place restores retain the project key, while manual migration
to a new project requires the documented root-key portability process. Edigiya
must additionally preserve:

- the project reference and Vault configuration;
- secret references and business-version metadata;
- restricted recovery ownership;
- a tested restore procedure in a non-production project;
- a rule forbidding plain `pg_dump`/`pg_restore` assumptions for Vault data.

This is documented behavior, not a completed Edigiya disaster-recovery test.

## 9. Environment separation

The required operating model is:

- separate Development Supabase project/Vault;
- separate QA Supabase project/Vault with fake credentials;
- separate Production Supabase project/Vault with production-only access.

Production credentials and service-role keys must never be used in development
or committed to the repository. No environment was changed in this review.

## 10. Manual verification required to open the gate

An operator with the actual Supabase project access must perform these
read-only checks in the production Dashboard/SQL Editor without creating a
real secret:

1. Database → Extensions: confirm whether Vault is available and whether it is
   enabled; record the project plan/feature state and the Public Alpha risk
   acceptance.
2. SQL Editor: inspect the existence and owner of `vault.secrets` and
   `vault.decrypted_secrets` using catalog metadata only. Do not select secret
   payload columns.
3. Inspect grants for the two Vault objects and any Vault functions for
   `PUBLIC`, `anon`, `authenticated`, `service_role`, and the owning role.
4. Inspect Data API exposed schemas and verify the `vault` schema is not
   exposed to customer-facing PostgREST.
5. Verify that no customer-facing role can execute a decryption function or
   query `vault.decrypted_secrets`.
6. Confirm whether the production project supports the documented Vault key
   recovery/portability procedure and assign a recovery owner.
7. Repeat the same checks in separate Development and QA projects.

Example metadata-only checks, to be run by the operator in the actual project
and reviewed before execution:

```sql
select n.nspname as schema_name, c.relname as object_name, c.relkind,
       pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'vault'
  and c.relname in ('secrets', 'decrypted_secrets');

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'vault'
  and table_name in ('secrets', 'decrypted_secrets')
order by table_name, grantee, privilege_type;
```

These queries inspect metadata/privileges only; they do not retrieve secret
values. If the objects do not exist, or if any customer-facing role can read
the decrypted view, the gate remains blocked.

## 11. Files inspected and changes

Inspected:

- `EDIGIYA_V2_COMMERCE_ARCHITECTURE.md`
- `EDIGIYA_V2_IMPLEMENTATION_READINESS.md`
- `EDIGIYA_V2_PHASE1_FINAL_VERIFICATION.md`
- `EDIGIYA_V2_PHASE2_FINAL_VERIFICATION.md`
- `supabase/migrations/20260908_digital_fulfillment_foundation.sql` through
  `20260914_inventory_movement_writer_fix.sql`
- `lib/repositories.ts`
- `app/admin/actions.ts`
- `app/(store)/actions.ts`
- `app/(store)/account/orders/[id]/page.tsx`

Created only:

- `EDIGIYA_V2_PHASE2_VAULT_SECURITY_GATE.md`

No source code, migration, package, environment, Supabase object, or secret
was changed.

## Final decision

The documented Vault architecture is potentially suitable, and a narrow
server-only boundary is conceptually feasible. However, the critical live
facts required by the gate—availability, enablement, plan state, actual grants,
PostgREST exposure, and recovery readiness—remain unverified.

VAULT GATE: BLOCKED

PHASE 2 REMAINS BLOCKED UNTIL THE MANUAL LIVE CHECKS PASS.
