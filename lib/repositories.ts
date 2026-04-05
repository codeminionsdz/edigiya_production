'use server';

import { createClient } from '@supabase/supabase-js';

// Service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Anon client for public operations
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function shouldFallbackToAdminRead(error: { message?: string; code?: string; status?: number } | null) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('invalid api key') ||
    message.includes('invalid jwt') ||
    message.includes('jwt malformed')
  );
}

// ============================================================================
// DEPARTMENTS REPOSITORY
// ============================================================================

export async function getDepartments(onlyActive = false) {
  let query = supabaseAnon.from('departments').select('*').order('sort_order');
  if (onlyActive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) {
    if (!shouldFallbackToAdminRead(error)) throw error;
    let adminQuery = supabaseAdmin.from('departments').select('*').order('sort_order');
    if (onlyActive) adminQuery = adminQuery.eq('is_active', true);
    const { data: adminData, error: adminError } = await adminQuery;
    if (adminError) throw adminError;
    return adminData || [];
  }
  return data || [];
}

export async function getDepartmentById(id: string) {
  const { data, error } = await supabaseAnon
    .from('departments')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getDepartmentBySlug(slug: string) {
  const { data, error } = await supabaseAnon
    .from('departments')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function createDepartment(data: {
  slug: string;
  name_fr: string;
  name_ar: string;
  icon?: string;
  image_url?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  // Validate required fields
  if (!data.slug || !data.name_fr || !data.name_ar) {
    throw new Error('slug, name_fr, and name_ar are required');
  }

  const { data: result, error } = await supabaseAdmin
    .from('departments')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateDepartment(
  id: string,
  data: {
    slug?: string;
    name_fr?: string;
    name_ar?: string;
    icon?: string;
    image_url?: string;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('departments')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteDepartment(id: string) {
  const { error } = await supabaseAdmin
    .from('departments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================================
// CATEGORIES REPOSITORY
// ============================================================================

export async function getCategories(onlyActive = false) {
  let query = supabaseAnon
    .from('categories')
    .select(
      onlyActive
        ? '*, departments!inner(id, slug, name_fr, name_ar, is_active)'
        : '*, departments(id, slug, name_fr, name_ar)'
    )
    .order('sort_order');

  if (onlyActive) {
    query = query.eq('is_active', true).eq('departments.is_active', true);
  }
  const { data, error } = await query;
  if (error) {
    if (!shouldFallbackToAdminRead(error)) throw error;
    let adminQuery = supabaseAdmin
      .from('categories')
      .select(
        onlyActive
          ? '*, departments!inner(id, slug, name_fr, name_ar, is_active)'
          : '*, departments(id, slug, name_fr, name_ar)'
      )
      .order('sort_order');
    if (onlyActive) {
      adminQuery = adminQuery.eq('is_active', true).eq('departments.is_active', true);
    }
    const { data: adminData, error: adminError } = await adminQuery;
    if (adminError) throw adminError;
    return adminData || [];
  }
  return data || [];
}

export async function getCategoriesByDepartment(
  departmentId: string,
  parentId?: string | null,
  onlyActive = false
) {
  let query = supabaseAnon
    .from('categories')
    .select('*')
    .eq('department_id', departmentId)
    .order('sort_order');

  if (parentId === undefined || parentId === null) {
    query = query.is('parent_id', null);
  } else {
    query = query.eq('parent_id', parentId);
  }

  if (onlyActive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) {
    if (!shouldFallbackToAdminRead(error)) throw error;
    let adminQuery = supabaseAdmin
      .from('categories')
      .select('*')
      .eq('department_id', departmentId)
      .order('sort_order');

    if (parentId === undefined || parentId === null) {
      adminQuery = adminQuery.is('parent_id', null);
    } else {
      adminQuery = adminQuery.eq('parent_id', parentId);
    }

    if (onlyActive) adminQuery = adminQuery.eq('is_active', true);

    const { data: adminData, error: adminError } = await adminQuery;
    if (adminError) throw adminError;
    return adminData || [];
  }
  return data || [];
}

export async function getCategoryById(id: string) {
  const { data, error } = await supabaseAnon
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (!shouldFallbackToAdminRead(error)) throw error;
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    if (adminError) throw adminError;
    return adminData;
  }
  return data;
}

export async function getCategoryBySlug(slug: string, departmentId?: string) {
  let query = supabaseAnon.from('categories').select('*').eq('slug', slug);
  if (departmentId) query = query.eq('department_id', departmentId);
  const { data, error } = await query.single();
  if (error && error.code !== 'PGRST116') {
    if (!shouldFallbackToAdminRead(error)) throw error;
    let adminQuery = supabaseAdmin.from('categories').select('*').eq('slug', slug);
    if (departmentId) adminQuery = adminQuery.eq('department_id', departmentId);
    const { data: adminData, error: adminError } = await adminQuery.single();
    if (adminError && adminError.code !== 'PGRST116') throw adminError;
    return adminData || null;
  }
  return data || null;
}

export async function getCategoryPath(categoryId: string) {
  // Get full path: Department -> Category -> Subcategory -> ...
  const category = await getCategoryById(categoryId);
  if (!category) return [];

  const path = [category];
  let current = category;

  while (current.parent_id) {
    current = await getCategoryById(current.parent_id);
    if (current) path.unshift(current);
  }

  return path;
}

export async function createCategory(data: {
  department_id: string;
  parent_id?: string | null;
  slug: string;
  name_fr: string;
  name_ar: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (!data.department_id || !data.slug || !data.name_fr || !data.name_ar) {
    throw new Error('department_id, slug, name_fr, and name_ar are required');
  }

  const { data: result, error } = await supabaseAdmin
    .from('categories')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateCategory(
  id: string,
  data: {
    department_id?: string;
    parent_id?: string | null;
    slug?: string;
    name_fr?: string;
    name_ar?: string;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('categories')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteCategory(id: string) {
  const { error } = await supabaseAdmin
    .from('categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Taxonomy-specific functions for admin
export async function getCategoryTreeByDepartment(departmentId: string) {
  // Fetch all categories for this department
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .eq('department_id', departmentId)
    .order('sort_order');
  if (error) throw error;

  // Build tree structure
  const categories = data || [];
  const roots = categories.filter(c => !c.parent_id);
  
  // Recursive function to build children
  const buildTree = (parentId: string | null = null): any[] => {
    return (categories.filter(c => c.parent_id === (parentId || null)))
      .map(cat => ({
        ...cat,
        children: buildTree(cat.id),
      }));
  };

  return buildTree(null);
}

export async function getMegaMenuTaxonomy() {
  let departments: any[] = [];
  let categories: any[] = [];

  const [{ data: departmentsAnon, error: deptError }, { data: categoriesAnon, error: catError }] =
    await Promise.all([
      supabaseAnon
        .from('departments')
        .select('id, slug, name_fr, name_ar, icon, sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      supabaseAnon
        .from('categories')
        .select('id, department_id, parent_id, slug, name_fr, name_ar, sort_order')
        .eq('is_active', true)
        .order('sort_order'),
    ]);

  if (!deptError && !catError) {
    departments = departmentsAnon || [];
    categories = categoriesAnon || [];
  } else {
    const canFallback = shouldFallbackToAdminRead(deptError) || shouldFallbackToAdminRead(catError);
    if (!canFallback) {
      if (deptError) throw deptError;
      if (catError) throw catError;
    }

    const [{ data: departmentsAdmin, error: deptAdminError }, { data: categoriesAdmin, error: catAdminError }] =
      await Promise.all([
        supabaseAdmin
          .from('departments')
          .select('id, slug, name_fr, name_ar, icon, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
        supabaseAdmin
          .from('categories')
          .select('id, department_id, parent_id, slug, name_fr, name_ar, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
      ]);

    if (deptAdminError) throw deptAdminError;
    if (catAdminError) throw catAdminError;

    departments = departmentsAdmin || [];
    categories = categoriesAdmin || [];
  }

  const categoryRows = categories || [];
  const byDepartment = new Map<string, any[]>();
  for (const category of categoryRows) {
    const departmentCategories = byDepartment.get(category.department_id) || [];
    departmentCategories.push(category);
    byDepartment.set(category.department_id, departmentCategories);
  }

  return (departments || []).map((department) => {
    const departmentCategories = byDepartment.get(department.id) || [];
    const childrenByParent = new Map<string, any[]>();

    for (const category of departmentCategories) {
      if (!category.parent_id) continue;
      const siblings = childrenByParent.get(category.parent_id) || [];
      siblings.push(category);
      childrenByParent.set(category.parent_id, siblings);
    }

    const roots = departmentCategories.filter((category) => !category.parent_id);

    return {
      ...department,
      categories: roots.map((root) => ({
        id: root.id,
        slug: root.slug,
        name_fr: root.name_fr,
        name_ar: root.name_ar,
        sort_order: root.sort_order,
        children: (childrenByParent.get(root.id) || []).map((child) => ({
          id: child.id,
          slug: child.slug,
          name_fr: child.name_fr,
          name_ar: child.name_ar,
          sort_order: child.sort_order,
        })),
      })),
    };
  });
}

export async function slugExistsInDepartment(slug: string, departmentId: string, excludeId?: string) {
  let query = supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .eq('department_id', departmentId);
  
  if (excludeId) query = query.neq('id', excludeId);
  
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return (data?.length || 0) > 0;
}

export async function canDeleteCategory(id: string) {
  // Check for child categories
  const { data: children, error: childError } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('parent_id', id)
    .limit(1);
  if (childError) throw childError;
  if (children && children.length > 0) {
    return { can: false, reason: 'Has child categories' };
  }

  // Check for products
  const { data: products, error: prodError } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('category_id', id)
    .limit(1);
  if (prodError) throw prodError;
  if (products && products.length > 0) {
    return { can: false, reason: 'Has products' };
  }

  return { can: true };
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  return updateCategory(id, { is_active: isActive });
}

export async function moveCategoryUp(id: string) {
  const cat = await getCategoryById(id);
  if (!cat) throw new Error('Category not found');

  // Find siblings
  const { data: siblings, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .eq('department_id', cat.department_id)
    .eq('parent_id', cat.parent_id || null)
    .order('sort_order');
  if (error) throw error;

  const idx = (siblings || []).findIndex(s => s.id === id);
  if (idx <= 0) return; // Already first or not found

  const prev = siblings![idx - 1];
  const prevOrder = prev.sort_order || 0;
  const currOrder = cat.sort_order || 0;

  // Swap
  await Promise.all([
    updateCategory(id, { sort_order: prevOrder }),
    updateCategory(prev.id, { sort_order: currOrder }),
  ]);
}

export async function moveCategoryDown(id: string) {
  const cat = await getCategoryById(id);
  if (!cat) throw new Error('Category not found');

  // Find siblings
  const { data: siblings, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .eq('department_id', cat.department_id)
    .eq('parent_id', cat.parent_id || null)
    .order('sort_order');
  if (error) throw error;

  const idx = (siblings || []).findIndex(s => s.id === id);
  if (!siblings || idx >= siblings.length - 1) return; // Already last or not found

  const next = siblings[idx + 1];
  const nextOrder = next.sort_order || 0;
  const currOrder = cat.sort_order || 0;

  // Swap
  await Promise.all([
    updateCategory(id, { sort_order: nextOrder }),
    updateCategory(next.id, { sort_order: currOrder }),
  ]);
}

// ============================================================================
// BRANDS REPOSITORY
// ============================================================================

export async function getBrands(onlyActive = false) {
  let query = supabaseAnon.from('brands').select('*').order('name');
  if (onlyActive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBrandById(id: string) {
  const { data, error } = await supabaseAnon
    .from('brands')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createBrand(data: {
  name: string;
  slug: string;
  logo_url?: string;
  is_active?: boolean;
}) {
  if (!data.name || !data.slug) {
    throw new Error('name and slug are required');
  }

  const { data: result, error } = await supabaseAdmin
    .from('brands')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateBrand(
  id: string,
  data: {
    name?: string;
    slug?: string;
    logo_url?: string;
    is_active?: boolean;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('brands')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteBrand(id: string) {
  const { error } = await supabaseAdmin
    .from('brands')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================================
// PRODUCTS REPOSITORY
// ============================================================================

export async function getProducts(filters?: {
  departmentId?: string;
  categoryId?: string;
  brandId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  onlyActive?: boolean;
  page?: number;
  limit?: number;
}) {
  let query = supabaseAnon
    .from('products')
    .select(
      `
      *,
      brands(id, name, slug, logo_url),
      departments(id, slug, name_fr, name_ar),
      categories(id, slug, name_fr, name_ar),
      product_images(id, url, alt_fr, alt_ar, sort_order),
      product_specs(id, key, value_fr, value_ar, sort_order)
    `,
      { count: 'exact' }
    );

  if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters?.brandId) query = query.eq('brand_id', filters.brandId);
  if (filters?.search) {
    query = query.or(`title_fr.ilike.%${filters.search}%,title_ar.ilike.%${filters.search}%,sku.eq.${filters.search}`);
  }
  if (filters?.minPrice !== undefined) query = query.gte('price_dzd', filters.minPrice);
  if (filters?.maxPrice !== undefined) query = query.lte('price_dzd', filters.maxPrice);
  if (filters?.onlyActive !== false) query = query.eq('is_active', true);

  query = query.order('created_at', { ascending: false });

  const limit = filters?.limit || 20;
  const page = filters?.page || 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    products: data || [],
    total: count || 0,
    page,
    limit,
  };
}

function productDetailsSelect(includeVariants: boolean): string {
  const baseSelect = `
    *,
    brands(id, name, slug, logo_url),
    departments(id, slug, name_fr, name_ar),
    categories(id, slug, name_fr, name_ar),
    product_images(id, url, alt_fr, alt_ar, sort_order),
    product_specs(id, key, value_fr, value_ar, sort_order)
  `;

  if (!includeVariants) return baseSelect;

  return `
    ${baseSelect},
    product_variants(id, name, value, price_delta_dzd, stock)
  `;
}

export async function getProductById(id: string) {
  const includeVariants = await hasProductVariantsTable();
  const { data, error } = await supabaseAnon
    .from('products')
    .select(productDetailsSelect(includeVariants))
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getProductBySlug(slug: string) {
  const includeVariants = await hasProductVariantsTable();
  const { data, error } = await supabaseAnon
    .from('products')
    .select(productDetailsSelect(includeVariants))
    .eq('slug', slug)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export interface ProductSpecInput {
  key: string;
  value_fr?: string | null;
  value_ar?: string | null;
  sort_order?: number;
}

export interface ProductImageInput {
  url: string;
  alt_fr?: string | null;
  alt_ar?: string | null;
  sort_order?: number;
}

export interface ProductVariantInput {
  name: string;
  value: string;
  price_delta_dzd?: number;
  stock?: number;
}

export interface ProductSeoInput {
  meta_title_fr?: string | null;
  meta_title_ar?: string | null;
  meta_description_fr?: string | null;
  meta_description_ar?: string | null;
}

const PRODUCT_IMAGES_BUCKET = 'product-images';
let productImagesBucketReady = false;
let hasSeoColumnsCache: boolean | null = null;
let hasVariantsTableCache: boolean | null = null;

function normalizeOptionalText(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMissingResourceError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toLowerCase();
  return (
    code === '42p01' ||
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('not found')
  );
}

export async function productSlugExists(slug: string, excludeId?: string) {
  let query = supabaseAdmin.from('products').select('id').eq('slug', slug).limit(1);
  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data?.length || 0) > 0;
}

export async function hasProductSeoColumns() {
  if (hasSeoColumnsCache !== null) return hasSeoColumnsCache;

  const { error } = await supabaseAdmin
    .from('products')
    .select('id, meta_title_fr, meta_title_ar, meta_description_fr, meta_description_ar')
    .limit(1);

  if (!error) {
    hasSeoColumnsCache = true;
    return true;
  }

  if (isMissingResourceError(error)) {
    hasSeoColumnsCache = false;
    return false;
  }

  throw error;
}

export async function hasProductVariantsTable() {
  if (hasVariantsTableCache !== null) return hasVariantsTableCache;

  const { error } = await supabaseAdmin.from('product_variants').select('id').limit(1);
  if (!error) {
    hasVariantsTableCache = true;
    return true;
  }

  if (isMissingResourceError(error)) {
    hasVariantsTableCache = false;
    return false;
  }

  throw error;
}

export async function createProduct(data: {
  slug: string;
  title_fr: string;
  title_ar: string;
  description_fr?: string;
  description_ar?: string;
  brand_id?: string;
  department_id: string;
  category_id: string;
  price_dzd: number;
  compare_at_price_dzd?: number | null;
  sku?: string | null;
  stock: number;
  is_featured?: boolean;
  is_active?: boolean;
}) {
  if (!data.slug || !data.title_fr || !data.title_ar || !data.department_id || !data.category_id) {
    throw new Error('slug, title_fr, title_ar, department_id, and category_id are required');
  }

  if (data.price_dzd < 0 || data.stock < 0) {
    throw new Error('price_dzd and stock must be >= 0');
  }

  const payload = {
    slug: data.slug,
    title_fr: data.title_fr,
    title_ar: data.title_ar,
    description_fr: normalizeOptionalText(data.description_fr),
    description_ar: normalizeOptionalText(data.description_ar),
    brand_id: normalizeOptionalText(data.brand_id),
    department_id: data.department_id,
    category_id: data.category_id,
    price_dzd: data.price_dzd,
    compare_at_price_dzd: data.compare_at_price_dzd ?? null,
    sku: normalizeOptionalText(data.sku),
    stock: data.stock,
    is_featured: data.is_featured ?? false,
    is_active: data.is_active ?? true,
  };

  const { data: result, error } = await supabaseAdmin
    .from('products')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateProduct(
  id: string,
  data: {
    slug?: string;
    title_fr?: string;
    title_ar?: string;
    description_fr?: string;
    description_ar?: string;
    brand_id?: string;
    department_id?: string;
    category_id?: string;
    price_dzd?: number;
    compare_at_price_dzd?: number | null;
    sku?: string | null;
    stock?: number;
    is_featured?: boolean;
    is_active?: boolean;
  }
) {
  if (data.price_dzd !== undefined && data.price_dzd < 0) {
    throw new Error('price_dzd must be >= 0');
  }
  if (data.stock !== undefined && data.stock < 0) {
    throw new Error('stock must be >= 0');
  }

  const patch: Record<string, unknown> = {};

  if ('slug' in data) patch.slug = data.slug;
  if ('title_fr' in data) patch.title_fr = data.title_fr;
  if ('title_ar' in data) patch.title_ar = data.title_ar;
  if ('description_fr' in data) patch.description_fr = normalizeOptionalText(data.description_fr);
  if ('description_ar' in data) patch.description_ar = normalizeOptionalText(data.description_ar);
  if ('brand_id' in data) patch.brand_id = normalizeOptionalText(data.brand_id);
  if ('department_id' in data) patch.department_id = data.department_id;
  if ('category_id' in data) patch.category_id = data.category_id;
  if ('price_dzd' in data) patch.price_dzd = data.price_dzd;
  if ('compare_at_price_dzd' in data) patch.compare_at_price_dzd = data.compare_at_price_dzd ?? null;
  if ('sku' in data) patch.sku = normalizeOptionalText(data.sku);
  if ('stock' in data) patch.stock = data.stock;
  if ('is_featured' in data) patch.is_featured = data.is_featured;
  if ('is_active' in data) patch.is_active = data.is_active;

  const { data: result, error } = await supabaseAdmin
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteProduct(id: string) {
  const { error } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function replaceProductSpecs(productId: string, specs: ProductSpecInput[]) {
  const { error: deleteError } = await supabaseAdmin
    .from('product_specs')
    .delete()
    .eq('product_id', productId);
  if (deleteError) throw deleteError;

  const rows = specs
    .filter((spec) => spec.key.trim().length > 0)
    .map((spec, index) => ({
      product_id: productId,
      key: spec.key.trim(),
      value_fr: normalizeOptionalText(spec.value_fr),
      value_ar: normalizeOptionalText(spec.value_ar),
      sort_order: spec.sort_order ?? index,
    }));

  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin.from('product_specs').insert(rows).select();
  if (error) throw error;
  return data || [];
}

export async function replaceProductImages(productId: string, images: ProductImageInput[]) {
  const { error: deleteError } = await supabaseAdmin
    .from('product_images')
    .delete()
    .eq('product_id', productId);
  if (deleteError) throw deleteError;

  const rows = images
    .filter((image) => image.url.trim().length > 0)
    .map((image, index) => ({
      product_id: productId,
      url: image.url.trim(),
      alt_fr: normalizeOptionalText(image.alt_fr),
      alt_ar: normalizeOptionalText(image.alt_ar),
      sort_order: image.sort_order ?? index,
    }));

  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin.from('product_images').insert(rows).select();
  if (error) throw error;
  return data || [];
}

export async function replaceProductVariants(productId: string, variants: ProductVariantInput[]) {
  const supportsVariants = await hasProductVariantsTable();
  if (!supportsVariants) {
    return [];
  }

  const { error: deleteError } = await supabaseAdmin
    .from('product_variants')
    .delete()
    .eq('product_id', productId);
  if (deleteError) throw deleteError;

  const rows = variants
    .filter((variant) => variant.name.trim().length > 0 && variant.value.trim().length > 0)
    .map((variant) => ({
      product_id: productId,
      name: variant.name.trim(),
      value: variant.value.trim(),
      price_delta_dzd: variant.price_delta_dzd ?? 0,
      stock: variant.stock ?? 0,
    }));

  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin.from('product_variants').insert(rows).select();
  if (error) throw error;
  return data || [];
}

export async function updateProductSeo(productId: string, seo: ProductSeoInput) {
  const supportsSeo = await hasProductSeoColumns();
  if (!supportsSeo) {
    return { supported: false as const };
  }

  const payload = {
    meta_title_fr: normalizeOptionalText(seo.meta_title_fr),
    meta_title_ar: normalizeOptionalText(seo.meta_title_ar),
    meta_description_fr: normalizeOptionalText(seo.meta_description_fr),
    meta_description_ar: normalizeOptionalText(seo.meta_description_ar),
  };

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(payload)
    .eq('id', productId)
    .select('id, meta_title_fr, meta_title_ar, meta_description_fr, meta_description_ar')
    .single();
  if (error) throw error;
  return { supported: true as const, data };
}

async function ensureProductImagesBucket() {
  if (productImagesBucketReady) return;

  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(PRODUCT_IMAGES_BUCKET);

  if (!bucket && !isMissingResourceError(bucketError)) {
    throw bucketError;
  }

  if (!bucket) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(PRODUCT_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: '10MB',
    });

    if (createError && !String(createError.message || '').toLowerCase().includes('already exists')) {
      throw createError;
    }
  }

  productImagesBucketReady = true;
}

export async function uploadProductImage(file: File) {
  await ensureProductImagesBucket();

  const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const safeExt = (extension || 'bin').toLowerCase();
  const objectPath = `${new Date().getUTCFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from(PRODUCT_IMAGES_BUCKET).upload(objectPath, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;

  const publicData = supabaseAdmin.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(objectPath).data;
  return {
    bucket: PRODUCT_IMAGES_BUCKET,
    path: objectPath,
    url: publicData.publicUrl,
  };
}

// ============================================================================
// PRODUCT IMAGES REPOSITORY
// ============================================================================

export async function addProductImage(data: {
  product_id: string;
  url: string;
  alt_fr?: string;
  alt_ar?: string;
  sort_order?: number;
}) {
  const { data: result, error } = await supabaseAdmin
    .from('product_images')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteProductImage(id: string) {
  const { error } = await supabaseAdmin
    .from('product_images')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================================
// SHIPPING REPOSITORY
// ============================================================================

export async function getWilayas() {
  const { data, error } = await supabaseAnon
    .from('shipping_wilayas')
    .select('*')
    .order('code');
  if (error) throw error;
  return data || [];
}

export async function getWilayaByCode(code: string) {
  const { data, error } = await supabaseAnon
    .from('shipping_wilayas')
    .select('*')
    .eq('code', code)
    .single();
  if (error) throw error;
  return data;
}

export async function getShippingRates(wilayaCode?: string, method?: 'home' | 'stopdesk') {
  let query = supabaseAnon.from('shipping_rates').select('*');
  if (wilayaCode) query = query.eq('wilaya_code', wilayaCode);
  if (method) query = query.eq('method', method);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getShippingRate(wilayaCode: string, method: 'home' | 'stopdesk') {
  const { data, error } = await supabaseAnon
    .from('shipping_rates')
    .select('*')
    .eq('wilaya_code', wilayaCode)
    .eq('method', method)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function updateShippingRate(
  wilayaCode: string,
  method: 'home' | 'stopdesk',
  data: {
    price_dzd?: number;
    eta_min_days?: number;
    eta_max_days?: number;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('shipping_rates')
    .update(data)
    .eq('wilaya_code', wilayaCode)
    .eq('method', method)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getShippingRules() {
  const { data, error } = await supabaseAnon
    .from('shipping_rules')
    .select('*')
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return (
    data || {
      free_shipping_threshold_dzd: 50000,
      default_fee_dzd: 1000,
    }
  );
}

export async function updateShippingRules(data: {
  free_shipping_threshold_dzd?: number;
  default_fee_dzd?: number;
}) {
  const rules = await getShippingRules();
  const { data: result, error } = await supabaseAdmin
    .from('shipping_rules')
    .upsert(
      {
        id: rules.id || '00000000-0000-0000-0000-000000000000',
        ...data,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ============================================================================
// ORDERS REPOSITORY
// ============================================================================

export async function getOrders(filters?: {
  sessionId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  console.log('📦 getOrders - Filters:', filters);
  
  let query = supabaseAnon
    .from('orders')
    .select(
      `
      *,
      order_items(
        id,
        product_id,
        variant_id,
        title_snapshot,
        unit_price_dzd,
        qty,
        line_total_dzd
      )
    `,
      { count: 'exact' }
    );

  if (filters?.sessionId) {
    console.log('📦 getOrders - Filtering by session_id:', filters.sessionId);
    query = query.eq('session_id', filters.sessionId);
  }
  if (filters?.status) query = query.eq('status', filters.status);

  query = query.order('created_at', { ascending: false });

  const limit = filters?.limit || 20;
  const page = filters?.page || 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;
  
  console.log('📦 getOrders - Query result:', { data, error, count });
  
  if (error) throw error;

  return {
    orders: data || [],
    total: count || 0,
    page,
    limit,
  };
}

export async function adminGetOrders(filters?: {
  sessionId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  let query = supabaseAdmin
    .from('orders')
    .select(
      `
      *,
      order_items(
        id,
        product_id,
        variant_id,
        title_snapshot,
        unit_price_dzd,
        qty,
        line_total_dzd
      )
    `,
      { count: 'exact' }
    );

  if (filters?.sessionId) query = query.eq('session_id', filters.sessionId);
  if (filters?.status) query = query.eq('status', filters.status);

  query = query.order('created_at', { ascending: false });

  const limit = filters?.limit || 20;
  const page = filters?.page || 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    orders: data || [],
    total: count || 0,
    page,
    limit,
  };
}

export async function adminGetOrderItemsAnalytics(limit = 5000) {
  const { data, error } = await supabaseAdmin
    .from('order_items')
    .select(
      `
      qty,
      line_total_dzd,
      products(
        id,
        title_fr,
        title_ar,
        brands(name)
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return {
    items: data || [],
  };
}

export async function adminGetAnalyticsData(filters?: {
  from?: string;
  to?: string;
  status?: string;
  wilayaCode?: string;
  brandId?: string;
  categoryId?: string;
  departmentId?: string;
  limit?: number;
}) {
  const limit = filters?.limit || 20000;

  let itemsQuery = supabaseAdmin
    .from('order_items')
    .select(
      `
      order_id,
      qty,
      line_total_dzd,
      created_at,
      orders!inner(id, status, created_at, wilaya_code, total_dzd),
      products!inner(
        id,
        title_fr,
        title_ar,
        brand_id,
        category_id,
        department_id,
        brands(name),
        categories(name_fr),
        departments(name_fr)
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters?.from) itemsQuery = itemsQuery.gte('orders.created_at', filters.from);
  if (filters?.to) itemsQuery = itemsQuery.lte('orders.created_at', filters.to);
  if (filters?.status) itemsQuery = itemsQuery.eq('orders.status', filters.status);
  if (filters?.wilayaCode) itemsQuery = itemsQuery.eq('orders.wilaya_code', filters.wilayaCode);
  if (filters?.brandId) itemsQuery = itemsQuery.eq('products.brand_id', filters.brandId);
  if (filters?.categoryId) itemsQuery = itemsQuery.eq('products.category_id', filters.categoryId);
  if (filters?.departmentId) itemsQuery = itemsQuery.eq('products.department_id', filters.departmentId);

  const { data: orderItems, error: itemsError } = await itemsQuery;
  if (itemsError) throw itemsError;

  const orderIds = Array.from(
    new Set((orderItems || []).map((item: any) => item.order_id).filter(Boolean))
  ) as string[];

  let orders: any[] = [];

  if (orderIds.length > 0 || (!filters?.brandId && !filters?.categoryId && !filters?.departmentId)) {
    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('id, created_at, status, total_dzd, wilaya_code')
      .order('created_at', { ascending: false });

    if (filters?.from) ordersQuery = ordersQuery.gte('created_at', filters.from);
    if (filters?.to) ordersQuery = ordersQuery.lte('created_at', filters.to);
    if (filters?.status) ordersQuery = ordersQuery.eq('status', filters.status);
    if (filters?.wilayaCode) ordersQuery = ordersQuery.eq('wilaya_code', filters.wilayaCode);

    if (filters?.brandId || filters?.categoryId || filters?.departmentId) {
      ordersQuery = ordersQuery.in('id', orderIds.length > 0 ? orderIds : ['00000000-0000-0000-0000-000000000000']);
    }

    const { data: ordersData, error: ordersError } = await ordersQuery;
    if (ordersError) throw ordersError;
    orders = ordersData || [];
  }

  return {
    orders,
    orderItems: orderItems || [],
  };
}

export async function getOrderById(id: string) {
  const { data, error } = await supabaseAnon
    .from('orders')
    .select(
      `
      *,
      order_items(
        id,
        product_id,
        variant_id,
        title_snapshot,
        unit_price_dzd,
        qty,
        line_total_dzd
      )
    `
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function adminGetOrderById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(
      `
      *,
      order_items(
        id,
        product_id,
        variant_id,
        title_snapshot,
        unit_price_dzd,
        qty,
        line_total_dzd
      )
    `
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(
  id: string,
  data: {
    status?: string;
    admin_note?: string;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('orders')
    .update({
      status: data.status,
      admin_note: data.admin_note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function createOrder(data: {
  order_number: string;
  session_id: string;
  status?: string;
  payment_method: string;
  subtotal: number;
  shipping: number;
  total: number;
  wilaya_code: number;
  delivery_method: 'home' | 'desk';
  address_snapshot: Record<string, any>;
  customer_note?: string;
  admin_note?: string;
}) {
  const { data: result, error } = await supabaseAdmin
    .from('orders')
    .insert([{
      order_number: data.order_number,
      session_id: data.session_id,
      status: data.status || 'pending',
      payment_method: data.payment_method,
      subtotal_dzd: data.subtotal,
      shipping_dzd: data.shipping,
      total_dzd: data.total,
      wilaya_code: data.wilaya_code,
      delivery_method: data.delivery_method,
      address_snapshot: data.address_snapshot,
      customer_note: data.customer_note,
    }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function addOrderItem(data: {
  order_id: string;
  product_id: string;
  variant_id?: string;
  title_snapshot: string;
  unit_price_dzd: number;
  qty: number;
  line_total_dzd: number;
}) {
  const { data: result, error } = await supabaseAdmin
    .from('order_items')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ============================================================================
// CART REPOSITORY
// ============================================================================

export async function getOrCreateCart(sessionId: string) {
  const { data: existing, error: getError } = await supabaseAnon
    .from('carts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .single();

  if (existing) return existing;

  const { data: created, error: createError } = await supabaseAdmin
    .from('carts')
    .insert([
      {
        session_id: sessionId,
        status: 'active',
      },
    ])
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

export async function getCartWithItems(cartId: string) {
  const { data, error } = await supabaseAnon
    .from('carts')
    .select(
      `
      *,
      cart_items(
        id,
        product_id,
        variant_id,
        qty,
        price_snapshot_dzd,
        products(id, slug, title_fr, title_ar, product_images(url))
      )
    `
    )
    .eq('id', cartId)
    .single();
  if (error) throw error;
  return data;
}

export async function addCartItem(data: {
  cart_id: string;
  product_id: string;
  variant_id?: string;
  qty: number;
  price_snapshot_dzd: number;
}) {
  const { data: result, error } = await supabaseAdmin
    .from('cart_items')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateCartItem(
  id: string,
  data: {
    qty?: number;
    price_snapshot_dzd?: number;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('cart_items')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function removeCartItem(id: string) {
  const { error } = await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function clearCart(cartId: string) {
  const { error } = await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('cart_id', cartId);
  if (error) throw error;
}

export async function convertCart(cartId: string) {
  const { error } = await supabaseAdmin
    .from('carts')
    .update({ status: 'converted' })
    .eq('id', cartId);
  if (error) throw error;
}

// ============================================================================
// CONTENT REPOSITORY
// ============================================================================

export async function getHomePageBanners() {
  const { data, error } = await supabaseAnon
    .from('homepage_banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function createHomepageBanner(data: {
  title_fr: string;
  title_ar: string;
  description_fr?: string;
  description_ar?: string;
  image_url: string;
  link_url?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const { data: result, error } = await supabaseAdmin
    .from('homepage_banners')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateHomepageBanner(
  id: string,
  data: {
    title_fr?: string;
    title_ar?: string;
    description_fr?: string;
    description_ar?: string;
    image_url?: string;
    link_url?: string;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('homepage_banners')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteHomepageBanner(id: string) {
  const { error } = await supabaseAdmin
    .from('homepage_banners')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getMarqueeBrands() {
  const { data, error } = await supabaseAnon
    .from('marquee_brands')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function createMarqueeBrand(data: {
  brand_id: string;
  logo_url: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const { data: result, error } = await supabaseAdmin
    .from('marquee_brands')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateMarqueeBrand(
  id: string,
  data: {
    brand_id?: string;
    logo_url?: string;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('marquee_brands')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ============================================================================
// CUSTOMER PROFILE OPERATIONS
// ============================================================================

export async function getCustomerProfile(sessionId: string) {
  const { data, error } = await supabaseAnon
    .from('customer_profiles')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function getCustomerProfileByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseAnon
    .from('customer_profiles')
    .select('*')
    .ilike('email', normalizedEmail)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertCustomerProfile(data: {
  session_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  password_hash?: string;
  password_salt?: string;
}) {
  const { data: result, error } = await supabaseAnon
    .from('customer_profiles')
    .upsert(
      {
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' }
    )
    .select()
    .single();
  
  if (error) throw error;
  return result;
}

// ============================================================================
// ADMIN CUSTOMER OPERATIONS
// ============================================================================

export async function adminGetCustomers() {
  const [
    { data: profiles, error: profilesError },
    { data: orders, error: ordersError },
    { data: wilayas, error: wilayasError },
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_profiles')
      .select('id, session_id, first_name, last_name, email, phone, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('orders')
      .select('session_id, total_dzd, created_at, wilaya_code')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('shipping_wilayas')
      .select('code, name_fr, name_ar'),
  ]);

  if (profilesError) throw profilesError;
  if (ordersError) throw ordersError;
  if (wilayasError) throw wilayasError;

  const wilayaMap = new Map<number, { name_fr: string; name_ar: string }>();
  (wilayas || []).forEach((row: any) => {
    const code = Number(row.code);
    if (Number.isFinite(code)) {
      wilayaMap.set(code, {
        name_fr: row.name_fr || '',
        name_ar: row.name_ar || '',
      });
    }
  });

  const summaryBySession = new Map<
    string,
    {
      count: number;
      total: number;
      lastOrderAt: Date | null;
      lastWilayaCode: number | null;
    }
  >();

  (orders || []).forEach((order: any) => {
    const sessionId = order.session_id;
    if (!sessionId) return;

    const entry = summaryBySession.get(sessionId) || {
      count: 0,
      total: 0,
      lastOrderAt: null as Date | null,
      lastWilayaCode: null as number | null,
    };

    entry.count += 1;

    const parsedTotal = Number.parseFloat(String(order.total_dzd ?? 0));
    if (Number.isFinite(parsedTotal)) {
      entry.total += parsedTotal;
    }

    const createdAt = order.created_at ? new Date(order.created_at) : null;
    if (!entry.lastOrderAt || (createdAt && createdAt > entry.lastOrderAt)) {
      entry.lastOrderAt = createdAt;
      const wilayaCode = Number(order.wilaya_code);
      entry.lastWilayaCode = Number.isFinite(wilayaCode) ? wilayaCode : null;
    }

    summaryBySession.set(sessionId, entry);
  });

  const customers = (profiles || []).map((profile: any) => {
    const summary = summaryBySession.get(profile.session_id) || {
      count: 0,
      total: 0,
      lastOrderAt: null,
      lastWilayaCode: null,
    };

    const nameParts = [profile.first_name, profile.last_name].filter(Boolean);
    const name = nameParts.join(' ').trim() || profile.email || 'Client';
    const wilaya = summary.lastWilayaCode
      ? wilayaMap.get(summary.lastWilayaCode) || null
      : null;

    return {
      id: profile.id,
      session_id: profile.session_id,
      name,
      email: profile.email || '',
      phone: profile.phone || '',
      join_date: profile.created_at || null,
      orders_count: summary.count,
      total_spent_dzd: summary.total,
      last_order_at: summary.lastOrderAt ? summary.lastOrderAt.toISOString() : null,
      wilaya_code: summary.lastWilayaCode,
      wilaya_name_fr: wilaya?.name_fr || '',
      wilaya_name_ar: wilaya?.name_ar || '',
    };
  });

  return { customers };
}

export async function deleteMarqueeBrand(id: string) {
  const { error } = await supabaseAdmin
    .from('marquee_brands')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================================
// CONTACT MESSAGES REPOSITORY
// ============================================================================

export async function createContactMessage(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const { data: result, error } = await supabaseAnon
    .from('contact_messages')
    .insert([
      {
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getContactMessages(filters?: {
  status?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}) {
  let query = supabaseAdmin
    .from('contact_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.isRead !== undefined) {
    query = query.eq('is_read', filters.isRead);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    messages: data || [],
    total: count || 0,
  };
}

export async function updateContactMessage(
  id: string,
  data: {
    status?: string;
    is_read?: boolean;
    admin_note?: string;
  }
) {
  const { data: result, error } = await supabaseAdmin
    .from('contact_messages')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteContactMessage(id: string) {
  const { error } = await supabaseAdmin
    .from('contact_messages')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
