# Edigiya V2 — Phase 2 Secret Management Architecture Review

## 1. Executive recommendation

### RECOMMENDED ARCHITECTURE: Supabase Vault with a server-only, least-privilege database boundary

For the current Next.js + Supabase/Postgres stack, the most practical primary
architecture is to keep unique credential/code payloads in Supabase Vault and
keep only non-secret unit metadata and allocation state in ordinary application
tables.

Supabase documents Vault as a Postgres extension and dashboard feature that
stores secrets in authenticated encrypted form. The encryption key is kept
outside the database by Supabase's project key-management system, and the
decrypted view must be protected because access to that view exposes plaintext.
See the [official Supabase Vault documentation](https://supabase.com/docs/guides/database/vault).

This recommendation is conditional, not an implementation approval. Vault must
be enabled and its privileges verified in the target project before Phase 2
secret storage is implemented. It is currently not enabled or integrated in the
local project, and no secret-bearing migration should be created yet.

The project remains:

**PHASE 2 STATUS: BLOCKED — awaiting security architecture approval**

## 2. Current findings

The local environment names include Supabase URL/publishable access, a
`SUPABASE_SERVICE_ROLE_KEY`, Admin secrets, and Telegram settings. No dedicated
application encryption key, KMS integration, Vault integration, or encryption
library was found. Values were not printed.

The existing `fulfillment_items.code TEXT` column stores manually entered codes
as plaintext, and `lib/repositories.ts:getCustomerFulfillmentItems` returns the
code after the current paid-and-delivered checks. This existing path must not be
reused as the unique-secret inventory design.

Phase 1 is not redesigned by this review. Its atomic product/variant stock
reservation remains the authoritative quantity foundation, with
`create_order_payment_atomic`, `consume_inventory_reservation`, and
`release_inventory_reservation` owning the reserved/consumed/released movement
path.

## 3. Threat model

| Threat | Required control |
|---|---|
| Customer reads another customer's credential | Server checks authenticated account or guest delivery authorization against the order and allocation; client IDs are never authorization. |
| Guessable order ID or anonymous access | No direct table read; use an expiring, revocable, hashed guest grant or authenticated account ownership. |
| Client changes order/item/unit IDs | Server derives the relationship from the authorized order and locks/validates it in the database transaction. |
| Admin API abuse | Existing Admin session verification remains mandatory; new actions must authorize server-side and never trust a client role flag. |
| Database read exposure | Ordinary unit tables contain no plaintext; Vault access is denied to public, anon, authenticated, and generic Data API paths. |
| Service-role compromise | It remains a serious incident: service role bypasses RLS and any explicitly granted Vault/decryption function could be abused. Minimize grants, isolate decryption, rotate the compromised credential, and audit access. |
| Application-server compromise | A server that is allowed to decrypt can expose plaintext during the request. Keep the decrypting code path narrow, never log payloads, and do not return secrets in generic APIs. |
| Logs/analytics/errors | Log only unit/order IDs and event types; redact request bodies and provider errors; never include payloads. |
| Backup/dump exposure | Keep only ciphertext/opaque Vault references in application tables. Follow Vault's documented project-key portability and restore procedure. |
| Key rotation failure | Use versioned secret references and an explicit rotation/re-encryption runbook before production use. |
| Duplicate allocation/replay | Unique allocation constraint plus a database RPC locked by order item and unit state; idempotency key is tied to the order item. |

## 4. Option comparison

### A. Application-level encryption with a dedicated key

- Security model: the application encrypts before writing and decrypts only on
  the server.
- Plaintext: exists in the Admin request, server memory, and delivery response;
  it must never enter logs, analytics, HTML, or ordinary API responses.
- Ciphertext: Postgres application tables and backups.
- Key: a dedicated secret outside Postgres, supplied only to the server runtime.
- Decryptors: the production server process and any operator with that secret.
- RLS: useful for metadata, but RLS cannot protect data from a server using the
  service role; the decrypting endpoint still needs explicit authorization.
- Service-role compromise: does not automatically reveal ciphertext without the
  encryption key, but a combined app/key compromise does.
- Rotation/versioning: must be designed and implemented by Edigiya, including
  key versions and re-encryption of old rows.
- Backup/restore: backups are recoverable only if key material and versions are
  preserved separately and securely.
- Complexity/cost: low infrastructure cost and easy for a small team, but high
  responsibility for cryptographic correctness and operations.
- Suitability: possible, but not suitable for this project now because the
  required key, rotation, recovery, and cryptographic implementation do not
  exist.

### B. Supabase Vault

- Security model: Vault stores authenticated-encrypted secrets on disk and
  exposes decrypted values through a view for authorized database use. The
  official docs explicitly warn that access to the decrypted view grants access
  to the plaintext.
- Plaintext: only in the controlled database query result and the eventual
  server-side delivery response; it must never be exposed through PostgREST,
  public product reads, logs, or generic events.
- Ciphertext: Vault-managed secret rows and database backups/replication,
  according to the official documentation.
- Key: a per-project root key managed in Supabase's secured backend systems; the
  official docs describe root-key retrieval/portability and restore behavior.
- Decryptors: only explicitly authorized database functions/roles and the
  server path that invokes them.
- RLS: RLS is not enough for Vault. Revoke public/anon/authenticated access to
  Vault objects and expose only narrowly scoped `SECURITY DEFINER` functions,
  with fixed `search_path`, strict ownership checks, and no generic secret
  query.
- Service-role compromise: still high impact if the service role can invoke a
  decryption function or query the decrypted view. Vault reduces database-dump
  exposure but does not make an authorized decrypting backend harmless.
- Rotation/versioning: Supabase manages the project root key, but the product
  still needs a secret version/reference policy and a tested operational plan
  for credential replacement. Do not claim automatic business-secret rotation.
- Backup/restore: same-project restore keeps the key according to the docs;
  manual dump/restore to a new project requires the documented key-portability
  procedure. This must be part of disaster recovery.
- Complexity/cost: lowest fit for the current stack because it stays in
  Supabase/Postgres, but Vault is currently described by Supabase as Public
  Alpha, so availability and operational maturity require explicit acceptance.
- Suitability: strongest practical fit for early Edigiya once enabled and
  reviewed; suitable for unique codes and credentials if the decrypt boundary
  is kept server-only.

### C. External managed secret manager/KMS

- Security model: ciphertext remains in Postgres while a cloud KMS/secret
  manager controls key use through a separate identity and policy boundary.
- Plaintext: server memory and the final authorized delivery response.
- Ciphertext: Postgres; key material remains in the external provider.
- Key/decryptors: external KMS policy and the production workload identity.
- RLS: protects metadata only; external authorization must also be correct.
- Service-role compromise: stronger isolation from the database alone, unless
  the attacker also obtains the workload identity or KMS permission.
- Rotation/versioning: generally robust, but exact behavior depends on the
  selected provider and must be documented from that provider's official docs.
- Backup/restore: requires preserving ciphertext, key identifiers/versions, and
  the external account/policy; recovery is impossible if the external key is
  destroyed.
- Complexity/cost: highest operational and vendor complexity; workload identity,
  networking, monitoring, and disaster recovery are not currently established
  in this project.
- Suitability: best for a larger production operation or a team already using a
  cloud KMS, not the smallest practical first step for this Supabase-only
  deployment.

### D. Plaintext Postgres or Supabase Storage

Rejected. Private Storage protects file access but does not solve secret
management, and plaintext Postgres violates the requirements for credentials
and unique codes. The service-role key is not an encryption key.

### E. `pgcrypto`/custom `pgsodium` as the product secret store

Not selected as the primary architecture. Supabase currently says `pgsodium`
is pending deprecation and recommends Vault instead; it also warns against the
older transparent-column-encryption/server-key-management approach due to
operational complexity and misconfiguration risk. See the [official pgsodium
documentation](https://supabase.com/docs/guides/database/extensions/pgsodium).

## 5. Recommended architecture

Use two deliberately separate layers:

1. A normal application table for non-secret unit metadata: product/variant,
   unit type, status, allocation identity, timestamps, and a Vault secret ID.
2. One Vault secret per unique credential/code payload, or one Vault secret per
   encrypted payload bundle only if the access and rotation semantics are fully
   documented. The normal table must never contain the raw credential/code.

The application should call a narrow server-only operation that:

- validates Admin authorization for adding or disabling a unit;
- validates order/order-item ownership before delivery;
- locks the Phase 1 reservation/order item and candidate unit;
- allocates one available unit exactly once;
- records only opaque IDs and non-secret audit metadata;
- decrypts only after authorization and only for the final delivery response;
- redacts all logs and errors.

No customer-facing generic product query, order list, analytics event, Telegram
message, Messenger message, or payment event may include a secret or Vault
decrypted value.

## 6. Key-management model

- Master/root key: Supabase-managed project Vault root key, not stored in the
  application database and never copied into `.env.local`.
- Application key: none should be invented or derived from
  `SUPABASE_SERVICE_ROLE_KEY`.
- Key version: store an opaque Vault secret ID plus an application-level secret
  version/reference in metadata; do not expose the reference to customers.
- Rotation: rotate/reissue product credentials as business data changes; for
  platform key portability or project migration, follow Supabase's documented
  root-key procedure. Test restore before production.
- Old data: never silently discard old secrets. Keep old versions only while
  required, mark them revoked/retired, and re-encrypt or re-store them through a
  controlled migration when the approved rotation procedure requires it.
- Environment separation: development/test must use a separate Supabase
  project/Vault and fake credentials. Developers must not receive production
  Vault access or production service-role credentials.
- Approval gate: before implementation, verify Vault availability in the actual
  project, supported plan/feature state, role privileges, backup/restore
  behavior, and an operator recovery path.

## 7. Secret lifecycle

`available unit metadata` → `reserved` → `allocated` → `consumed/delivered`,
with `released` on an eligible rollback/rejection and `disabled/revoked` as a
terminal administrative state. The secret itself is read only after the related
order item is authorized and the unit allocation is locked.

The state transition must be one database-authoritative transaction. A retry
returns the existing allocation for the same order item; it does not allocate a
second unit. A concurrent request locks the same candidate row and only one
transaction can move it out of `available`.

## 8. Authorization and delivery model

Account customer: require the authenticated account-to-order relationship,
paid payment, and delivered/eligible fulfillment before returning content.

Guest: require a short-lived, revocable, hashed delivery grant tied to the
specific order and allocation. An order ID alone is never sufficient.

The preferred future email content is a secure Edigiya delivery link rather than
raw credentials in email. The link opens a server-authorized, one-purpose
delivery response. If raw secret display is required, it must be generated only
after the same authorization checks and must not be cached or logged.

Email is intentionally not implemented in this review. Telegram/Messenger
remain support channels and must never contain unique secrets.

## 9. Conceptual database model

Names are illustrative only; no tables were created.

- `digital_inventory_units`: product/variant, unit type, non-secret status,
  Vault secret reference, timestamps, disabled/revoked metadata.
- `digital_unit_allocations`: unique unit + order item relationship, allocation
  state, idempotency key, reservation/consumption timestamps.
- Optional `digital_delivery_grants`: hashed guest grant, order/allocation
  relationship, expiry, revocation, redemption metadata.

Required invariants include one active allocation per unit, one allocation per
eligible order item/quantity, product/variant consistency, no client write
access, and audit metadata that contains no secret values.

## 10. Phase 1 integration

Do not create a second stock source. For unique-unit products, unit availability
must be reconciled with the Phase 1 product/variant quantity. The safe design
decision to approve before coding is either:

- unique units are authoritative and Phase 1 stock becomes a maintained
  projection, updated in the same transaction; or
- Phase 1 stock remains authoritative for quantity and unique-unit allocation
  is required to match the reserved quantity in the same transaction.

The implementation must choose one explicitly and enforce the invariant; it
must not allow `products.stock = 10` while only two valid units exist without a
database-enforced reconciliation rule. Phase 1 RPCs and movement semantics
must remain unchanged until that design is approved.

## 11. Disaster recovery and operational requirements

- Separate development, QA, and production Supabase projects/Vaults.
- Record the project reference, Vault availability, role grants, and recovery
  owner in restricted operational documentation.
- Test same-project restore and new-project migration before production use.
- Do not use `pg_dump`/`pg_restore` for Vault data without following the official
  root-key portability procedure.
- Rotate Supabase service-role and Admin secrets independently of Vault secret
  payloads.
- Add redaction tests for logs, error responses, analytics, payment events, and
  order APIs.
- Add allocation replay/concurrency tests before any READY status.

## 12. Risks and mitigations

- Vault Public Alpha status: accept only after a project-level feature and
  restore test; otherwise choose an external KMS.
- Service-role compromise: keep Vault decryption grants narrow and isolate the
  decrypting function; rotate credentials after any incident.
- Existing plaintext manual codes: do not migrate them automatically into a
  new secret system without an explicit migration, redaction, and access plan.
- Guest bearer links: hash grants, expire and revoke them, rate-limit access,
  and bind them to one order/allocation.
- Duplicate allocation: database locks, unique constraints, and idempotent RPC.
- Key/project migration: preserve Vault key portability data and test recovery.

## 13. Exact prerequisites before implementation

1. Approve Supabase Vault as the primary architecture, or explicitly choose an
   external KMS instead.
2. Confirm Vault is available and enabled in the real Supabase project.
3. Verify that public, anon, authenticated, and generic service paths cannot
   read `vault.decrypted_secrets`.
4. Define the single authorized server-side decryption boundary.
5. Define secret versioning, revocation, project separation, backup, restore,
   and incident rotation procedures.
6. Decide and document the single inventory source of truth for unique units
   versus Phase 1 stock.
7. Approve the conceptual unit/allocation/grant schema before creating a
   `20260915_*` migration.
8. Create isolated QA credentials and a redaction/concurrency test plan.

## Final decision

No source code, migration, package, environment, or Supabase change was made.

RECOMMENDED ARCHITECTURE: Supabase Vault with a server-only, least-privilege database boundary

PHASE 2 STATUS: BLOCKED — awaiting security architecture approval
