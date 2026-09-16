# 20260928 LIVE VERIFICATION REPORT

## Result

**BLOCKED — live migration was not applied.**

No production data, digital units, Vault secrets, or application code were modified during this attempt.

## Preflight

| Check | Result |
|---|---|
| Supabase CLI | PASS — `2.116.0` |
| CLI authentication | PASS — `supabase projects list` returned projects |
| Current project linked | FAIL — `LegacyProjectNotLinkedError: Cannot find project ref` |
| Local status inspection | NOT AVAILABLE — Docker/Podman is not installed |
| Target migration exists | PASS |
| Environment host | `mkhostvmnhjznmxngfap.supabase.co` |
| Authenticated project list contains that ref | FAIL — it was not returned |

The CLI listed `opvaowcuowunvmcwzkgk` and `vmntieotirkjwgmthhvz`, both unlinked. Neither matches the project URL configured in `.env.local`. Linking or pushing to either project would risk applying the migration to the wrong database, so no link or push was attempted.

## Migration application

`20260928_digital_inventory_admin_operations.sql`: **NOT APPLIED / NOT VERIFIED LIVE**.

No `supabase link`, `supabase db push`, reset, manual SQL mutation, or fallback database mutation was performed.

## Verification matrix

| Area | Result |
|---|---|
| Migration success | BLOCKED — target project unavailable to CLI |
| Admin page/source | NOT LIVE TESTED |
| Credential creation | NOT RUNTIME TESTABLE — zero units and no live target |
| Code creation | NOT RUNTIME TESTABLE — zero units and no live target |
| Variant validation | NOT RUNTIME TESTABLE |
| Idempotency | STRUCTURALLY REVIEWED; LIVE NOT VERIFIED |
| Rotation | NOT RUNTIME TESTABLE |
| Disable/revoke | NOT RUNTIME TESTABLE |
| RLS/security | STRUCTURALLY REVIEWED; LIVE NOT VERIFIED |
| Browser secret exposure | STATIC PASS; LIVE RESPONSE NOT VERIFIED |
| Vault boundary | STATIC PASS — existing `create_or_replace_digital_unit_secret` is reused |
| Allocation compatibility | STATIC PASS — no allocation functions changed; live not verified |
| Fulfillment compatibility | STATIC PASS — no fulfillment functions changed; live not verified |

## Required manual resolution

Authenticate/link the CLI to the correct Supabase project whose ref matches the intended live URL, or provide the correct project reference through the established project-owner workflow. Do not use either listed ref unless it is confirmed to be the Edigiya target. After the correct link is established, rerun the migration preflight and live verification package.

## Local validation already recorded

- `npm run build`: PASS.
- `npx tsc --noEmit`: only pre-existing errors in `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and `nutrition-erp/src/...`.
- `git diff --check`: PASS.
- `npm run lint`: existing project issue; `next lint` is rejected by Next.js 16.

