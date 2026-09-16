# 20260930 Live Verification Package

Run only after setting the server-side provider configuration in the deployment environment. Never paste credentials into SQL, source control, client variables, or chat.

## 1. Configuration preflight

Confirm only variable presence, never values:

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY` set server-side
- `EMAIL_FROM` set to a verified sender
- optional `EMAIL_REPLY_TO`
- existing `NEXT_PUBLIC_SITE_URL` and `GUEST_DELIVERY_TOKEN_SECRET` set for guest jobs

If these are absent, mark runtime checks **NOT RUNTIME TESTABLE — EMAIL PROVIDER NOT CONFIGURED**.

## 2. Outbox and worker structural checks

```sql
select to_regclass('public.digital_email_outbox') as outbox_table,
       to_regprocedure('public.claim_digital_email_outbox_job(text,integer)') as claim_rpc,
       to_regprocedure('public.mark_digital_email_outbox_sent(uuid,uuid)') as sent_rpc,
       to_regprocedure('public.mark_digital_email_outbox_failed(uuid,uuid,text,timestamptz)') as failed_rpc;

select count(*) as unsafe_payload_rows
from public.digital_email_outbox
where payload ?| array['secret','code','credential','password','decrypted_secret','vault_secret_id','guest_token'];

select count(*) as duplicate_idempotency_keys
from (select idempotency_key from public.digital_email_outbox group by idempotency_key having count(*) > 1) duplicates;
```

Expected: all objects exist, `unsafe_payload_rows = 0`, and `duplicate_idempotency_keys = 0`.

## 3. Controlled worker success

Use one existing approved outbox job addressed to a safe test recipient. Do not create fake production orders or units. Run the server-only worker once and verify:

- one job is claimed with a lease;
- provider returns success;
- exactly that job becomes `sent`;
- no secret or provider credential appears in logs or response data.

Run the same worker again and confirm no second send occurs for the sent job.

## 4. Controlled provider failure

With a deliberately invalid provider configuration in an isolated environment, run one eligible job and verify it becomes retryable `failed` with a safe error code and future retry time. Restore the valid configuration afterward. Never log the provider response body or key.

## 5. Concurrency and lease recovery

Run two server workers against the same pending outbox queue. Verify the same row cannot be claimed by both active leases. Simulate an expired lease and verify a later worker can reclaim it. Confirm lease-token checks prevent an old worker from marking a newer lease sent/failed.

## 6. Content safety

Inspect the captured test message and confirm:

- guest message contains only the existing secure delivery URL;
- account message points to the account/library experience;
- no raw credential/code, Vault UUID, Vault value, or token is present outside the intended opaque guest URL;
- French and Arabic templates render correctly when safe locale metadata is available.

No payment, inventory, allocation, reservation, fulfillment, Vault or SlickPay runtime mutation is part of this package.

