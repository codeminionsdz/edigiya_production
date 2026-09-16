# 20260925 Live Verification Package

Migration: `supabase/migrations/20260925_digital_email_outbox.sql`

Run in Supabase SQL Editor. These checks are read-only. Do not send email, create Vault secrets, or create digital units.

## 1. Object and schema checks

```sql
select
  to_regclass('public.digital_email_outbox') as outbox_table,
  to_regprocedure('public.enqueue_digital_delivery_email(uuid,uuid,text,text)') as enqueue_rpc,
  to_regprocedure('public.claim_digital_email_outbox_job(text,integer)') as claim_rpc,
  to_regprocedure('public.mark_digital_email_outbox_sent(uuid,uuid)') as sent_rpc,
  to_regprocedure('public.mark_digital_email_outbox_failed(uuid,uuid,text,timestamptz)') as failed_rpc;
```

Expected: every result is non-NULL.

```sql
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'digital_email_outbox'
order by ordinal_position;
```

Expected columns include order/item, recipient, email type, payload, status, attempts, idempotency key, availability, lease, sent/error, and timestamps.

## 2. Constraints and indexes

```sql
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.digital_email_outbox'::regclass
order by conname;
```

Expected: order/order-item foreign keys, allowed email types and statuses, non-negative attempts, unique idempotency key, and payload safety check rejecting secret/token-bearing keys.

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'digital_email_outbox'
order by indexname;
```

Expected indexes: `digital_email_outbox_ready_idx`, `digital_email_outbox_order_idx`, and `digital_email_outbox_type_status_idx`.

## 3. SECURITY DEFINER and search_path

```sql
select
  p.oid::regprocedure as routine,
  p.prosecdef as security_definer,
  p.proconfig as settings,
  pg_get_function_result(p.oid) as return_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'enqueue_digital_delivery_email',
    'claim_digital_email_outbox_job',
    'mark_digital_email_outbox_sent',
    'mark_digital_email_outbox_failed'
  )
order by 1;
```

Expected: `security_definer = true` and `settings` contains `search_path=` for every function.

## 4. RLS and grants

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

Expected: no PUBLIC, anon, or authenticated table privileges; service_role has required access.

```sql
select
  has_table_privilege('public', 'public.digital_email_outbox', 'select') as public_select,
  has_table_privilege('anon', 'public.digital_email_outbox', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.digital_email_outbox', 'select') as authenticated_select,
  has_table_privilege('service_role', 'public.digital_email_outbox', 'select') as service_select;
```

Expected: public/anon/authenticated are false; service_role is true.

```sql
select
  has_function_privilege('public.enqueue_digital_delivery_email(uuid,uuid,text,text)', 'execute') as public_enqueue,
  has_function_privilege('anon', 'public.enqueue_digital_delivery_email(uuid,uuid,text,text)', 'execute') as anon_enqueue,
  has_function_privilege('authenticated', 'public.enqueue_digital_delivery_email(uuid,uuid,text,text)', 'execute') as authenticated_enqueue,
  has_function_privilege('service_role', 'public.enqueue_digital_delivery_email(uuid,uuid,text,text)', 'execute') as service_enqueue,
  has_function_privilege('public.claim_digital_email_outbox_job(text,integer)', 'execute') as public_claim,
  has_function_privilege('anon', 'public.claim_digital_email_outbox_job(text,integer)', 'execute') as anon_claim,
  has_function_privilege('authenticated', 'public.claim_digital_email_outbox_job(text,integer)', 'execute') as authenticated_claim,
  has_function_privilege('service_role', 'public.claim_digital_email_outbox_job(text,integer)', 'execute') as service_claim;
```

Expected: public/anon/authenticated are false; service_role is true.

## 5. Safe outbox consistency checks

```sql
select status, email_type, count(*) as row_count
from public.digital_email_outbox
group by status, email_type
order by status, email_type;
```

Informational only. This migration does not send email.

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

## 6. Runtime boundary

Since `digital_inventory_units = 0`, end-to-end enqueue/delivery tests requiring a delivered unique digital unit are **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**.

No email provider is configured, no email is sent, and no Vault secret or raw delivery token is created/read by this package.
