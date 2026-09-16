"use server";

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { StoreSettings } from "@/lib/store-settings";

function requireEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is required. Please set it in your environment or .env.local.`,
    );
  }
  return value;
}

const SUPABASE_URL = requireEnvVar(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
const SUPABASE_ANON_KEY = requireEnvVar(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const SUPABASE_SERVICE_ROLE_KEY = requireEnvVar(
  "SUPABASE_SERVICE_ROLE_KEY",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Service role client for admin operations
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Anon client for public operations
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseStorageObjectFromUrl(
  urlValue: string,
): { bucket: string; path: string } | null {
  try {
    const baseOrigin = new URL(SUPABASE_URL).origin;
    const url = new URL(urlValue);
    if (url.origin !== baseOrigin) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "storage");
    if (idx === -1) return null;

    // Expected: /storage/v1/object/<public|sign|...>/<bucket>/<path...>
    const storageParts = parts.slice(idx);
    if (
      storageParts[0] !== "storage" ||
      storageParts[1] !== "v1" ||
      storageParts[2] !== "object"
    )
      return null;
    if (storageParts.length < 6) return null;

    const bucket = storageParts[4];
    const path = storageParts.slice(5).join("/");
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

async function toSignedStorageUrl(
  urlValue: string | null | undefined,
  expiresInSeconds = 60 * 60 * 24 * 365,
): Promise<string | null> {
  const raw = String(urlValue || "").trim();
  if (!raw) return null;

  const parsed = parseStorageObjectFromUrl(raw);
  if (!parsed) return raw;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, expiresInSeconds);
    if (error) return raw;
    return data?.signedUrl || raw;
  } catch {
    return raw;
  }
}

function shouldFallbackToAdminRead(
  error: { message?: string; code?: string; status?: number } | null,
) {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("invalid api key") ||
    message.includes("invalid jwt") ||
    message.includes("jwt malformed")
  );
}

// ============================================================================
// DEPARTMENTS REPOSITORY
// ============================================================================

export async function getDepartments(onlyActive = false) {
  let query = supabaseAnon.from("departments").select("*").order("sort_order");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    if (!shouldFallbackToAdminRead(error)) throw error;
    let adminQuery = supabaseAdmin
      .from("departments")
      .select("*")
      .order("sort_order");
    if (onlyActive) adminQuery = adminQuery.eq("is_active", true);
    const { data: adminData, error: adminError } = await adminQuery;
    if (adminError) throw adminError;
    return adminData || [];
  }
  return data || [];
}

export async function getDepartmentById(id: string) {
  const { data, error } = await supabaseAnon
    .from("departments")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getDepartmentBySlug(slug: string) {
  const { data, error } = await supabaseAnon
    .from("departments")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error && error.code !== "PGRST116") throw error;
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
    throw new Error("slug, name_fr, and name_ar are required");
  }

  const { data: result, error } = await supabaseAdmin
    .from("departments")
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
    image_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("departments")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteDepartment(id: string) {
  const { error } = await supabaseAdmin
    .from("departments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================================
// CATEGORIES REPOSITORY
// ============================================================================

export async function getCategories(onlyActive = false) {
  let query = supabaseAnon
    .from("categories")
    .select(
      onlyActive
        ? "*, departments!inner(id, slug, name_fr, name_ar, is_active)"
        : "*, departments(id, slug, name_fr, name_ar)",
    )
    .order("sort_order");

  if (onlyActive) {
    query = query.eq("is_active", true).eq("departments.is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    if (!shouldFallbackToAdminRead(error)) throw error;
    let adminQuery = supabaseAdmin
      .from("categories")
      .select(
        onlyActive
          ? "*, departments!inner(id, slug, name_fr, name_ar, is_active)"
          : "*, departments(id, slug, name_fr, name_ar)",
      )
      .order("sort_order");
    if (onlyActive) {
      adminQuery = adminQuery
        .eq("is_active", true)
        .eq("departments.is_active", true);
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
  onlyActive = false,
) {
  let query = supabaseAnon
    .from("categories")
    .select("*")
    .eq("department_id", departmentId)
    .order("sort_order");

  if (parentId === undefined || parentId === null) {
    query = query.is("parent_id", null);
  } else {
    query = query.eq("parent_id", parentId);
  }

  if (onlyActive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    if (!shouldFallbackToAdminRead(error)) throw error;
    let adminQuery = supabaseAdmin
      .from("categories")
      .select("*")
      .eq("department_id", departmentId)
      .order("sort_order");

    if (parentId === undefined || parentId === null) {
      adminQuery = adminQuery.is("parent_id", null);
    } else {
      adminQuery = adminQuery.eq("parent_id", parentId);
    }

    if (onlyActive) adminQuery = adminQuery.eq("is_active", true);

    const { data: adminData, error: adminError } = await adminQuery;
    if (adminError) throw adminError;
    return adminData || [];
  }
  return data || [];
}

export async function getCategoryById(id: string) {
  const { data, error } = await supabaseAnon
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (!shouldFallbackToAdminRead(error)) throw error;
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();
    if (adminError) throw adminError;
    return adminData;
  }
  return data;
}

export async function getCategoryBySlug(slug: string, departmentId?: string) {
  let query = supabaseAnon.from("categories").select("*").eq("slug", slug);
  if (departmentId) query = query.eq("department_id", departmentId);
  const { data, error } = await query.single();
  if (error && error.code !== "PGRST116") {
    if (!shouldFallbackToAdminRead(error)) throw error;
    let adminQuery = supabaseAdmin
      .from("categories")
      .select("*")
      .eq("slug", slug);
    if (departmentId) adminQuery = adminQuery.eq("department_id", departmentId);
    const { data: adminData, error: adminError } = await adminQuery.single();
    if (adminError && adminError.code !== "PGRST116") throw adminError;
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
    throw new Error("department_id, slug, name_fr, and name_ar are required");
  }

  const { data: result, error } = await supabaseAdmin
    .from("categories")
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
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("categories")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteCategory(id: string) {
  const { error } = await supabaseAdmin
    .from("categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Taxonomy-specific functions for admin
export async function getCategoryTreeByDepartment(departmentId: string) {
  // Fetch all categories for this department
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("department_id", departmentId)
    .order("sort_order");
  if (error) throw error;

  // Build tree structure
  const categories = data || [];
  const roots = categories.filter((c) => !c.parent_id);

  // Recursive function to build children
  const buildTree = (parentId: string | null = null): any[] => {
    return categories
      .filter((c) => c.parent_id === (parentId || null))
      .map((cat) => ({
        ...cat,
        children: buildTree(cat.id),
      }));
  };

  return buildTree(null);
}

export async function getMegaMenuTaxonomy() {
  let departments: any[] = [];
  let categories: any[] = [];

  const [
    { data: departmentsAnon, error: deptError },
    { data: categoriesAnon, error: catError },
  ] = await Promise.all([
    supabaseAnon
      .from("departments")
      .select("id, slug, name_fr, name_ar, icon, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabaseAnon
      .from("categories")
      .select(
        "id, department_id, parent_id, slug, name_fr, name_ar, sort_order",
      )
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (!deptError && !catError) {
    departments = departmentsAnon || [];
    categories = categoriesAnon || [];
  } else {
    const canFallback =
      shouldFallbackToAdminRead(deptError) ||
      shouldFallbackToAdminRead(catError);
    if (!canFallback) {
      if (deptError) throw deptError;
      if (catError) throw catError;
    }

    const [
      { data: departmentsAdmin, error: deptAdminError },
      { data: categoriesAdmin, error: catAdminError },
    ] = await Promise.all([
      supabaseAdmin
        .from("departments")
        .select("id, slug, name_fr, name_ar, icon, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      supabaseAdmin
        .from("categories")
        .select(
          "id, department_id, parent_id, slug, name_fr, name_ar, sort_order",
        )
        .eq("is_active", true)
        .order("sort_order"),
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

    const roots = departmentCategories.filter(
      (category) => !category.parent_id,
    );

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

export async function slugExistsInDepartment(
  slug: string,
  departmentId: string,
  excludeId?: string,
) {
  let query = supabaseAdmin
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .eq("department_id", departmentId);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return (data?.length || 0) > 0;
}

export async function canDeleteCategory(id: string) {
  // Check for child categories
  const { data: children, error: childError } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("parent_id", id)
    .limit(1);
  if (childError) throw childError;
  if (children && children.length > 0) {
    return { can: false, reason: "Has child categories" };
  }

  // Check for products
  const { data: products, error: prodError } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("category_id", id)
    .limit(1);
  if (prodError) throw prodError;
  if (products && products.length > 0) {
    return { can: false, reason: "Has products" };
  }

  return { can: true };
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  return updateCategory(id, { is_active: isActive });
}

export async function moveCategoryUp(id: string) {
  const cat = await getCategoryById(id);
  if (!cat) throw new Error("Category not found");

  // Find siblings
  const { data: siblings, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("department_id", cat.department_id)
    .eq("parent_id", cat.parent_id || null)
    .order("sort_order");
  if (error) throw error;

  const idx = (siblings || []).findIndex((s) => s.id === id);
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
  if (!cat) throw new Error("Category not found");

  // Find siblings
  const { data: siblings, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("department_id", cat.department_id)
    .eq("parent_id", cat.parent_id || null)
    .order("sort_order");
  if (error) throw error;

  const idx = (siblings || []).findIndex((s) => s.id === id);
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
  let query = supabaseAnon.from("brands").select("*").order("name");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  if (rows.length === 0) return rows;

  // Make logos load even if storage bucket is private by returning signed URLs.
  const signed = await Promise.all(
    rows.map(async (row: any) => ({
      ...row,
      logo_url: await toSignedStorageUrl(row?.logo_url),
    })),
  );
  return signed;
}

export async function getBrandById(id: string) {
  const { data, error } = await supabaseAnon
    .from("brands")
    .select("*")
    .eq("id", id)
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
    throw new Error("name and slug are required");
  }

  const { data: result, error } = await supabaseAdmin
    .from("brands")
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
    logo_url?: string | null;
    is_active?: boolean;
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("brands")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteBrand(id: string) {
  const { error } = await supabaseAdmin.from("brands").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================================
// PRODUCTS REPOSITORY
// ============================================================================

async function hydrateDigitalProductStock(rows: any[]) {
  const productIds = rows.map((row) => row.id);
  if (productIds.length === 0) return rows;

  const { data, error } = await supabaseAdmin
    .from("digital_inventory_units")
    .select("id, product_id")
    .in("product_id", productIds)
    .eq("status", "available");
  if (error) throw error;
  const counts = (data || []).reduce<Record<string, number>>(
    (result, row: any) => {
      result[row.product_id] = (result[row.product_id] || 0) + 1;
      return result;
    },
    {},
  );
  return rows.map((row) => {
    const usesDigitalInventory =
      ["credentials", "code"].includes(row.fulfillment_type) ||
      Object.prototype.hasOwnProperty.call(counts, row.id);
    return usesDigitalInventory
      ? {
          ...row,
          stock: counts[row.id] || 0,
          digital_inventory_count: counts[row.id] || 0,
        }
      : row;
  });
}

const PUBLIC_PRODUCT_LIST_SELECT = `
  id,
  slug,
  title_fr,
  title_ar,
  description_fr,
  description_ar,
  price_dzd,
  compare_at_price_dzd,
  is_featured,
  is_active,
  inventory_type,
  stock,
  department_id,
  category_id,
  brand_id,
  brands(id, name, slug),
  departments(id, slug, name_fr, name_ar),
  categories(id, slug, name_fr, name_ar),
  product_images(id, url, sort_order)
