# 20260916 — CLI Live Verification

## Final status

**BLOCKED**

The official Supabase CLI is now installed as a project dependency, but the
project is not linked. Per the requested safety rules, linking was not performed
on the user's behalf because it may prompt for the remote database password.

## CLI preflight and installation

Project directory checked:

`C:\Users\codem\OneDrive\project\egygiya`

Initial global CLI result:

```text
supabase command not found on PATH

Installation method: official Supabase npm package via pnpm project dependency.

Installed version:

`supabase 2.116.0`

Verified executable:

`node_modules\\.bin\\supabase.cmd --version` → `2.116.0`

The package install returned exit code 1 only because pnpm blocked an unrelated
existing `sharp` build script under the workspace build policy. The Supabase
CLI binary itself is present and runs successfully. No `sharp` build approval
was granted.
```

These checks are now available:

- project CLI version;
- CLI project listing/authentication check.

CLI project listing succeeded, confirming stored CLI authentication. The
configured application project ref is `mkhostvmnhjznmxngfap`, but it was not
present in the authenticated CLI project list. This ref was read from the
existing `NEXT_PUBLIC_SUPABASE_URL` hostname; no secret value was printed.

The local project is not linked and has no `supabase/config.toml`. Migration
history, remote schema inspection, and remote SQL execution therefore remain
unavailable.

## Migration file

Target file exists locally:

`supabase/migrations/20260916_digital_unit_allocation_foundation.sql`

Local SHA-256:

`28D1F4E3718F70838B200D262453FEA379720F29288DE52D57465AD002015AB1`

Whether this migration is already applied remotely is **UNVERIFIED** because
the CLI could not run.

## Link required before application

Run this exact command manually from the project directory:

```powershell
cd C:\Users\codem\OneDrive\project\egygiya
& '.\\node_modules\\.bin\\supabase.cmd' link --project-ref mkhostvmnhjznmxngfap
```

If prompted for the remote database password, enter it yourself or leave it
blank only if the CLI permits linking without database validation. Do not send
the password, access token, 2FA code, or any other credential to the agent.

After linking, stop and provide the command output before any `db push` or
verification is attempted.

## Application result

- Migration applied remotely: **NO — not attempted**.
- Migration modified: **NO**.
- New migration created: **NO**.
- Database reset: **NO**.
- Existing production data changed: **NO**.
- Vault secrets created or read: **NO**.
- Phase 1 migrations/RPCs changed: **NO**.
- `20260917` started: **NO**.

## Verification matrix

| Check | Result | Evidence/limitation |
|---|---|---|
| CLI version | BLOCKED | `supabase` command not found on PATH |
| CLI authentication | NOT TESTABLE | CLI unavailable |
| Linked project | NOT TESTABLE | CLI unavailable |
| Migration not already applied | NOT TESTABLE | Migration history unavailable |
| Migration application | BLOCKED | Not attempted |
| Allocation table/schema | NOT TESTABLE | No remote SQL path |
| Constraints/FKs | NOT TESTABLE | No remote SQL path |
| Indexes/unique constraints | NOT TESTABLE | No remote SQL path |
| Validation triggers | NOT TESTABLE | No remote SQL path |
| RLS/grants | NOT TESTABLE | No remote SQL path |
| Runtime allocation tests | NOT TESTABLE | No safe remote execution path |
| Phase 1 regression check | NOT TESTABLE | No remote SQL path |
| QA cleanup | NOT TESTABLE | No QA rows created by this attempt |
| Vault safety | PASS for this attempt | No Vault secret was created or read |

## Worktree note

The repository already contains unrelated user changes and previously created
Phase 2/Phase 1 documentation and migrations. This attempt added only this
verification report; it did not modify those existing files.

## Required next step

Manually run the link command above, then provide its result. Do not mark
`20260916` VERIFIED based on this report, and do not proceed to `20260917`.
