-- SAFE PRODUCT IMPORT (Supabase / PostgreSQL)
-- Assumptions:
-- - Department slug is 'supplements' and already exists.
-- - Category resolution is by (department='supplements', parent_id IS NULL, slug=normalized_slug).
--   If you have duplicate slugs under different parents, you must include parent info.

begin;

-- 0) Guard: required department exists
do $$
begin
  if not exists (select 1 from departments where slug = 'supplements') then
    raise exception 'Missing departments.slug = %', 'supplements';
  end if;
end $$;

-- 1) Stage input (paste your products into the VALUES block)
create temp table import_products_stage (
  slug text not null,
  title_fr text not null,
  title_ar text not null,
  description_fr text,
  description_ar text,
  brand_key text,          -- brand name OR brand slug
  category_raw text not null, -- e.g. "Protéines Whey" or "whey-protein"
  price_dzd numeric(10,2) not null,
  stock int,
  is_active boolean,
  sku text
) on commit drop;

insert into import_products_stage (
  slug, title_fr, title_ar, description_fr, description_ar,
  brand_key, category_raw, price_dzd, stock, is_active, sku
)
values
  -- TODO: replace these sample rows with your full list
  ('critical-whey-protein-900g', 'Critical Whey Protein 900g', 'بروتين كريتيكال واي 900غ', null, null,
   'Applied Nutrition', 'Protéines Whey', 0, 10, true, null),
  ('creatine-monohydrate-250g', 'Creatine Monohydrate 250g', 'كرياتين مونوهيدرات 250غ', null, null,
   'optimum-nutrition', 'Créatine', 0, null, true, null);

-- 2) Normalize/clean (category mapping + defaults)
with cleaned as (
  select
    trim(slug) as slug,
    title_fr,
    title_ar,
    description_fr,
    description_ar,
    nullif(trim(brand_key), '') as brand_key,
    case
      when lower(trim(category_raw)) in ('protéines whey', 'proteines whey', 'whey', 'whey protein', 'whey-protein') then 'whey-protein'
      when lower(trim(category_raw)) in ('créatine', 'creatine', 'creatine monohydrate', 'creatine-monohydrate') then 'creatine'
      when lower(trim(category_raw)) in ('gainers', 'gainer') then 'gainers'
      else lower(trim(category_raw))  -- if already a slug, keep it (must match categories.slug)
    end as category_slug,
    price_dzd,
    coalesce(stock, 10) as stock,
    coalesce(is_active, true) as is_active,
    nullif(trim(sku), '') as sku
  from import_products_stage
),
resolved as (
  select
    c.*,
    d.id as department_id,
    b.id as brand_id,
    cat.id as category_id
  from cleaned c
  join departments d
    on d.slug = 'supplements'
  left join brands b
    on lower(b.slug) = lower(c.brand_key)
    or lower(b.name) = lower(c.brand_key)
  left join categories cat
    on cat.department_id = d.id
   and cat.parent_id is null
   and cat.slug = c.category_slug
),
-- 3) Validation: fail fast if category not found; fail if brand_key provided but no match
validate as (
  select
    sum(case when category_id is null then 1 else 0 end) as missing_categories,
    sum(case when brand_key is not null and brand_id is null then 1 else 0 end) as missing_brands
  from resolved
)
select
  case
    when missing_categories > 0 then
      pg_catalog.raise_exception('Import aborted: one or more categories not found under supplements (check mapping / categories table).')
    when missing_brands > 0 then
      pg_catalog.raise_exception('Import aborted: one or more brands not found (brand_key must match brands.name or brands.slug).')
    else 1
  end
from validate;

-- 4) Upsert products (no hardcoded IDs)
-- Choose behavior:
-- - Update mode (recommended for re-running imports): ON CONFLICT DO UPDATE
-- - Skip mode: change DO UPDATE -> DO NOTHING
with cleaned as (
  select
    trim(slug) as slug,
    title_fr,
    title_ar,
    description_fr,
    description_ar,
    nullif(trim(brand_key), '') as brand_key,
    case
      when lower(trim(category_raw)) in ('protéines whey', 'proteines whey', 'whey', 'whey protein', 'whey-protein') then 'whey-protein'
      when lower(trim(category_raw)) in ('créatine', 'creatine', 'creatine monohydrate', 'creatine-monohydrate') then 'creatine'
      when lower(trim(category_raw)) in ('gainers', 'gainer') then 'gainers'
      else lower(trim(category_raw))
    end as category_slug,
    price_dzd,
    coalesce(stock, 10) as stock,
    coalesce(is_active, true) as is_active,
    nullif(trim(sku), '') as sku
  from import_products_stage
),
resolved as (
  select
    c.*,
    d.id as department_id,
    b.id as brand_id,
    cat.id as category_id
  from cleaned c
  join departments d
    on d.slug = 'supplements'
  left join brands b
    on lower(b.slug) = lower(c.brand_key)
    or lower(b.name) = lower(c.brand_key)
  left join categories cat
    on cat.department_id = d.id
   and cat.parent_id is null
   and cat.slug = c.category_slug
)
insert into products (
  slug,
  title_fr,
  title_ar,
  description_fr,
  description_ar,
  brand_id,
  category_id,
  department_id,
  price_dzd,
  stock,
  is_active,
  sku
)
select
  r.slug,
  r.title_fr,
  r.title_ar,
  r.description_fr,
  r.description_ar,
  r.brand_id,
  r.category_id,
  r.department_id,
  r.price_dzd,
  r.stock,
  r.is_active,
  coalesce(
    r.sku,
    -- deterministic SKU fallback (stable across reruns)
    'SKU-' || upper(replace(left(r.slug, 24), '-', '_'))
  ) as sku
from resolved r
on conflict (slug) do update set
  title_fr = excluded.title_fr,
  title_ar = excluded.title_ar,
  description_fr = excluded.description_fr,
  description_ar = excluded.description_ar,
  brand_id = excluded.brand_id,
  category_id = excluded.category_id,
  department_id = excluded.department_id,
  price_dzd = excluded.price_dzd,
  stock = excluded.stock,
  is_active = excluded.is_active,
  sku = coalesce(excluded.sku, products.sku),
  updated_at = now();

commit;
