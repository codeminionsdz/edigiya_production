# 20260926 Live Verification Package

Migration: `supabase/migrations/20260926_email_worker_lease_recovery.sql`

Run in Supabase SQL Editor. These checks are read-only. Do not configure a provider, send email, create digital units, or create/read Vault secrets.

## 1. Function existence and definitions

```sql
select
  to_regprocedure('public.claim_digital_email_outbox_job(text,integer)') as claim_rpc,
  to_regprocedure('public.mark_digital_email_outbox_sent(uuid,uuid)') as sent_rpc,
  to_regprocedure('public.mark_digital_email_outbox_failed(uuid,uuid,text,timestamptz)') as failed_rpc;
```

Expected: all values are non-NULL.

```sql
select p.oid::regprocedure as routine,
       p.prosecdef as security_definer,
       p.proconfig as settings,
       pg_get_function_result(p.oid) as return_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('claim_digital_email_outbox_job', 'mark_digital_email_outbox_sent', 'mark_digital_email_outbox_failed')
order by 1;
```

Expected: SECURITY DEFINER is true and settings contain `search_path=`.

## 2. Lease-recovery definition

```sql
select pg_get_functiondef(
  'public.claim_digital_email_outbox_job(text,integer)'::regprocedure
) as claim_function_definition;
```

Expected: the definition includes `FOR UPDATE SKIP LOCKED`, pending/failed eligibility, and expired `processing` lease eligibility using `lease_until <= now()`.

## 3. Grants and outbox RLS

```sql
select
  has_function_privilege('public.claim_digital_email_outbox_job(text,integer)', 'execute') as public_claim,
  has_function_privilege('anon', 'public.claim_digital_email_outbox_job(text,integer)', 'execute') as anon_claim,
  has_function_privilege('authenticated', 'public.claim_digital_email_outbox_job(text,integer)', 'execute') as authenticated_claim,
  has_function_privilege('service_role', 'public.claim_digital_email_outbox_job(text,integer)', 'execute') as service_claim,
  has_function_privilege('public.mark_digital_email_outbox_sent(uuid,uuid)', 'execute') as public_sent,
  has_function_privilege('anon', 'public.mark_digital_email_outbox_sent(uuid,uuid)', 'execute') as anon_sent,
  has_function_privilege('authenticated', 'public.mark_digital_email_outbox_sent(uuid,uuid)', 'execute') as authenticated_sent,
  has_function_privilege('service_role', 'public.mark_digital_email_outbox_sent(uuid,uuid)', 'execute') as service_sent;
```

Expected: public/anon/authenticated are false; service_role is true.

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'digital_email_outbox';
```

Expected: `relrowsecurity = true`.

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'digital_email_outbox'
order by grantee, privilege_type;
```

Expected: no PUBLIC, anon, or authenticated grants; service_role has required access.

## 4. Outbox integrity and secret exclusion

```sql
select count(*) as invalid_outbox_rows
from public.digital_email_outbox e
left join public.orders o on o.id = e.order_id
left join public.order_items oi on oi.id = e.order_item_id
where o.id is null
   or (e.order_item_id is not null and (oi.id is null or oi.order_id is distinct from e.order_id))
   or e.payload ?| array['secret','decrypted_secret','password','credential','credentials','code','vault_secret_id','guest_token','delivery_token','token'];
```

Expected: `0`.

```sql
select idempotency_key, count(*) as duplicate_count
from public.digital_email_outbox
group by idempotency_key
having count(*) > 1;
```

Expected: no rows.

## 5. Runtime boundary

```sql
select count(*) as digital_inventory_units
from public.digital_inventory_units;
```

Expected current result: `0`.

Worker/provider integration and end-to-end guest/account delivery are therefore **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**. No provider is configured and no real email should be sent.
