# 20260927 Live Verification Package

Migration: `supabase/migrations/20260927_delivery_email_orchestration.sql`

Run in Supabase SQL Editor. Read-only checks only. Do not send email, create digital units, or create/read Vault secrets.

## 1. Objects and signatures

```sql
select
  to_regprocedure('public.enqueue_digital_delivery_emails_for_fulfillment(uuid)') as orchestration_rpc,
  to_regprocedure('public.admin_deliver_order_atomic(uuid,text)') as delivery_rpc,
  to_regclass('public.digital_email_outbox') as outbox_table;
```

Expected: every result is non-NULL.

```sql
select p.oid::regprocedure as routine,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       pg_get_function_result(p.oid) as return_type,
       p.prosecdef as security_definer,
       p.proconfig as settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('enqueue_digital_delivery_emails_for_fulfillment', 'admin_deliver_order_atomic')
order by 1;
```

Expected: both are SECURITY DEFINER and settings contain `search_path=`.

## 2. Function privileges

```sql
select
  has_function_privilege('public.enqueue_digital_delivery_emails_for_fulfillment(uuid)', 'execute') as public_orchestrate,
  has_function_privilege('anon', 'public.enqueue_digital_delivery_emails_for_fulfillment(uuid)', 'execute') as anon_orchestrate,
  has_function_privilege('authenticated', 'public.enqueue_digital_delivery_emails_for_fulfillment(uuid)', 'execute') as authenticated_orchestrate,
  has_function_privilege('service_role', 'public.enqueue_digital_delivery_emails_for_fulfillment(uuid)', 'execute') as service_orchestrate,
  has_function_privilege('public.admin_deliver_order_atomic(uuid,text)', 'execute') as public_deliver,
  has_function_privilege('anon', 'public.admin_deliver_order_atomic(uuid,text)', 'execute') as anon_deliver,
  has_function_privilege('authenticated', 'public.admin_deliver_order_atomic(uuid,text)', 'execute') as authenticated_deliver,
  has_function_privilege('service_role', 'public.admin_deliver_order_atomic(uuid,text)', 'execute') as service_deliver;
```

Expected: public/anon/authenticated are false; service_role is true.

## 3. Definition and enqueue path

```sql
select pg_get_functiondef(
  'public.enqueue_digital_delivery_emails_for_fulfillment(uuid)'::regprocedure
) as orchestration_definition;
```

Expected definition: requires delivered digital fulfillment, iterates delivered allocation-backed order items, calls `enqueue_digital_delivery_email`, and uses deterministic `fulfillment-delivered:` idempotency keys. It must not contain network calls or Vault plaintext access.

```sql
select pg_get_functiondef(
  'public.admin_deliver_order_atomic(uuid,text)'::regprocedure
) as delivery_definition;
```

Expected definition: updates fulfillment and allocation state, records the fulfillment event, then calls the orchestration helper; no external network call is present.

## 4. Outbox integrity and idempotency

```sql
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'digital_email_outbox';
```

Expected: `relrowsecurity = true`.

```sql
select idempotency_key, count(*) as duplicate_count
from public.digital_email_outbox
group by idempotency_key
having count(*) > 1;
```

Expected: no rows.

```sql
select count(*) as unsafe_payload_rows
from public.digital_email_outbox
where payload ?| array[
  'secret','decrypted_secret','password','credential','credentials',
  'code','vault_secret_id','guest_token','delivery_token','token'
];
```

Expected: `0`.

```sql
select count(*) as invalid_email_jobs
from public.digital_email_outbox e
left join public.orders o on o.id = e.order_id
left join public.order_items oi on oi.id = e.order_item_id
where o.id is null
   or (e.order_item_id is not null and oi.order_id is distinct from e.order_id)
   or e.email_type not in ('guest_digital_delivery', 'account_digital_delivery');
```

Expected: `0`.

## 5. Runtime boundary

```sql
select count(*) as digital_inventory_units
from public.digital_inventory_units;
```

Expected current result: `0`.

Automatic event-to-email runtime tests are therefore:

```text
NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS
```

Do not create fake orders/units, do not create/read Vault secrets, do not configure a provider, and do not send real email.
