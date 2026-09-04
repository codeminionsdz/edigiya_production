'use server';

import {
  isAdminAuthenticated,
  verifyAdminPassword,
  createAdminSession,
  destroyAdminSession,
} from '@/lib/admin-auth';
import * as repo from '@/lib/repositories';
import { verifyManualPayment, rejectManualPayment } from '@/lib/payments/service';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';

function revalidateTaxonomyTag() {
  revalidateTag('taxonomy', 'max');
}

const LEGACY_TECH_DEPARTMENT_SLUGS = new Set([
  'informatique',
  'electronique',
  'accessoires',
  'pcs-gaming',
  'laptops',
  'composants',
  'moniteurs',
  'apple',
  'cameras',
  'reseau',
  'imprimantes',
  'bureautique',
  'peripheriques',
  'stockage',
  'chaises-bureaux',
]);

const LEGACY_TECH_HINTS = [
  'info',
  'electron',
  'gaming',
  'laptop',
  'monitor',
  'camera',
  'reseau',
  'imprimante',
  'bureau',
  'peripher',
  'stockage',
  'apple',
];

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function isLegacyTechDepartment(department: {
  slug?: string | null;
  name_fr?: string | null;
  name_ar?: string | null;
}) {
  const slug = normalizeText(department.slug);
  const nameFr = normalizeText(department.name_fr);
  const nameAr = normalizeText(department.name_ar);
  if (!slug && !nameFr && !nameAr) return false;
  if (LEGACY_TECH_DEPARTMENT_SLUGS.has(slug)) return true;
  const haystack = `${slug} ${nameFr} ${nameAr}`;
  return LEGACY_TECH_HINTS.some((hint) => haystack.includes(hint));
}

const DEFAULT_SUPPLEMENT_DEPARTMENTS = [
  { slug: 'proteines', name_fr: 'Proteines', name_ar: 'بروتينات' },
  { slug: 'performance', name_fr: 'Performance', name_ar: 'الاداء' },
  { slug: 'recuperation', name_fr: 'Recuperation', name_ar: 'الاستشفاء' },
  { slug: 'controle-poids', name_fr: 'Controle du poids', name_ar: 'التحكم في الوزن' },
  { slug: 'bien-etre', name_fr: 'Bien-etre', name_ar: 'الصحة العامة' },
];