`;

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
    .from("products")
    .select(PUBLIC_PRODUCT_LIST_SELECT, { count: "exact" });

  if (filters?.departmentId)
    query = query.eq("department_id", filters.departmentId);
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters?.brandId) query = query.eq("brand_id", filters.brandId);
  if (filters?.search) {
    query = query.or(
      `title_fr.ilike.%${filters.search}%,title_ar.ilike.%${filters.search}%,sku.eq.${filters.search}`,
    );
  }
  if (filters?.minPrice !== undefined)
    query = query.gte("price_dzd", filters.minPrice);
  if (filters?.maxPrice !== undefined)
    query = query.lte("price_dzd", filters.maxPrice);
  if (filters?.onlyActive !== false) query = query.eq("is_active", true);

  query = query.order("created_at", { ascending: false });

  const limit = filters?.limit || 20;
  const page = filters?.page || 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    products: await hydrateDigitalProductStock(data || []),
    total: count || 0,
    page,
    limit,
  };
}

function productDetailsSelect(
  includeVariants: boolean,
  includeCommercialPrices = false,
  includeStockVariantId = false,
): string {
  const baseSelect = `
    *,
    brands(id, name, slug, logo_url),
    departments(id, slug, name_fr, name_ar),
    categories(id, slug, name_fr, name_ar),
    product_images(id, url, alt_fr, alt_ar, sort_order),
    product_specs(id, key, value_fr, value_ar, sort_order)
  `;

  if (!includeVariants) return baseSelect;

  const variantSelect = includeCommercialPrices
    ? "id, external_key, option_values, name, value, price_dzd, price_delta_dzd, price_baridimob_dzd, price_flexy_dzd, stock, is_active"
    : "id, external_key, option_values, name, value, price_dzd, price_delta_dzd, stock, is_active";
  const stockVariantSelect = includeStockVariantId ? ", stock_variant_id" : "";

  return `${baseSelect}, product_variants(${variantSelect}${stockVariantSelect})`;
}

export async function getProductById(id: string) {
  const includeVariants = await hasProductVariantsTable();
  const includeCommercialPrices =
    includeVariants && (await hasCommercialVariantPriceColumns());
  const includeStockVariantId =
    includeVariants && (await hasStockVariantIdColumn());
  const { data, error } = await supabaseAnon
    .from("products")
    .select(
      productDetailsSelect(
        includeVariants,
        includeCommercialPrices,
        includeStockVariantId,
      ),
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return (await hydrateDigitalProductStock([data]))[0];
}

export async function getProductBySlug(slug: string) {
  const includeVariants = await hasProductVariantsTable();
  const includeCommercialPrices =
    includeVariants && (await hasCommercialVariantPriceColumns());
  const includeStockVariantId =
    includeVariants && (await hasStockVariantIdColumn());
  const { data, error } = await supabaseAnon
    .from("products")
    .select(
      productDetailsSelect(
        includeVariants,
        includeCommercialPrices,
        includeStockVariantId,
      ),
    )
    .eq("slug", slug)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (await hydrateDigitalProductStock([data]))[0] : null;
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
  id?: string;
  name: string;
  value: string;
  external_key?: string | null;
  option_values?: Record<string, string>;
  price_dzd?: number | null;
  price_baridimob_dzd?: number | null;
  price_flexy_dzd?: number | null;
  price_delta_dzd?: number;
  stock?: number;
  is_active?: boolean;
}

export interface ProductSeoInput {
  meta_title_fr?: string | null;
  meta_title_ar?: string | null;
  meta_description_fr?: string | null;
  meta_description_ar?: string | null;
}

const PRODUCT_IMAGES_BUCKET = "product-images";
let productImagesBucketReady = false;
let hasSeoColumnsCache: boolean | null = null;
let hasVariantsTableCache: boolean | null = null;
let hasCommercialVariantPricesCache: boolean | null = null;
let hasStockVariantIdCache: boolean | null = null;

function normalizeOptionalText(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMissingResourceError(
  error: { message?: string; code?: string } | null,
) {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  const code = String(error.code || "").toLowerCase();
  return (
    code === "42p01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("not found")
  );
}

export async function productSlugExists(slug: string, excludeId?: string) {
  let query = supabaseAdmin
    .from("products")
    .select("id")
    .eq("slug", slug)
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data?.length || 0) > 0;
}

export async function hasProductSeoColumns() {
  if (hasSeoColumnsCache !== null) return hasSeoColumnsCache;

  const { error } = await supabaseAdmin
    .from("products")
    .select(
      "id, meta_title_fr, meta_title_ar, meta_description_fr, meta_description_ar",
    )
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

  const { error } = await supabaseAdmin
    .from("product_variants")
    .select("id")
    .limit(1);
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

export async function hasCommercialVariantPriceColumns() {
  if (hasCommercialVariantPricesCache !== null)
    return hasCommercialVariantPricesCache;

  const { error } = await supabaseAdmin
    .from("product_variants")
    .select("id, price_baridimob_dzd, price_flexy_dzd")
    .limit(1);
  if (!error) {
    hasCommercialVariantPricesCache = true;
    return true;
  }

  if (isMissingResourceError(error)) {
    hasCommercialVariantPricesCache = false;
    return false;
  }

  throw error;
}

export async function hasStockVariantIdColumn() {
  if (hasStockVariantIdCache !== null) return hasStockVariantIdCache;

  const { error } = await supabaseAdmin
    .from("product_variants")
    .select("id, stock_variant_id")
    .limit(1);
  if (!error) {
    hasStockVariantIdCache = true;
    return true;
  }

  if (isMissingResourceError(error)) {
    hasStockVariantIdCache = false;
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
  price_dzd: number | null;
  price_baridimob_dzd?: number | null;
  price_flexy_dzd?: number | null;
  price_slickpay_dzd?: number | null;
  compare_at_price_dzd?: number | null;
  sku?: string | null;
  stock: number;
  inventory_type?: "finite" | "unlimited";
  fulfillment_type?: "file" | "link" | "code" | "credentials" | "manual";
  is_featured?: boolean;
  is_active?: boolean;
}) {
  if (
    !data.slug ||
    !data.title_fr ||
    !data.title_ar ||
    !data.department_id ||
    !data.category_id
  ) {
    throw new Error(
      "slug, title_fr, title_ar, department_id, and category_id are required",
    );
  }

  if ((data.price_dzd !== null && data.price_dzd < 0) || data.stock < 0) {
    throw new Error("price_dzd and stock must be >= 0");
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
    price_baridimob_dzd: data.price_baridimob_dzd ?? data.price_dzd,
    price_flexy_dzd: data.price_flexy_dzd ?? data.price_dzd,
    price_slickpay_dzd: data.price_slickpay_dzd ?? data.price_dzd,
    compare_at_price_dzd: data.compare_at_price_dzd ?? null,
    sku: normalizeOptionalText(data.sku),
    stock: data.stock,
    inventory_type: data.inventory_type ?? "finite",
    fulfillment_type: data.fulfillment_type ?? "manual",
    is_featured: data.is_featured ?? false,
    is_active: data.is_active ?? true,
  };

  const { data: result, error } = await supabaseAdmin
    .from("products")
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
    price_dzd?: number | null;
    price_baridimob_dzd?: number | null;
    price_flexy_dzd?: number | null;
    price_slickpay_dzd?: number | null;
    compare_at_price_dzd?: number | null;
    sku?: string | null;
    stock?: number;
    inventory_type?: "finite" | "unlimited";
    fulfillment_type?: "file" | "link" | "code" | "credentials" | "manual";
    is_featured?: boolean;
    is_active?: boolean;
  },
) {
  if (
    data.price_dzd !== undefined &&
    data.price_dzd !== null &&
    data.price_dzd < 0
  ) {
    throw new Error("price_dzd must be >= 0");
  }
  if (data.stock !== undefined && data.stock < 0) {
    throw new Error("stock must be >= 0");
  }

  const patch: Record<string, unknown> = {};

  if ("slug" in data) patch.slug = data.slug;
  if ("title_fr" in data) patch.title_fr = data.title_fr;
  if ("title_ar" in data) patch.title_ar = data.title_ar;
  if ("description_fr" in data)
    patch.description_fr = normalizeOptionalText(data.description_fr);
  if ("description_ar" in data)
    patch.description_ar = normalizeOptionalText(data.description_ar);
  if ("brand_id" in data) patch.brand_id = normalizeOptionalText(data.brand_id);
  if ("department_id" in data) patch.department_id = data.department_id;
  if ("category_id" in data) patch.category_id = data.category_id;
  if ("price_dzd" in data) patch.price_dzd = data.price_dzd;
  if ("price_baridimob_dzd" in data)
    patch.price_baridimob_dzd = data.price_baridimob_dzd;
  if ("price_flexy_dzd" in data) patch.price_flexy_dzd = data.price_flexy_dzd;
  if ("price_slickpay_dzd" in data)
    patch.price_slickpay_dzd = data.price_slickpay_dzd;
  if ("compare_at_price_dzd" in data)
    patch.compare_at_price_dzd = data.compare_at_price_dzd ?? null;
  if ("sku" in data) patch.sku = normalizeOptionalText(data.sku);
  if ("stock" in data) patch.stock = data.stock;
  if ("inventory_type" in data) patch.inventory_type = data.inventory_type;
  if ("fulfillment_type" in data)
    patch.fulfillment_type = data.fulfillment_type;
  if ("is_featured" in data) patch.is_featured = data.is_featured;
  if ("is_active" in data) patch.is_active = data.is_active;

  const { data: result, error } = await supabaseAdmin
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteProduct(id: string) {
  const { error } = await supabaseAdmin.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceProductSpecs(
  productId: string,
  specs: ProductSpecInput[],
) {
  const { error: deleteError } = await supabaseAdmin
    .from("product_specs")
    .delete()
    .eq("product_id", productId);
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

  const { data, error } = await supabaseAdmin
    .from("product_specs")
    .insert(rows)
    .select();
  if (error) throw error;
  return data || [];
}

export async function replaceProductImages(
  productId: string,
  images: ProductImageInput[],
) {
  const { error: deleteError } = await supabaseAdmin
    .from("product_images")
    .delete()
    .eq("product_id", productId);
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

  const { data, error } = await supabaseAdmin
    .from("product_images")
    .insert(rows)
    .select();
  if (error) throw error;
  return data || [];
}

export async function replaceProductVariants(
  productId: string,
  variants: ProductVariantInput[],
) {
  const supportsVariants = await hasProductVariantsTable();
  if (!supportsVariants) {
    return [];
  }

  const rows = variants
    .filter(
      (variant) =>
        variant.name.trim().length > 0 && variant.value.trim().length > 0,
    )
    .map((variant) => ({
      id: variant.id,
      product_id: productId,
      name: variant.name.trim(),
      value: variant.value.trim(),
      external_key: variant.external_key || null,
      option_values: variant.option_values || {},
      price_dzd: variant.price_dzd ?? null,
      price_delta_dzd: variant.price_delta_dzd ?? 0,
      price_baridimob_dzd: variant.price_baridimob_dzd ?? null,
      price_flexy_dzd: variant.price_flexy_dzd ?? null,
      stock: variant.stock ?? 0,
      is_active: variant.is_active ?? true,
    }));

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);
  if (existingError) throw existingError;

  const isUuid = (value: unknown) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  const existingIds = new Set((existing || []).map((row: any) => row.id));
  const incomingExistingIds = new Set(
    rows
      .map((row: any) => row.id)
      .filter((id: unknown) => isUuid(id) && existingIds.has(id)),
  );
  const saved: any[] = [];

  for (const row of rows) {
    const { id, ...values } = row;
    if (isUuid(id) && existingIds.has(id)) {
      const { data, error } = await supabaseAdmin
        .from("product_variants")
        .update(values)
        .eq("id", id)
        .eq("product_id", productId)
        .select()
        .single();
      if (error) throw error;
      saved.push(data);
    } else {
      const { data, error } = await supabaseAdmin
        .from("product_variants")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      saved.push(data);
    }
  }

  for (const row of existing || []) {
    if (incomingExistingIds.has(row.id)) continue;
    const { count, error: countError } = await supabaseAdmin
      .from("digital_inventory_units")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", row.id);
    if (countError && !isMissingResourceError(countError)) throw countError;
    if ((count || 0) > 0) {
      const { error } = await supabaseAdmin
        .from("product_variants")
        .update({ is_active: false })
        .eq("id", row.id)
        .eq("product_id", productId);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("product_variants")
        .delete()
        .eq("id", row.id)
        .eq("product_id", productId);
      if (error) throw error;
    }
  }

  return saved;
}

export async function updateProductSeo(
  productId: string,
  seo: ProductSeoInput,
) {
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
    .from("products")
    .update(payload)
    .eq("id", productId)
    .select(
      "id, meta_title_fr, meta_title_ar, meta_description_fr, meta_description_ar",
    )
    .single();
  if (error) throw error;
  return { supported: true as const, data };
}

async function ensureProductImagesBucket() {
  if (productImagesBucketReady) return;

  const { data: bucket, error: bucketError } =
    await supabaseAdmin.storage.getBucket(PRODUCT_IMAGES_BUCKET);

  if (!bucket && !isMissingResourceError(bucketError)) {
    throw bucketError;
  }

  if (!bucket) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(
      PRODUCT_IMAGES_BUCKET,
      {
        public: true,
        fileSizeLimit: "10MB",
      },
    );

    if (
      createError &&
      !String(createError.message || "")
        .toLowerCase()
        .includes("already exists")
    ) {
      throw createError;
    }
  } else if (bucket.public !== true) {
    // If the bucket already exists but is private, public URLs from getPublicUrl() will not load in the browser.
    // Use a best-effort update to flip it to public.
    try {
      const storageAny: any = supabaseAdmin.storage as any;
      if (typeof storageAny.updateBucket === "function") {
        const { error: updateError } = await storageAny.updateBucket(
          PRODUCT_IMAGES_BUCKET,
          {
            public: true,
          },
        );
        if (updateError) throw updateError;
      }
    } catch (error) {
      console.warn("Failed to update bucket visibility:", error);
    }
  }

  productImagesBucketReady = true;
}

export async function uploadProductImage(file: File) {
  await ensureProductImagesBucket();

  const extension = file.name.includes(".")
    ? file.name.split(".").pop()
    : undefined;
  const safeExt = (extension || "bin").toLowerCase();
  const objectPath = `${new Date().getUTCFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(objectPath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;

  const publicData = supabaseAdmin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(objectPath).data;
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
    .from("product_images")
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteProductImage(id: string) {
  const { error } = await supabaseAdmin
    .from("product_images")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================================
// SHIPPING REPOSITORY
// ============================================================================

export async function getWilayas() {
  const { data, error } = await supabaseAnon
    .from("shipping_wilayas")
    .select("*")
    .order("code");
  if (error) throw error;
  return data || [];
}

export async function getWilayaByCode(code: string) {
  const { data, error } = await supabaseAnon
    .from("shipping_wilayas")
    .select("*")
    .eq("code", code)
    .single();
  if (error) throw error;
  return data;
}

export async function getShippingRates(
  wilayaCode?: string,
  method?: "home" | "stopdesk",
) {
  let query = supabaseAnon.from("shipping_rates").select("*");
  if (wilayaCode) query = query.eq("wilaya_code", wilayaCode);
  if (method) query = query.eq("method", method);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getShippingRate(
  wilayaCode: string,
  method: "home" | "stopdesk",
) {
  const { data, error } = await supabaseAnon
    .from("shipping_rates")
    .select("*")
    .eq("wilaya_code", wilayaCode)
    .eq("method", method)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

export async function updateShippingRate(
  wilayaCode: string,
  method: "home" | "stopdesk",
  data: {
    price_dzd?: number;
    eta_min_days?: number;
    eta_max_days?: number;
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("shipping_rates")
    .update(data)
    .eq("wilaya_code", wilayaCode)
    .eq("method", method)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getShippingRules() {
  const { data, error } = await supabaseAnon
    .from("shipping_rules")
    .select("*")
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
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
    .from("shipping_rules")
    .upsert(
      {
        id: rules.id || "00000000-0000-0000-0000-000000000000",
        ...data,
      },
      { onConflict: "id" },
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
  email?: string;
  phone?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  console.log("📦 getOrders - Filters:", filters);

  const queryClient =
    filters?.email || filters?.phone ? supabaseAdmin : supabaseAnon;
  let query = queryClient.from("orders").select(
    `
      *,
      order_items(
        id,
        product_id,
        variant_id,
        products(fulfillment_type),
        title_snapshot,
        unit_price_dzd,
        qty,
        line_total_dzd
      ),
      payments(*),
      digital_deliveries(id, status, delivered_at)
    `,
    { count: "exact" },
  );

  if (filters?.sessionId) {
    console.log("📦 getOrders - Filtering by session_id:", filters.sessionId);
    query = query.eq("session_id", filters.sessionId);
  }
  if (filters?.email)
    query = query.ilike(
      "address_snapshot->>email",
      filters.email.trim().toLowerCase(),
    );
  if (filters?.phone)
    query = query.ilike("address_snapshot->>phone", filters.phone.trim());
  if (filters?.status) query = query.eq("status", filters.status);

  query = query.order("created_at", { ascending: false });

  const limit = filters?.limit || 20;
  const page = filters?.page || 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;

  console.log("📦 getOrders - Query result:", { data, error, count });

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
  let query = supabaseAdmin.from("orders").select(
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
      ),
      payments(*)
    `,
    { count: "exact" },
  );

  if (filters?.sessionId) query = query.eq("session_id", filters.sessionId);
  if (filters?.status) query = query.eq("status", filters.status);

  query = query.order("created_at", { ascending: false });

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
    .from("order_items")
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
    `,
    )
    .order("created_at", { ascending: false })
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
    .from("order_items")
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
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.from)
    itemsQuery = itemsQuery.gte("orders.created_at", filters.from);
  if (filters?.to) itemsQuery = itemsQuery.lte("orders.created_at", filters.to);
  if (filters?.status)
    itemsQuery = itemsQuery.eq("orders.status", filters.status);
  if (filters?.wilayaCode)
    itemsQuery = itemsQuery.eq("orders.wilaya_code", filters.wilayaCode);
  if (filters?.brandId)
    itemsQuery = itemsQuery.eq("products.brand_id", filters.brandId);
  if (filters?.categoryId)
    itemsQuery = itemsQuery.eq("products.category_id", filters.categoryId);
  if (filters?.departmentId)
    itemsQuery = itemsQuery.eq("products.department_id", filters.departmentId);

  const { data: orderItems, error: itemsError } = await itemsQuery;
  if (itemsError) throw itemsError;

  const orderIds = Array.from(
    new Set(
      (orderItems || []).map((item: any) => item.order_id).filter(Boolean),
    ),
  ) as string[];

  let orders: any[] = [];

  if (
    orderIds.length > 0 ||
    (!filters?.brandId && !filters?.categoryId && !filters?.departmentId)
  ) {
    let ordersQuery = supabaseAdmin
      .from("orders")
      .select("id, created_at, status, total_dzd, wilaya_code")
      .order("created_at", { ascending: false });

    if (filters?.from)
      ordersQuery = ordersQuery.gte("created_at", filters.from);
    if (filters?.to) ordersQuery = ordersQuery.lte("created_at", filters.to);
    if (filters?.status) ordersQuery = ordersQuery.eq("status", filters.status);
    if (filters?.wilayaCode)
      ordersQuery = ordersQuery.eq("wilaya_code", filters.wilayaCode);

    if (filters?.brandId || filters?.categoryId || filters?.departmentId) {
      ordersQuery = ordersQuery.in(
        "id",
        orderIds.length > 0
          ? orderIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
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
    .from("orders")
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
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getCustomerOrderById(
  id: string,
  sessionId: string,
  email?: string | null,
  phone?: string | null,
) {
  const orderSelect =
    "*, order_items(id, product_id, variant_id, title_snapshot, unit_price_dzd, qty, line_total_dzd)";
  let { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(orderSelect)
    .eq("id", id)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!order && email) {
    const fallback = await supabaseAdmin
      .from("orders")
      .select(orderSelect)
      .eq("id", id)
      .ilike("address_snapshot->>email", email.trim().toLowerCase())
      .maybeSingle();
    order = fallback.data;
    orderError = fallback.error;
  }
  if (!order && phone) {
    const fallback = await supabaseAdmin
      .from("orders")
      .select(orderSelect)
      .eq("id", id)
      .ilike("address_snapshot->>phone", phone.trim())
      .maybeSingle();
    order = fallback.data;
    orderError = fallback.error;
  }
  if (orderError) throw orderError;
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const { data: payments, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select(
      "id, method, status, amount_dzd, failure_reason, created_at, verified_at",
    )
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  if (paymentError) throw paymentError;
  const { data: fulfillments } = await supabaseAdmin
    .from("order_fulfillments")
    .select("id, fulfillment_type, status, created_at, delivered_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  const { data: deliveries } = await supabaseAdmin
    .from("digital_deliveries")
    .select("id, status, created_at, delivered_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  return {
    ...order,
    payments: payments || [],
    order_fulfillments: fulfillments || [],
    digital_deliveries: deliveries || [],
  };
}

export async function adminGetOrderById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      *,
      order_items(
        id,
        product_id,
        variant_id,
        products(fulfillment_type),
        title_snapshot,
        unit_price_dzd,
        qty,
        line_total_dzd
      ),
      payments(*),
      order_fulfillments(*),
      digital_deliveries(*)
    `,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  const paymentIds = ((data?.payments || []) as any[])
    .map((payment) => payment.id)
    .filter(Boolean);
  const fulfillmentId = data?.order_fulfillments?.[0]?.id;
  const fulfillmentEvents = fulfillmentId
    ? await supabaseAdmin
        .from("fulfillment_events")
        .select("*")
        .eq("fulfillment_id", fulfillmentId)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (fulfillmentEvents.error) throw fulfillmentEvents.error;
  if (paymentIds.length === 0)
    return { ...data, fulfillment_events: fulfillmentEvents.data || [] };

  const { data: events, error: eventsError } = await supabaseAdmin
    .from("payment_events")
    .select("*")
    .in("payment_id", paymentIds)
    .order("created_at", { ascending: true });
  if (eventsError) throw eventsError;

  const eventsByPayment = new Map<string, any[]>();
  for (const event of events || []) {
    const current = eventsByPayment.get(event.payment_id) || [];
    current.push(event);
    eventsByPayment.set(event.payment_id, current);
  }
  return {
    ...data,
    payments: (data.payments || []).map((payment: any) => ({
      ...payment,
      payment_events: eventsByPayment.get(payment.id) || [],
    })),
    fulfillment_events: fulfillmentEvents.data || [],
  };
}

export async function adminDeliverOrder(orderId: string, actorId?: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "admin_deliver_order_atomic",
    {
      p_order_id: orderId,
      p_actor_id: actorId || null,
    },
  );
  if (error) throw error;
  return data;
}

export async function confirmPaymentAndDeliverDigitalOrder(
  orderId: string,
  paymentId: string,
  idempotencyKey: string,
  note?: string | null,
) {
  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .select("id, product_id")
    .eq("order_id", orderId);
  if (orderItemsError) throw orderItemsError;

  for (const productId of [
    ...new Set((orderItems || []).map((item: any) => item.product_id)),
  ]) {
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("digital_inventory_units")
      .select("unit_type")
      .eq("product_id", productId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (unitError) throw unitError;
    if (unit?.unit_type) {
      const { error: productError } = await supabaseAdmin
        .from("products")
        .update({
          fulfillment_type:
            unit.unit_type === "credential" ? "credentials" : "code",
        })
        .eq("id", productId);
      if (productError) throw productError;
    }
  }

  const { data: currentPayment, error: currentPaymentError } =
    await supabaseAdmin
      .from("payments")
      .select("status")
      .eq("id", paymentId)
      .single();
  if (currentPaymentError) throw currentPaymentError;

  let payment = currentPayment;
  if (currentPayment.status !== "paid") {
    const { data: transitionedPayment, error: paymentError } =
      await supabaseAdmin.rpc("admin_transition_payment_atomic", {
        p_payment_id: paymentId,
        p_target_status: "paid",
        p_note: note || null,
        p_actor_id: "admin",
      });
    if (paymentError) throw paymentError;
    payment = transitionedPayment;
  }

  const { data: delivery, error: deliveryError } = await supabaseAdmin.rpc(
    "deliver_paid_product_units",
    { p_order_id: orderId, p_actor_id: "admin" },
  );
  if (deliveryError) throw deliveryError;
  const { error: emailError } = await supabaseAdmin.rpc(
    "enqueue_direct_product_delivery_email",
    {
      p_order_id: orderId,
      p_idempotency_key: `direct-product-delivery:${orderId}`,
    },
  );
  if (emailError) throw emailError;
  const { error: orderStatusError } = await supabaseAdmin
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", orderId);
  if (orderStatusError) throw orderStatusError;

  return {
    already_processed: currentPayment.status === "paid",
    order_id: orderId,
    payment_id: paymentId,
    delivery_id: delivery?.delivery_id || null,
    units_assigned: delivery?.delivered_units || 0,
    payment,
    fulfillment: delivery,
    idempotency_key: idempotencyKey,
  };
}

export async function orderHasAutomaticDigitalItems(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select("products(fulfillment_type)")
    .eq("order_id", orderId);
  if (error) throw error;
  return (data || []).some((item: any) =>
    ["credentials", "code"].includes(item.products?.fulfillment_type),
  );
}

export async function getCustomerDigitalLibrary(sessionId: string) {
  const { data, error } = await supabaseAdmin.rpc("get_clean_digital_library", {
    p_session_id: sessionId,
  });
  if (error) throw new Error("Digital library unavailable");
  return data || [];
}

export async function getCustomerDigitalSecret(input: {
  orderId: string;
  orderItemId: string;
  sessionId: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "get_direct_product_item_secrets",
    {
      p_order_id: input.orderId,
      p_order_item_id: input.orderItemId,
      p_session_id: input.sessionId,
    },
  );
  if (error || typeof data !== "string" || data.length === 0)
    throw new Error("Digital delivery is not authorized");
  return data;
}

export async function createGuestDigitalDeliveryGrant(input: {
  orderId: string;
  expiresAt: string;
  idempotencyKey: string;
  actorId?: string;
  token?: string;
}) {
  const token = input.token || crypto.randomBytes(32).toString("base64url");
  const { data, error } = await supabaseAdmin.rpc(
    "set_clean_guest_access_token",
    {
      p_order_id: input.orderId,
      p_token: token,
      p_expires_at: input.expiresAt,
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error || typeof data !== "number" || data < 1)
    throw new Error("Guest delivery grant creation failed");
  return { expiresAt: input.expiresAt, token };
}

export async function getGuestDigitalDeliveryContexts(
  orderId: string,
  orderItemId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("digital_access")
    .select("id, order_id, order_item_id")
    .eq("order_id", orderId)
    .eq("order_item_id", orderItemId);
  if (error) throw new Error("Guest delivery context unavailable");
  return (data || []).map((row: any) => ({
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    accessId: row.id,
  }));
}

export async function redeemGuestDigitalDelivery(token: string) {
  const { data, error } = await supabaseAdmin.rpc("get_clean_guest_secret", {
    p_token: token,
  });
  if (error || typeof data !== "string" || data.length === 0)
    throw new Error("Digital delivery is not authorized");
  return data;
}

// Server-only email context. Secrets are fetched per order item through the
// same ownership-checked RPC used by the customer account page.
export async function getDigitalDeliveryEmailContext(orderId: string) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, session_id, subtotal_dzd, shipping_dzd, total_dzd, order_items(id, product_id, variant_id, title_snapshot, unit_price_dzd, qty, line_total_dzd, products(fulfillment_type))",
    )
    .eq("id", orderId)
    .single();
  if (orderError || !order)
    throw new Error("DIGITAL_EMAIL_ORDER_CONTEXT_UNAVAILABLE");
  const [
    { data: payments, error: paymentError },
    { data: deliveries, error: deliveryError },
  ] = await Promise.all([
    supabaseAdmin
      .from("payments")
      .select("method, status, amount_dzd")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("digital_deliveries")
      .select("status, delivered_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (
    paymentError ||
    deliveryError ||
    payments?.[0]?.status !== "paid" ||
    deliveries?.[0]?.status !== "delivered"
  )
    throw new Error("DIGITAL_EMAIL_DELIVERY_NOT_READY");
  const items = (order.order_items || []) as any[];
  const variantIds = items.map((item) => item.variant_id).filter(Boolean);
  let variants: any[] = [];
  if (variantIds.length) {
    const { data, error } = await supabaseAdmin
      .from("product_variants")
      .select("id, option_values, name, value")
      .in("id", variantIds);
    if (error) throw new Error("DIGITAL_EMAIL_ORDER_CONTEXT_UNAVAILABLE");
    variants = data || [];
  }
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const deliveredItems = [];
  for (const item of items) {
    const fulfillmentType = item.products?.fulfillment_type;
    if (!["credentials", "code"].includes(fulfillmentType)) continue;
    const secret = await getCustomerDigitalSecret({
      orderId,
      orderItemId: item.id,
      sessionId: order.session_id,
    });
    const variant = item.variant_id ? variantById.get(item.variant_id) : null;
    deliveredItems.push({
      title: item.title_snapshot,
      quantity: Number(item.qty || 0),
      unitPrice: Number(item.unit_price_dzd || 0),
      lineTotal: Number(item.line_total_dzd || 0),
      fulfillmentType,
      optionValues: variant?.option_values || {},
      variantName: variant?.name || null,
      variantValue: variant?.value || null,
      secret,
    });
  }
  return {
    orderNumber: order.order_number,
    subtotal: Number(order.subtotal_dzd || 0),
    shipping: Number(order.shipping_dzd || 0),
    total: Number(order.total_dzd || 0),
    payment: payments[0],
    deliveredAt: deliveries[0].delivered_at,
    items: deliveredItems,
  };
}

export async function enqueueDigitalDeliveryEmail(input: {
  orderId: string;
  orderItemId?: string | null;
  emailType: "guest_digital_delivery" | "account_digital_delivery";
  idempotencyKey: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "enqueue_digital_delivery_email",
    {
      p_order_id: input.orderId,
      p_order_item_id: input.orderItemId || null,
      p_email_type: input.emailType,
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1)
    throw new Error("Digital email outbox unavailable");
  return data[0];
}

export async function enqueueDirectProductDeliveryEmail(orderId: string) {
  const { error } = await supabaseAdmin.rpc(
    "enqueue_direct_product_delivery_email",
    {
      p_order_id: orderId,
      p_idempotency_key: `direct-product-delivery:${orderId}`,
    },
  );
  if (error) throw error;
  return { queued: 1 };
}

export async function claimDigitalEmailOutboxJob(
  workerId: string,
  leaseSeconds?: number,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_digital_email_outbox_job",
    {
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds || 300,
    },
  );
  if (error) {
    console.error("claim_digital_email_outbox_job failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || "Digital email outbox unavailable");
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function markDigitalEmailOutboxSent(
  outboxId: string,
  leaseToken: string,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "mark_digital_email_outbox_sent",
    { p_outbox_id: outboxId, p_lease_token: leaseToken },
  );
  if (error) throw new Error("Digital email outbox unavailable");
  return data === true;
}

export async function markDigitalEmailOutboxFailed(
  outboxId: string,
  leaseToken: string,
  errorMessage: string,
  retryAt?: string,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "mark_digital_email_outbox_failed",
    {
      p_outbox_id: outboxId,
      p_lease_token: leaseToken,
      p_error: errorMessage,
      p_retry_at: retryAt || null,
    },
  );
  if (error) throw new Error("Digital email outbox unavailable");
  return data === true;
}

const DIGITAL_DELIVERY_BUCKET = "digital-delivery";
const MAX_DELIVERY_FILE_BYTES = 8 * 1024 * 1024;

function validateDeliveryUrl(value: string) {
  const parsed = new URL(value.trim());
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("INVALID_DELIVERY_URL");
  return parsed.toString();
}

function validateDeliveryFile(file: File, bytes: Uint8Array) {
  if (!file || file.size < 1 || file.size > MAX_DELIVERY_FILE_BYTES)
    throw new Error("DELIVERY_FILE_TOO_LARGE");
  const allowed = new Set([
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
  ]);
  if (!allowed.has(file.type))
    throw new Error("DELIVERY_FILE_TYPE_NOT_ALLOWED");
  const startsWith = (values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  const isSignatureValid =
    file.type === "text/plain" ||
    (file.type === "application/pdf" &&
      new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") ||
    (["application/zip", "application/x-zip-compressed"].includes(file.type) &&
      startsWith([0x50, 0x4b, 0x03, 0x04])) ||
    (file.type === "image/jpeg" && startsWith([0xff, 0xd8, 0xff])) ||
    (file.type === "image/png" &&
      startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.type === "image/webp" &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP");
  if (!isSignatureValid) throw new Error("DELIVERY_FILE_SIGNATURE_INVALID");
}

async function verifyAdminDigitalFulfillment(fulfillmentId: string) {
  const { data: fulfillment, error } = await supabaseAdmin
    .from("order_fulfillments")
    .select(
      "id, order_id, status, fulfillment_type, orders!inner(id, delivery_method)",
    )
    .eq("id", fulfillmentId)
    .single();
  if (
    error ||
    !fulfillment ||
    (fulfillment as any).orders?.delivery_method !== "digital"
  )
    throw new Error("FULFILLMENT_NOT_ELIGIBLE");
  const { data: payments, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("status")
    .eq("order_id", fulfillment.order_id)
    .eq("status", "paid")
    .limit(1);
  if (paymentError || !payments?.length) throw new Error("PAYMENT_NOT_PAID");
  return fulfillment;
}

export async function adminGetFulfillmentItems(fulfillmentId: string) {
  await verifyAdminDigitalFulfillment(fulfillmentId);
  const { data, error } = await supabaseAdmin
    .from("fulfillment_items")
    .select(
      "id, fulfillment_id, type, title, description, sort_order, original_filename, mime_type, file_size_bytes, url, created_at, updated_at",
    )
    .eq("fulfillment_id", fulfillmentId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminPrepareFulfillment(orderId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "admin_prepare_order_fulfillment",
    { p_order_id: orderId },
  );
  if (error) throw error;
  return data;
}

export async function adminAddFulfillmentItem(input: {
  fulfillmentId: string;
  type: "file" | "link" | "code" | "manual";
  title: string;
  description?: string;
  url?: string;
  code?: string;
  message?: string;
  file?: File;
}) {
  const fulfillment: any = await verifyAdminDigitalFulfillment(
    input.fulfillmentId,
  );
  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("INVALID_DELIVERY_TITLE");
  const row: any = {
    fulfillment_id: fulfillment.id,
    type: input.type,
    title,
    description: input.description?.trim() || null,
    sort_order: 0,
  };
  let uploadedPath: string | null = null;
  if (input.type === "file") {
    if (!input.file) throw new Error("DELIVERY_FILE_REQUIRED");
    const bytes = new Uint8Array(await input.file.arrayBuffer());
    validateDeliveryFile(input.file, bytes);
    const extension = input.file.name.includes(".")
      ? input.file.name
          .split(".")
          .pop()!
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "bin";
    uploadedPath = `fulfillment/${fulfillment.order_id}/${fulfillment.id}/${crypto.randomUUID()}.${extension || "bin"}`;
    const { error } = await supabaseAdmin.storage
      .from(DIGITAL_DELIVERY_BUCKET)
      .upload(uploadedPath, bytes, {
        contentType: input.file.type,
        upsert: false,
      });
    if (error) throw error;
    row.object_path = uploadedPath;
    row.original_filename = input.file.name.slice(0, 255);
    row.mime_type = input.file.type;
    row.file_size_bytes = input.file.size;
  } else if (input.type === "link")
    row.url = validateDeliveryUrl(input.url || "");
  else if (input.type === "code") {
    if (!input.code?.trim()) throw new Error("DELIVERY_CONTENT_REQUIRED");
    row.code = input.code;
  } else if (input.type === "manual") {
    if (!input.message?.trim()) throw new Error("DELIVERY_CONTENT_REQUIRED");
    row.message = input.message;
  } else throw new Error("INVALID_DELIVERY_TYPE");
  try {
    const { data, error } = await supabaseAdmin
      .from("fulfillment_items")
      .insert(row)
      .select(
        "id, fulfillment_id, type, title, description, sort_order, original_filename, mime_type, file_size_bytes, url, created_at, updated_at",
      )
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    if (uploadedPath)
      await supabaseAdmin.storage
        .from(DIGITAL_DELIVERY_BUCKET)
        .remove([uploadedPath]);
    throw error;
  }
}

export async function adminUpdateFulfillmentItem(
  itemId: string,
  input: {
    title: string;
    description?: string;
    url?: string;
    code?: string;
    message?: string;
  },
) {
  const { data: item, error: itemError } = await supabaseAdmin
    .from("fulfillment_items")
    .select("id, fulfillment_id, type")
    .eq("id", itemId)
    .single();
  if (itemError || !item) throw new Error("FULFILLMENT_ITEM_NOT_FOUND");
  await verifyAdminDigitalFulfillment(item.fulfillment_id);
  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("INVALID_DELIVERY_TITLE");
  const update: any = { title, description: input.description?.trim() || null };
  if (item.type === "link") update.url = validateDeliveryUrl(input.url || "");
  if (item.type === "code") {
    if (!input.code?.trim()) throw new Error("DELIVERY_CONTENT_REQUIRED");
    update.code = input.code;
  }
  if (item.type === "manual") {
    if (!input.message?.trim()) throw new Error("DELIVERY_CONTENT_REQUIRED");
    update.message = input.message;
  }
  const { data, error } = await supabaseAdmin
    .from("fulfillment_items")
    .update(update)
    .eq("id", itemId)
    .select(
      "id, fulfillment_id, type, title, description, sort_order, original_filename, mime_type, file_size_bytes, url, created_at, updated_at",
    )
    .single();
  if (error) throw error;
  return data;
}

export async function adminDeleteFulfillmentItem(itemId: string) {
  const { data: item, error: itemError } = await supabaseAdmin
    .from("fulfillment_items")
    .select("id, fulfillment_id, object_path")
    .eq("id", itemId)
    .single();
  if (itemError || !item) throw new Error("FULFILLMENT_ITEM_NOT_FOUND");
  await verifyAdminDigitalFulfillment(item.fulfillment_id);
  const { error } = await supabaseAdmin
    .from("fulfillment_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
  if (item.object_path) {
    const cleanup = await supabaseAdmin.storage
      .from(DIGITAL_DELIVERY_BUCKET)
      .remove([item.object_path]);
    if (cleanup.error)
      console.error("Delivery file cleanup failed:", cleanup.error);
  }
  return { success: true };
}

export async function getCustomerFulfillmentItems(
  orderId: string,
  sessionId: string,
) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, delivery_method, session_id")
    .eq("id", orderId)
    .eq("session_id", sessionId)
    .eq("delivery_method", "digital")
    .single();
  if (orderError || !order) return [];
  const { data: paidPayment } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();
  if (!paidPayment) return [];
  const { data: fulfillment, error: fulfillmentError } = await supabaseAdmin
    .from("order_fulfillments")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("status", "delivered")
    .single();
  if (fulfillmentError || !fulfillment) return [];
  const { data: items, error } = await supabaseAdmin
    .from("fulfillment_items")
    .select(
      "id, type, title, description, sort_order, original_filename, mime_type, file_size_bytes, url, code, message, object_path",
    )
    .eq("fulfillment_id", fulfillment.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!items || items.length === 0) {
    const { data: orderItems, error: orderItemsError } = await supabaseAdmin
      .from("order_items")
      .select("id, title_snapshot, qty")
      .eq("order_id", orderId)
      .order("id");
    if (orderItemsError) throw orderItemsError;

    const directItems: any[] = [];
    for (const orderItem of orderItems || []) {
      const { data: units, error: unitsError } = await supabaseAdmin
        .from("digital_inventory_units")
        .select("id, unit_type")
        .eq("order_item_id", orderItem.id)
        .eq("status", "sold")
        .order("created_at", { ascending: true });
      if (unitsError) throw unitsError;

      for (const unit of units || []) {
        const { data: secret, error: secretError } = await supabaseAdmin.rpc(
          "get_direct_product_unit_secret",
          {
            p_order_id: orderId,
            p_order_item_id: orderItem.id,
            p_unit_id: unit.id,
            p_session_id: sessionId,
          },
        );
        if (secretError) throw secretError;
        directItems.push({
          id: unit.id,
          type: unit.unit_type === "code" ? "code" : "credential",
          title: orderItem.title_snapshot,
          description: "Votre unité numérique",
          code: unit.unit_type === "code" ? secret : undefined,
          message: unit.unit_type === "credential" ? secret : undefined,
        });
      }
    }
    return directItems;
  }
  return Promise.all(
    (items || []).map(async (item: any) => {
      const safe: any = {
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        sort_order: item.sort_order,
        original_filename: item.original_filename,
        mime_type: item.mime_type,
        file_size_bytes: item.file_size_bytes,
      };
      if (item.type === "file" && item.object_path) {
        const signed = await supabaseAdmin.storage
          .from(DIGITAL_DELIVERY_BUCKET)
          .createSignedUrl(item.object_path, 300);
        if (signed.error) throw signed.error;
        safe.download_url = signed.data.signedUrl;
      }
      if (item.type === "link") safe.url = item.url;
      if (item.type === "code") safe.code = item.code;
      if (item.type === "manual") safe.message = item.message;
      return safe;
    }),
  );
}

export async function getResumableCheckoutForSession(
  sessionId: string,
  orderHint?: string | null,
) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `id, order_number, subtotal_dzd, shipping_dzd, total_dzd, created_at, checkout_idempotency_key, session_id, order_items(id, title_snapshot, unit_price_dzd, qty, line_total_dzd), payments(id, method, status, amount_dzd, failure_reason)`,
    )
    .eq("session_id", sessionId)
    .not("checkout_idempotency_key", "is", null)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;

  const resumableStatuses = new Set([
    "pending",
    "verification_required",
    "rejected",
    "paid",
    "failed",
    "cancelled",
  ]);
  const candidates = ((data || []) as any[])
    .map((order) => ({
      order,
      payment: Array.isArray(order.payments) ? order.payments[0] : null,
    }))
    .filter(
      ({ order, payment }) =>
        order.session_id === sessionId &&
        payment &&
        resumableStatuses.has(payment.status),
    );
  const selected =
    (orderHint && candidates.find(({ order }) => order.id === orderHint)) ||
    candidates[0];
  if (!selected) return null;

  const { order, payment } = selected;
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    paymentId: payment.id,
    paymentStatus: payment.status,
    paymentMethod: payment.method,
    amount: Number(payment.amount_dzd ?? order.total_dzd ?? 0),
    rejectionReason: payment.failure_reason || "",
    createdOrder: {
      subtotal: Number(order.subtotal_dzd ?? 0),
      total: Number(order.total_dzd ?? 0),
      shipping: Number(order.shipping_dzd ?? 0),
      items: (order.order_items || []).map((item: any) => ({
        id: item.id,
        title: item.title_snapshot,
        qty: item.qty,
        unitPrice: Number(item.unit_price_dzd ?? 0),
        lineTotal: Number(item.line_total_dzd ?? 0),
      })),
    },
  };
}

export async function updateOrderStatus(
  id: string,
  data: {
    status?: string;
    admin_note?: string;
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: data.status,
      admin_note: data.admin_note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
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
  delivery_method: "home" | "desk";
  address_snapshot: Record<string, any>;
  customer_note?: string;
  admin_note?: string;
}) {
  const { data: result, error } = await supabaseAdmin
    .from("orders")
    .insert([
      {
        order_number: data.order_number,
        session_id: data.session_id,
        status: data.status || "pending",
        payment_method: data.payment_method,
        subtotal_dzd: data.subtotal,
        shipping_dzd: data.shipping,
        total_dzd: data.total,
        wilaya_code: data.wilaya_code,
        delivery_method: data.delivery_method,
        address_snapshot: data.address_snapshot,
        customer_note: data.customer_note,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getStoreSettings() {
  const { data, error } = await supabaseAdmin
    .from("store_settings")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as StoreSettings | null;
}

export async function upsertStoreSettings(settings: StoreSettings) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("store_settings")
    .select("*")
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("store_settings")
      .insert([
        {
          store_name: settings.storeName,
          description: settings.description,
          contact_email: settings.contactEmail,
          phone_primary: settings.phonePrimary,
          phone_secondary: settings.phoneSecondary,
          whatsapp: settings.whatsapp,
          address: settings.address,
          map_link: settings.mapLink,
          map_embed: settings.mapEmbed,
          working_hours: settings.workingHours,
          facebook: settings.facebook,
          instagram: settings.instagram,
          tiktok: settings.tiktok,
          flexy_number: settings.flexyNumber,
          flexy_instructions: settings.flexyInstructions,
          ccp_instructions: settings.ccpInstructions,
          bank_instructions: settings.bankInstructions,
          telegram_link: settings.telegramLink,
        },
      ])
      .select()
      .maybeSingle();

    if (insertError) throw insertError;
    return inserted;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("store_settings")
    .update({
      store_name: settings.storeName,
      description: settings.description,
      contact_email: settings.contactEmail,
      phone_primary: settings.phonePrimary,
      phone_secondary: settings.phoneSecondary,
      whatsapp: settings.whatsapp,
      address: settings.address,
      map_link: settings.mapLink,
      map_embed: settings.mapEmbed,
      working_hours: settings.workingHours,
      facebook: settings.facebook,
      instagram: settings.instagram,
      tiktok: settings.tiktok,
      flexy_number: settings.flexyNumber,
      flexy_instructions: settings.flexyInstructions,
      ccp_instructions: settings.ccpInstructions,
      bank_instructions: settings.bankInstructions,
      telegram_link: settings.telegramLink,
    })
    .eq("id", existing.id)
    .select()
    .maybeSingle();

  if (updateError) throw updateError;
  return updated;
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
    .from("order_items")
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getCheckoutProductsByIds(ids: string[]) {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      "id, title_fr, price_dzd, price_baridimob_dzd, price_flexy_dzd, price_slickpay_dzd, stock, inventory_type, is_active",
    )
    .in("id", ids);
  if (error) throw error;
  return await hydrateDigitalProductStock(data || []);
}

export async function createOrderPaymentAtomic(data: {
  orderNumber: string;
  checkoutKey: string;
  sessionId: string;
  paymentMethod: string;
  subtotal: number;
  shipping: number;
  total: number;
  wilayaCode: number | null;
  deliveryMethod: string;
  addressSnapshot: Record<string, unknown>;
  items: Record<string, unknown>[];
}) {
  const { data: result, error } = await supabaseAdmin.rpc(
    "create_order_payment_atomic",
    {
      p_order_number: data.orderNumber,
      p_checkout_key: data.checkoutKey,
      p_session_id: data.sessionId,
      p_status: "pending",
      p_payment_method: data.paymentMethod,
      p_subtotal: data.subtotal,
      p_shipping: data.shipping,
      p_total: data.total,
      p_wilaya_code: data.wilayaCode,
      p_delivery_method: data.deliveryMethod,
      p_address_snapshot: data.addressSnapshot,
      p_items: data.items,
    },
  );
  if (error) throw error;
  return (result as any[])?.[0];
}

export async function claimSlickPayInvoiceAttempt(
  paymentId: string,
  idempotencyKey: string,
  amountDzd: number,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_slickpay_invoice_attempt",
    {
      p_payment_id: paymentId,
      p_idempotency_key: idempotencyKey,
      p_amount_dzd: amountDzd,
    },
  );
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function completeSlickPayInvoiceAttempt(
  attemptId: string,
  leaseToken: string,
  providerInvoiceId: string,
  checkoutUrl: string,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "complete_slickpay_invoice_attempt",
    {
      p_attempt_id: attemptId,
      p_lease_token: leaseToken,
      p_provider_invoice_id: providerInvoiceId,
      p_checkout_url: checkoutUrl,
    },
  );
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function failSlickPayInvoiceAttempt(
  attemptId: string,
  leaseToken: string,
  message: string,
) {
  const { error } = await supabaseAdmin.rpc("fail_slickpay_invoice_attempt", {
    p_attempt_id: attemptId,
    p_lease_token: leaseToken,
    p_error: message,
  });
  if (error) throw error;
}

export async function recordSlickPayVerification(
  paymentId: string,
  invoiceId: string,
  completed: boolean,
  providerStatus: string,
  amountDzd: number,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "record_slickpay_verification_atomic",
    {
      p_payment_id: paymentId,
      p_provider_invoice_id: invoiceId,
      p_completed: completed,
      p_provider_status: providerStatus,
      p_provider_amount: amountDzd,
    },
  );
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function createPayment(data: {
  order_id: string;
  method: string;
  provider?: string;
  amount_dzd: number;
  idempotency_key: string;
}) {
  const { data: result, error } = await supabaseAdmin
    .from("payments")
    .insert([{ ...data, status: "pending" }])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getPaymentWithOrder(paymentId: string, orderId?: string) {
  let query = supabaseAdmin
    .from("payments")
    .select("*, orders!inner(id, session_id, order_number, delivery_method)")
    .eq("id", paymentId);
  if (orderId) query = query.eq("order_id", orderId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function createPaymentEvent(data: {
  payment_id: string;
  event_type: string;
  actor_type: string;
  actor_id?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: result, error } = await supabaseAdmin
    .from("payment_events")
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updatePayment(
  paymentId: string,
  data: Record<string, unknown>,
) {
  const { data: result, error } = await supabaseAdmin
    .from("payments")
    .update(data)
    .eq("id", paymentId)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function transitionPayment(
  paymentId: string,
  fromStatus: string,
  data: Record<string, unknown>,
) {
  const { data: result, error } = await supabaseAdmin
    .from("payments")
    .update(data)
    .eq("id", paymentId)
    .eq("status", fromStatus)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!result) throw new Error("PAYMENT_STATE_CONFLICT");
  return result;
}

export async function transitionPaymentFromStatuses(
  paymentId: string,
  fromStatuses: string[],
  data: Record<string, unknown>,
) {
  const { data: result, error } = await supabaseAdmin
    .from("payments")
    .update(data)
    .eq("id", paymentId)
    .in("status", fromStatuses)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!result) throw new Error("PAYMENT_STATE_CONFLICT");
  return result;
}

export async function transitionPaymentForProof(
  paymentId: string,
  fromStatus: string,
  data: Record<string, unknown>,
) {
  let query = supabaseAdmin
    .from("payments")
    .update(data)
    .eq("id", paymentId)
    .eq("status", fromStatus);
  if (fromStatus === "verification_required")
    query = query.is("proof_object_path", null);
  const { data: result, error } = await query.select().maybeSingle();
  if (error) throw error;
  if (!result) throw new Error("PAYMENT_STATE_CONFLICT");
  return result;
}

export async function submitPaymentProofAtomic(
  paymentId: string,
  orderId: string,
  sessionId: string,
  proofObjectPath: string,
  providerReference: string | null,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "submit_payment_proof_atomic",
    {
      p_payment_id: paymentId,
      p_order_id: orderId,
      p_session_id: sessionId,
      p_proof_object_path: proofObjectPath,
      p_provider_reference: providerReference,
    },
  );
  if (error) throw error;
  return data;
}

export async function transitionAdminPaymentAtomic(
  paymentId: string,
  targetStatus: "paid" | "rejected",
  note: string | null,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "admin_transition_payment_atomic",
    {
      p_payment_id: paymentId,
      p_target_status: targetStatus,
      p_note: note,
      p_actor_id: "admin",
    },
  );
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function uploadPaymentProof(
  paymentId: string,
  orderId: string,
  file: File,
) {
  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : "webp";
  const path = `${orderId}/${paymentId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function deletePaymentProof(path: string) {
  const { error } = await supabaseAdmin.storage
    .from("payment-proofs")
    .remove([path]);
  if (error) throw error;
}

export async function getPaymentProofSignedUrl(path: string) {
  const { data, error } = await supabaseAdmin.storage
    .from("payment-proofs")
    .createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function getAdminPaymentProofSignedUrl(
  paymentId: string,
  orderId: string,
) {
  const payment: any = await getPaymentWithOrder(paymentId, orderId);
  const path = String(payment?.proof_object_path || "");
  const expectedPrefix = `${orderId}/${paymentId}/`;
  if (
    !payment ||
    !path.startsWith(expectedPrefix) ||
    path.includes("..") ||
    path.includes("\\")
  ) {
    throw new Error("PROOF_NOT_AVAILABLE");
  }
  return getPaymentProofSignedUrl(path);
}

// ============================================================================
// CART REPOSITORY
// ============================================================================

export async function getOrCreateCart(sessionId: string) {
  const { data: existing, error: getError } = await supabaseAnon
    .from("carts")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "active")
    .single();

  if (existing) return existing;

  const { data: created, error: createError } = await supabaseAdmin
    .from("carts")
    .insert([
      {
        session_id: sessionId,
        status: "active",
      },
    ])
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

export async function getCartWithItems(cartId: string) {
  const { data, error } = await supabaseAnon
    .from("carts")
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
    `,
    )
    .eq("id", cartId)
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
    .from("cart_items")
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
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("cart_items")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function removeCartItem(id: string) {
  const { error } = await supabaseAdmin
    .from("cart_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function clearCart(cartId: string) {
  const { error } = await supabaseAdmin
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId);
  if (error) throw error;
}

export async function convertCart(cartId: string) {
  const { error } = await supabaseAdmin
    .from("carts")
    .update({ status: "converted" })
    .eq("id", cartId);
  if (error) throw error;
}

// ============================================================================
// CONTENT REPOSITORY
// ============================================================================

export async function getHomePageBanners() {
  const { data, error } = await supabaseAnon
    .from("homepage_banners")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
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
    .from("homepage_banners")
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
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("homepage_banners")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteHomepageBanner(id: string) {
  const { error } = await supabaseAdmin
    .from("homepage_banners")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function getMarqueeBrands() {
  const { data, error } = await supabaseAnon
    .from("marquee_brands")
    .select(
      `
      *,
      brands(id, name, slug, logo_url)
    `,
    )
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  const rows = data || [];
  if (rows.length === 0) return rows;

  const signed = await Promise.all(
    rows.map(async (row: any) => {
      const brand = row?.brands || null;
      const signedRowLogo = await toSignedStorageUrl(row?.logo_url);
      const signedBrandLogo = brand
        ? await toSignedStorageUrl(brand?.logo_url)
        : null;
      return {
        ...row,
        logo_url: signedRowLogo,
        brands: brand ? { ...brand, logo_url: signedBrandLogo } : brand,
      };
    }),
  );

  return signed;
}

export async function createMarqueeBrand(data: {
  brand_id: string;
  logo_url: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const { data: result, error } = await supabaseAdmin
    .from("marquee_brands")
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
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("marquee_brands")
    .update(data)
    .eq("id", id)
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
    .from("customer_profiles")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
  return data;
}

export async function getCustomerProfileByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseAnon
    .from("customer_profiles")
    .select("*")
    .ilike("email", normalizedEmail)
    .order("updated_at", { ascending: false })
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
    .from("customer_profiles")
    .upsert(
      {
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
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
    { data: orders, error: ordersError },
    { data: wilayas, error: wilayasError },
  ] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select(
        "session_id, total_dzd, created_at, wilaya_code, address_snapshot",
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("shipping_wilayas").select("code, name_fr, name_ar"),
  ]);

  if (ordersError) throw ordersError;
  if (wilayasError) throw wilayasError;

  const wilayaMap = new Map<number, { name_fr: string; name_ar: string }>();
  (wilayas || []).forEach((row: any) => {
    const code = Number(row.code);
    if (Number.isFinite(code)) {
      wilayaMap.set(code, {
        name_fr: row.name_fr || "",
        name_ar: row.name_ar || "",
      });
    }
  });

  // Group orders by session to get unique customers
  const customerMap = new Map<
    string,
    {
      orders: any[];
      firstOrder: any;
      latestOrder: any;
    }
  >();

  (orders || []).forEach((order: any) => {
    const sessionId = order.session_id;
    if (!sessionId) return;

    if (!customerMap.has(sessionId)) {
      customerMap.set(sessionId, {
        orders: [],
        firstOrder: order,
        latestOrder: order,
      });
    }

    const customer = customerMap.get(sessionId)!;
    customer.orders.push(order);
    customer.latestOrder = order; // Latest since orders are sorted by created_at DESC
  });

  // Build customer list
  const customers = Array.from(customerMap.entries()).map(
    ([sessionId, data]) => {
      const latestOrder = data.latestOrder;
      const addressSnapshot = latestOrder.address_snapshot || {};

      const firstName = addressSnapshot.firstName || "";
      const lastName = addressSnapshot.lastName || "";
      const name =
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        addressSnapshot.phone ||
        "عميل";
      const email = addressSnapshot.email || "";
      const phone = addressSnapshot.phone || "";

      const totalSpent = data.orders.reduce((sum: number, order: any) => {
        const parsedTotal = Number.parseFloat(String(order.total_dzd ?? 0));
        return sum + (Number.isFinite(parsedTotal) ? parsedTotal : 0);
      }, 0);

      const wilayaCode = latestOrder.wilaya_code
        ? Number(latestOrder.wilaya_code)
        : null;
      const wilaya = wilayaCode ? wilayaMap.get(wilayaCode) : null;

      return {
        id: sessionId,
        session_id: sessionId,
        name,
        email,
        phone,
        join_date: data.firstOrder.created_at,
        orders_count: data.orders.length,
        total_spent_dzd: totalSpent,
        last_order_at: latestOrder.created_at,
        wilaya_code: wilayaCode,
        wilaya_name_fr: wilaya?.name_fr || "",
        wilaya_name_ar: wilaya?.name_ar || "",
      };
    },
  );

  return { customers };
}

// ============================================================================
// ADMIN DIGITAL INVENTORY OPERATIONS
// ============================================================================

const DIGITAL_UNIT_SAFE_FIELDS =
  "id, product_id, variant_id, unit_type, status, secret_version, secret_created_at, secret_rotated_at, created_by, updated_by, disabled_by, disabled_at, admin_note, created_at, updated_at";

export async function adminGetDigitalInventory(productId: string) {
  const [
    { data: units, error: unitsError },
    { data: allocations, error: allocationsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("digital_inventory_units")
      .select(DIGITAL_UNIT_SAFE_FIELDS)
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("digital_unit_allocations")
      .select(
        "id, digital_inventory_unit_id, order_id, order_item_id, variant_id, allocation_slot, status, reserved_at, allocated_at, consumed_at, released_at, revoked_at, created_at",
      )
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
  ]);
  if (unitsError || allocationsError) throw unitsError || allocationsError;
  const counts = (units || []).reduce<Record<string, number>>(
    (result, unit: any) => {
      result[unit.status] = (result[unit.status] || 0) + 1;
      return result;
    },
    {},
  );
  return { units: units || [], allocations: allocations || [], counts };
}

export async function adminCreateDigitalInventoryUnit(input: {
  productId: string;
  variantId?: string | null;
  unitType: "credential" | "code";
  secret: string;
  idempotencyKey: string;
  actor?: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "admin_create_digital_inventory_unit",
    {
      p_product_id: input.productId,
      p_variant_id: input.variantId || null,
      p_unit_type: input.unitType,
      p_secret: input.secret,
      p_vault_key_id: null,
      p_idempotency_key: input.idempotencyKey,
      p_actor: input.actor || "admin",
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    if (error) {
      console.error("admin_create_digital_inventory_unit RPC failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }
    throw new Error("Création de l’unité numérique impossible.");
  }
  return data[0];
}

export async function adminSetDigitalInventoryUnitStatus(
  unitId: string,
  status: "disabled" | "revoked",
  actor = "admin",
) {
  const { data, error } = await supabaseAdmin.rpc(
    "admin_set_digital_inventory_unit_status",
    {
      p_unit_id: unitId,
      p_status: status,
      p_actor: actor,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1)
    throw new Error("Changement de statut impossible.");
  return data[0];
}

export async function adminRotateDigitalInventoryUnitSecret(input: {
  unitId: string;
  secret: string;
  idempotencyKey: string;
  actor?: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "create_or_replace_digital_unit_secret",
    {
      p_digital_inventory_unit_id: input.unitId,
      p_new_secret: input.secret,
      p_key_id: null,
      p_replacement_idempotency_key: input.idempotencyKey,
      p_actor: input.actor || "admin",
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1)
    throw new Error("Rotation du secret impossible.");
  const { data: unit, error: unitError } = await supabaseAdmin
    .from("digital_inventory_units")
    .select(DIGITAL_UNIT_SAFE_FIELDS)
    .eq("id", input.unitId)
    .single();
  if (unitError || !unit) throw new Error("Unité numérique introuvable.");
  return unit;
}

export async function deleteMarqueeBrand(id: string) {
  const { error } = await supabaseAdmin
    .from("marquee_brands")
    .delete()
    .eq("id", id);
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
    .from("contact_messages")
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
    .from("contact_messages")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.isRead !== undefined) {
    query = query.eq("is_read", filters.isRead);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 10) - 1,
    );
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
  },
) {
  const { data: result, error } = await supabaseAdmin
    .from("contact_messages")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteContactMessage(id: string) {
  const { error } = await supabaseAdmin
    .from("contact_messages")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
