# EDIGIYA V2 — 20260917 Live Verification

## Scope

Live application and verification were attempted only through the installed
Supabase CLI. No manual SQL fallback, database reset, migration change, Vault
secret creation/read, or production-data deletion was performed.

## Preflight

| Check | Result |
|---|---|
| Project directory | `C:\Users\codem\OneDrive\project\egygiya` |
| CLI version | `2.116.0` |
| Local migration | `supabase/migrations/20260917_digital_unit_allocation_rpc.sql` |
| Local SHA-256 | `8E52957F5CFE7B903DDB041FFB2AFF0E573F7C76E5912B4AF31FE5EE2A8F7171` |
| `supabase/config.toml` | Not present |
| Linked project | **NONE** |
| `supabase status` | `linked_project: null`; local status also requires Docker/Podman |
| Remote migration history | Not checked because no project is linked |

The CLI is authenticated and `projects list` works, but no listed project is
linked to this working directory. No project reference was invented and no
`supabase link` command was run.

## Migration application

**NOT APPLIED.** The required precondition for safely applying a migration
through the CLI is a linked project. The process stopped before any remote
mutation.

## Live verification matrix

| Area | Result | Evidence/limitation |
|---|---|---|
| RPC exists and signature | NOT TESTABLE | No linked remote project |
| SECURITY DEFINER/search_path | NOT TESTABLE LIVE | Local migration defines `SECURITY DEFINER`, `SET search_path = ''` |
| Grants | NOT TESTABLE LIVE | No remote SQL execution |
| Valid allocation | NOT TESTABLE | Migration not applied |
| Idempotency | NOT TESTABLE | Migration not applied |
| Duplicate unit protection | NOT TESTABLE | Migration not applied |
| Slot protection | NOT TESTABLE | Migration not applied |
| Concurrency | NOT TESTABLE | Migration not applied |
| State validation | NOT TESTABLE | Migration not applied |
| Relationship validation | NOT TESTABLE | Migration not applied |
| Atomic rollback | NOT TESTABLE | Migration not applied |
| Phase 1 regression | NOT TESTABLE LIVE | No remote verification |
| Cleanup | NOT APPLICABLE | No QA rows were created |

## Short live verification attempt

The requested SQL Editor/live Supabase verification could not be executed in
this session because no Supabase SQL Editor connector or browser-control tool
was available. Supabase CLI was intentionally not used, as requested.

Consequently, no QA rows were created, no RPC was called, no Vault secret was
created or read, and no cleanup mutation was needed. The following checks
remain unverified here: RPC catalog definition, grants, valid allocation,
idempotency, duplicate-unit rejection, invalid-allocation rollback, and final
QA-row count.

## Final status

**BLOCKED** — live SQL Editor access/results are required before declaring
`20260917 = VERIFIED`. No 20260918 work was started.