async function seedDefaultDepartmentsIfEmpty() {
  const existing = await repo.getDepartments();
  if ((existing || []).length > 0) {
    return { departments: existing, created: 0 };
  }

  let created = 0;
  for (let i = 0; i < DEFAULT_SUPPLEMENT_DEPARTMENTS.length; i += 1) {
    const department = DEFAULT_SUPPLEMENT_DEPARTMENTS[i];
    try {
      await repo.createDepartment({
        slug: department.slug,
        name_fr: department.name_fr,
        name_ar: department.name_ar,
        sort_order: i,
        is_active: true,
      });
      created += 1;
    } catch (error: any) {
      // Ignore duplicate/create races and continue.
      console.warn('seedDefaultDepartmentsIfEmpty create failed:', error?.message || error);
    }
  }

  const reloaded = await repo.getDepartments();
  return { departments: reloaded || [], created };
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export async function loginAdmin(password: string) {
  const isValid = await verifyAdminPassword(password);
  if (!isValid) {
    return { error: 'Invalid password' };
  }

  await createAdminSession();
  redirect('/admin');
}

export async function logoutAdmin() {
  await destroyAdminSession();
  redirect('/admin/login');
}

export async function checkAdminAuth() {
  return await isAdminAuthenticated();
}

// ============================================================================
// DEPARTMENTS
// ============================================================================

export async function adminGetDepartments() {
  if (!(await isAdminAuthenticated())) {
    return [];
  }
  try {
    const departments = await repo.getDepartments(true);
    return (departments || []).filter((department: any) => !isLegacyTechDepartment(department));
  } catch (error: any) {
    console.error('adminGetDepartments failed:', error);
    return [];
  }
}

export async function adminCreateDepartment(data: {
  slug: string;
  name_fr: string;
  name_ar: string;
  icon?: string;
  image_url?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    const created = await repo.createDepartment(data);
    revalidateTaxonomyTag();
    return created;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminUpdateDepartment(
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
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    const updated = await repo.updateDepartment(id, data);
    revalidateTaxonomyTag();
    return updated;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminDeleteDepartment(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await repo.deleteDepartment(id);
    revalidateTaxonomyTag();
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminEnsureDefaultDepartments() {
  if (!(await isAdminAuthenticated())) {
    return { success: false, created: 0, error: 'Unauthorized' };
  }

  try {
    const seeded = await seedDefaultDepartmentsIfEmpty();
    revalidateTaxonomyTag();
    return { success: true, created: seeded.created || 0 };
  } catch (error: any) {
    console.error('adminEnsureDefaultDepartments failed:', error);
    return { success: false, created: 0, error: error?.message || 'Failed to seed departments' };
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================

export async function adminGetCategories() {
  if (!(await isAdminAuthenticated())) {
    return [];
  }
  try {
    return await repo.getCategories();
  } catch (error: any) {
    console.error('adminGetCategories failed:', error);
    return [];
  }
}

export async function adminGetCategoriesByDepartment(departmentId: string, parentId?: string | null) {
  if (!(await isAdminAuthenticated())) {
    return [];
  }
  try {
    return await repo.getCategoriesByDepartment(departmentId, parentId);
  } catch (error: any) {
    console.error('adminGetCategoriesByDepartment failed:', error);
    return [];
  }
}

export async function adminGetCategoryPath(categoryId: string) {
  if (!(await isAdminAuthenticated())) {
    return [];
  }
  try {
    return await repo.getCategoryPath(categoryId);
  } catch (error: any) {
    console.error('adminGetCategoryPath failed:', error);
    return [];
  }
}

export async function adminCreateCategory(data: {
  department_id: string;
  parent_id?: string | null;
  slug: string;
  name_fr: string;
  name_ar: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    const created = await repo.createCategory(data);
    revalidateTaxonomyTag();
    return created;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminUpdateCategory(
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
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    const updated = await repo.updateCategory(id, data);
    revalidateTaxonomyTag();
    return updated;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminDeleteCategory(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await repo.deleteCategory(id);
    revalidateTaxonomyTag();
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Taxonomy admin actions
export async function adminGetCategoryTree(departmentId: string) {
  if (!(await isAdminAuthenticated())) {
    return [];
  }
  try {
    return await repo.getCategoryTreeByDepartment(departmentId);
  } catch (error: any) {
    console.error('adminGetCategoryTree failed:', error);
    return [];
  }
}

export async function adminToggleCategoryActive(id: string, isActive: boolean) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    const updated = await repo.toggleCategoryActive(id, isActive);
    revalidateTaxonomyTag();
    return updated;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminCanDeleteCategory(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.canDeleteCategory(id);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminSlugExists(slug: string, departmentId: string, excludeId?: string) {
  if (!(await isAdminAuthenticated())) {
    return false;
  }
  try {
    return await repo.slugExistsInDepartment(slug, departmentId, excludeId);
  } catch (error: any) {
    console.error('adminSlugExists failed:', error);
    return false;
  }
}

export async function adminMoveCategoryUp(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await repo.moveCategoryUp(id);
    revalidateTaxonomyTag();
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminMoveCategoryDown(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await repo.moveCategoryDown(id);
    revalidateTaxonomyTag();
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================================================
// BRANDS
// ============================================================================

export async function adminGetBrands() {
  if (!(await isAdminAuthenticated())) {
    return [];
  }
  try {
    return await repo.getBrands();
  } catch (error: any) {
    console.error('adminGetBrands failed:', error);
    return [];
  }
}

export async function adminCreateBrand(data: {
  name: string;
  slug: string;
  logo_url?: string;
  is_active?: boolean;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.createBrand(data);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminUpdateBrand(
  id: string,
  data: {
    name?: string;
    slug?: string;
    logo_url?: string;
    is_active?: boolean;
  }
) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.updateBrand(id, data);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminDeleteBrand(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await repo.deleteBrand(id);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================================================
// PRODUCTS
// ============================================================================

type ProductSpecPayload = {
  key: string;
  value_fr?: string;
  value_ar?: string;
  sort_order?: number;
};

type ProductImagePayload = {
  url: string;
  alt_fr?: string;
  alt_ar?: string;
  sort_order?: number;
};

type ProductVariantPayload = {
  name: string;
  value: string;
  price_delta_dzd?: number;
  stock?: number;
};

type ProductSeoPayload = {
  meta_title_fr?: string;
  meta_title_ar?: string;
  meta_description_fr?: string;
  meta_description_ar?: string;
};

type ProductEditorPayload = {
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
  sku?: string;
  stock: number;
  is_featured?: boolean;
  is_active?: boolean;
  specs?: ProductSpecPayload[];
  images?: ProductImagePayload[];
  variants?: ProductVariantPayload[];
  seo?: ProductSeoPayload;
};

async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  let slug = baseSlug;
  let counter = 1;

  while (await repo.productSlugExists(slug, excludeId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

function normalizeEditorPayload(data: ProductEditorPayload) {
  return {
    slug: data.slug.trim().toLowerCase(),
    title_fr: data.title_fr.trim(),
    title_ar: data.title_ar.trim(),
    description_fr: data.description_fr?.trim(),
    description_ar: data.description_ar?.trim(),
    brand_id: data.brand_id?.trim(),
    department_id: data.department_id,
    category_id: data.category_id,
    price_dzd: data.price_dzd,
    compare_at_price_dzd: data.compare_at_price_dzd,
    sku: data.sku?.trim(),
    stock: data.stock,
    is_featured: data.is_featured ?? false,
    is_active: data.is_active ?? true,
    specs: data.specs || [],
    images: data.images || [],
    variants: data.variants || [],
    seo: data.seo || {},
  };
}

function validateProductRequiredFields(data: ProductEditorPayload) {
  if (!data.title_fr?.trim()) return 'Le titre FR est requis.';
  if (!data.department_id) return 'Le departement est requis.';
  if (!data.category_id) return 'La categorie est requise.';
  if (!Number.isFinite(data.price_dzd) || data.price_dzd < 0) return 'Le prix est invalide.';
  if (!Number.isFinite(data.stock) || data.stock < 0) return 'Le stock est invalide.';
  return null;
}

async function persistProductRelations(productId: string, data: ProductEditorPayload) {
  const normalized = normalizeEditorPayload(data);

  await repo.replaceProductSpecs(
    productId,
    normalized.specs.map((spec, index) => ({
      key: spec.key,
      value_fr: spec.value_fr,
      value_ar: spec.value_ar,
      sort_order: spec.sort_order ?? index,
    }))
  );

  await repo.replaceProductImages(
    productId,
    normalized.images.map((image, index) => ({
      url: image.url,
      alt_fr: image.alt_fr,
      alt_ar: image.alt_ar,
      sort_order: image.sort_order ?? index,
    }))
  );

  await repo.replaceProductVariants(
    productId,
    normalized.variants.map((variant) => ({
      name: variant.name,
      value: variant.value,
      price_delta_dzd: variant.price_delta_dzd ?? 0,
      stock: variant.stock ?? 0,
    }))
  );

  const seoResult = await repo.updateProductSeo(productId, normalized.seo);
  return { seoSupported: seoResult.supported };
}

export async function adminGetProducts(filters?: {
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
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.getProducts({ ...filters, onlyActive: filters?.onlyActive ?? false });
  } catch (error: any) {
    console.error('adminGetProducts failed:', error);
    return { error: error.message };
  }
}

export async function adminGetProductById(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.getProductById(id);
  } catch (error: any) {
    console.error('adminGetProductById failed:', error);
    return { error: error.message };
  }
}

export async function adminCheckProductSlug(slug: string, excludeProductId?: string) {
  if (!(await isAdminAuthenticated())) {
    return { exists: false };
  }
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return { exists: false };
  try {
    const exists = await repo.productSlugExists(normalizedSlug, excludeProductId);
    return { exists };
  } catch (error: any) {
    console.error('adminCheckProductSlug failed:', error);
    return { exists: false };
  }
}

export async function adminHasProductVariantsTable() {
  if (!(await isAdminAuthenticated())) {
    return false;
  }
  try {
    return await repo.hasProductVariantsTable();
  } catch (error: any) {
    console.error('adminHasProductVariantsTable failed:', error);
    return false;
  }
}

export async function adminHasProductSeoColumns() {
  if (!(await isAdminAuthenticated())) {
    return false;
  }
  try {
    return await repo.hasProductSeoColumns();
  } catch (error: any) {
    console.error('adminHasProductSeoColumns failed:', error);
    return false;
  }
}

export async function adminUploadProductImage(formData: FormData) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const fileValue = formData.get('file');
    if (!(fileValue instanceof File)) {
      return { error: 'Fichier invalide.' };
    }

    if (!fileValue.type.startsWith('image/')) {
      return { error: 'Le fichier doit etre une image.' };
    }

    const uploaded = await repo.uploadProductImage(fileValue);
    return uploaded;
  } catch (error: any) {
    console.error('adminUploadProductImage failed:', error);
    return { error: error?.message || 'Upload impossible.' };
  }
}

export async function adminUploadDepartmentImage(formData: FormData) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const fileValue = formData.get('file');
    if (!(fileValue instanceof File)) {
      return { error: 'Fichier invalide.' };
    }

    if (!fileValue.type.startsWith('image/')) {
      return { error: 'Le fichier doit etre une image.' };
    }

    const uploaded = await repo.uploadProductImage(fileValue);
    return uploaded;
  } catch (error: any) {
    console.error('adminUploadDepartmentImage failed:', error);
    return { error: error?.message || 'Upload impossible.' };
  }
}

export async function adminCreateProduct(data: ProductEditorPayload) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const validationError = validateProductRequiredFields(data);
  if (validationError) return { error: validationError };

  try {
    const slug = await generateUniqueSlug(data.title_fr);

    const normalized = {
      slug,
      title_fr: data.title_fr.trim(),
      title_ar: (data.title_ar?.trim() || data.title_fr.trim()),
      description_fr: data.description_fr?.trim(),
      description_ar: data.description_ar?.trim(),
      brand_id: data.brand_id?.trim(),
      department_id: data.department_id,
      category_id: data.category_id,
      price_dzd: Number.isFinite(data.price_dzd) && data.price_dzd >= 0 ? data.price_dzd : 0,
      compare_at_price_dzd: data.compare_at_price_dzd,
      sku: data.sku?.trim(),
      stock: Number.isFinite(data.stock) && data.stock >= 0 ? data.stock : 0,
      is_featured: data.is_featured ?? false,
      is_active: data.is_active ?? true,
      specs: data.specs || [],
      images: data.images || [],
      variants: data.variants || [],
      seo: data.seo || {},
    };

    const created = await repo.createProduct({
      slug: normalized.slug,
      title_fr: normalized.title_fr,
      title_ar: normalized.title_ar,
      description_fr: normalized.description_fr,
      description_ar: normalized.description_ar,
      brand_id: normalized.brand_id,
      department_id: normalized.department_id,
      category_id: normalized.category_id,
      price_dzd: normalized.price_dzd,
      compare_at_price_dzd: normalized.compare_at_price_dzd,
      sku: normalized.sku,
      stock: normalized.stock,
      is_featured: normalized.is_featured,
      is_active: normalized.is_active,
    });

    const relationResult = await persistProductRelations(created.id, normalized);

    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${created.id}/edit`);
    revalidatePath(`/product/${normalized.slug}`);
    revalidatePath('/shop');

    return {
      ...created,
      seo_supported: relationResult.seoSupported,
    };
  } catch (error: any) {
    console.error('adminCreateProduct failed:', error);
    return { error: error.message };
  }
}

export async function adminUpdateProduct(
  id: string,
  data: Partial<ProductEditorPayload>
) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const currentProductResult = await repo.getProductById(id);
    if ('error' in currentProductResult) {
      return { error: currentProductResult.error };
    }
    const currentProduct = currentProductResult as any;
    const merged: ProductEditorPayload = {
      slug: data.slug ?? currentProduct.slug,
      title_fr: data.title_fr ?? currentProduct.title_fr,
      title_ar: data.title_ar ?? currentProduct.title_ar ?? data.title_fr ?? currentProduct.title_fr,
      description_fr: data.description_fr ?? currentProduct.description_fr ?? '',
      description_ar: data.description_ar ?? currentProduct.description_ar ?? '',
      brand_id: data.brand_id ?? currentProduct.brand_id ?? undefined,
      department_id: data.department_id ?? currentProduct.department_id,
      category_id: data.category_id ?? currentProduct.category_id,
      price_dzd: data.price_dzd ?? Number(currentProduct.price_dzd ?? 0),
      compare_at_price_dzd:
        data.compare_at_price_dzd !== undefined
          ? data.compare_at_price_dzd
          : currentProduct.compare_at_price_dzd ?? null,
      sku: data.sku ?? currentProduct.sku ?? undefined,
      stock: data.stock ?? Number(currentProduct.stock ?? 0),
      is_featured: data.is_featured ?? currentProduct.is_featured,
      is_active: data.is_active ?? currentProduct.is_active,
      specs: data.specs ?? currentProduct.product_specs ?? [],
      images: data.images ?? currentProduct.product_images ?? [],
      variants: data.variants ?? currentProduct.product_variants ?? [],
      seo: data.seo ?? {
        meta_title_fr: currentProduct.meta_title_fr,
        meta_title_ar: currentProduct.meta_title_ar,
        meta_description_fr: currentProduct.meta_description_fr,
        meta_description_ar: currentProduct.meta_description_ar,
      },
    };

    const validationError = validateProductRequiredFields(merged);
    if (validationError) return { error: validationError };

    // Generate new slug from title_fr
    const newSlug = await generateUniqueSlug(merged.title_fr, id);

    const normalized = {
      slug: newSlug,
      title_fr: merged.title_fr,
      title_ar: merged.title_ar?.trim() || merged.title_fr,
      description_fr: merged.description_fr,
      description_ar: merged.description_ar,
      brand_id: merged.brand_id,
      department_id: merged.department_id,
      category_id: merged.category_id,
      price_dzd: Number.isFinite(merged.price_dzd) && merged.price_dzd >= 0 ? merged.price_dzd : 0,
      compare_at_price_dzd: merged.compare_at_price_dzd,
      sku: merged.sku,
      stock: Number.isFinite(merged.stock) && merged.stock >= 0 ? merged.stock : 0,
      is_featured: merged.is_featured,
      is_active: merged.is_active,
      specs: merged.specs,
      images: merged.images,
      variants: merged.variants,
      seo: merged.seo,
    };

    const updated = await repo.updateProduct(id, {
      slug: normalized.slug,
      title_fr: normalized.title_fr,
      title_ar: normalized.title_ar,
      description_fr: normalized.description_fr,
      description_ar: normalized.description_ar,
      brand_id: normalized.brand_id,
      department_id: normalized.department_id,
      category_id: normalized.category_id,
      price_dzd: normalized.price_dzd,
      compare_at_price_dzd: normalized.compare_at_price_dzd,
      sku: normalized.sku,
      stock: normalized.stock,
      is_featured: normalized.is_featured,
      is_active: normalized.is_active,
    });

    const relationResult = await persistProductRelations(id, normalized);

    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${id}/edit`);
    revalidatePath(`/product/${normalized.slug}`);
    revalidatePath('/shop');

    return {
      ...updated,
      seo_supported: relationResult.seoSupported,
    };
  } catch (error: any) {
    console.error('adminUpdateProduct failed:', error);
    return { error: error.message };
  }
}

export async function adminDeleteProduct(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await repo.deleteProduct(id);
    revalidatePath('/admin/products');
    return { success: true };
  } catch (error: any) {
    console.error('adminDeleteProduct failed:', error);
    return { error: error.message };
  }
}

// ============================================================================
// ORDERS
// ============================================================================

export async function adminGetOrders(filters?: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.adminGetOrders(filters);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminGetOrderById(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.adminGetOrderById(id);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminVerifyPayment(paymentId: string, note?: string) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try { return { success: true, payment: await verifyManualPayment(paymentId, note) }; } catch (error: any) {
    console.error('adminVerifyPayment failed:', error);
    return { success: false, error: String(error?.message).includes('STATE_CONFLICT') ? 'Ce paiement a déjà été traité ou n’est plus disponible.' : 'Impossible de traiter ce paiement.' };
  }
}

export async function adminRejectPayment(paymentId: string, reason: string) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try { return { success: true, payment: await rejectManualPayment(paymentId, reason) }; } catch (error: any) {
    console.error('adminRejectPayment failed:', error);
    return { success: false, error: String(error?.message).includes('STATE_CONFLICT') ? 'Ce paiement a déjà été traité ou n’est plus disponible.' : String(error?.message).includes('raison') ? 'Indiquez la raison du rejet.' : 'Impossible de traiter ce paiement.' };
  }
}

export async function adminGetPaymentProofUrl(paymentId: string, orderId: string) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try {
    return { success: true, url: await repo.getAdminPaymentProofSignedUrl(paymentId, orderId) };
  } catch (error) {
    console.error('adminGetPaymentProofUrl failed:', error);
    return { success: false, error: 'Le justificatif n’est plus disponible.' };
  }
}

export async function adminUpdateOrderStatus(
  id: string,
  data: {
    status?: string;
    admin_note?: string;
  }
) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.updateOrderStatus(id, data);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminDeliverOrder(orderId: string) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try {
    const result = await repo.adminDeliverOrder(orderId, 'admin');
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/account/orders/${orderId}`);
    return { success: true, fulfillment: result };
  } catch (error: any) {
    console.error('adminDeliverOrder failed:', error);
    const message = String(error?.message || '');
    return { success: false, error: message.includes('DIGITAL_FULFILLMENT_NOT_ELIGIBLE') ? 'Cette commande n’est pas éligible à la livraison digitale.' : message.includes('FULFILLMENT_STATE_CONFLICT') ? 'Cette commande a déjà été livrée ou ne peut plus être livrée.' : 'Impossible de livrer cette commande.' };
  }
}

export async function adminGetFulfillmentItems(fulfillmentId: string) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try { return { success: true, items: await repo.adminGetFulfillmentItems(fulfillmentId) }; }
  catch (error) { console.error('adminGetFulfillmentItems failed:', error); return { success: false, error: 'Contenu indisponible.', items: [] }; }
}

export async function adminPrepareFulfillment(orderId: string) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try { return { success: true, fulfillment: await repo.adminPrepareFulfillment(orderId) }; }
  catch (error) { console.error('adminPrepareFulfillment failed:', error); return { success: false, error: 'La livraison digitale n’est pas disponible pour cette commande.' }; }
}

export async function adminAddFulfillmentItem(input: { fulfillmentId: string; type: 'file' | 'link' | 'code' | 'manual'; title: string; description?: string; url?: string; code?: string; message?: string; file?: File }) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try { return { success: true, item: await repo.adminAddFulfillmentItem(input) }; }
  catch (error) { console.error('adminAddFulfillmentItem failed:', error); return { success: false, error: 'Impossible d’ajouter ce contenu.' }; }
}

export async function adminUpdateFulfillmentItem(itemId: string, input: { title: string; description?: string; url?: string; code?: string; message?: string }) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try { return { success: true, item: await repo.adminUpdateFulfillmentItem(itemId, input) }; }
  catch (error) { console.error('adminUpdateFulfillmentItem failed:', error); return { success: false, error: 'Impossible de modifier ce contenu.' }; }
}

export async function adminDeleteFulfillmentItem(itemId: string) {
  if (!(await isAdminAuthenticated())) throw new Error('Unauthorized');
  try { return await repo.adminDeleteFulfillmentItem(itemId); }
  catch (error) { console.error('adminDeleteFulfillmentItem failed:', error); return { success: false, error: 'Impossible de supprimer ce contenu.' }; }
}

export async function adminGetOrderItemsAnalytics(limit?: number) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.adminGetOrderItemsAnalytics(limit);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminGetAnalyticsData(filters?: {
  from?: string;
  to?: string;
  status?: string;
  wilayaCode?: string;
  brandId?: string;
  categoryId?: string;
  departmentId?: string;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.adminGetAnalyticsData(filters);
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export async function adminGetCustomers() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.adminGetCustomers();
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================================================
// SHIPPING
// ============================================================================

export async function adminGetWilayas() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.getWilayas();
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminGetShippingRates() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.getShippingRates();
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminUpdateShippingRate(
  wilayaCode: string,
  method: 'home' | 'stopdesk',
  data: {
    price_dzd?: number;
    eta_min_days?: number;
    eta_max_days?: number;
  }
) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.updateShippingRate(wilayaCode, method, data);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminGetShippingRules() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.getShippingRules();
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminUpdateShippingRules(data: {
  free_shipping_threshold_dzd?: number;
  default_fee_dzd?: number;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.updateShippingRules(data);
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================================================
// CONTENT
// ============================================================================

export async function adminGetHomePageBanners() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.getHomePageBanners();
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminCreateHomePageBanner(data: {
  title_fr: string;
  title_ar: string;
  description_fr?: string;
  description_ar?: string;
  image_url: string;
  link_url?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.createHomepageBanner(data);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminUpdateHomePageBanner(
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
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.updateHomepageBanner(id, data);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminDeleteHomePageBanner(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await repo.deleteHomepageBanner(id);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminGetMarqueeBrands() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.getMarqueeBrands();
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminCreateMarqueeBrand(data: {
  brand_id: string;
  logo_url: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.createMarqueeBrand(data);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminUpdateMarqueeBrand(
  id: string,
  data: {
    brand_id?: string;
    logo_url?: string;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    return await repo.updateMarqueeBrand(id, data);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function adminDeleteMarqueeBrand(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await repo.deleteMarqueeBrand(id);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
