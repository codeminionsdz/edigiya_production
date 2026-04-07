'use server';

import * as repo from '@/lib/repositories';
import { cookies } from 'next/headers';

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

function isLegacyTechDepartment(department: { slug?: string | null; name_fr?: string | null; name_ar?: string | null }) {
  const slug = normalizeText(department.slug);
  const nameFr = normalizeText(department.name_fr);
  const nameAr = normalizeText(department.name_ar);
  if (!slug && !nameFr && !nameAr) return false;
  if (LEGACY_TECH_DEPARTMENT_SLUGS.has(slug)) return true;
  const haystack = `${slug} ${nameFr} ${nameAr}`;
  return LEGACY_TECH_HINTS.some((hint) => haystack.includes(hint));
}

function getCategoryDepartment(category: any) {
  const dep = Array.isArray(category?.departments) ? category.departments[0] : category?.departments;
  return dep || null;
}

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================

export async function getProducts(filters?: {
  departmentId?: string;
  categoryId?: string;
  brandId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}) {
  try {
    return await repo.getProducts({ ...filters, onlyActive: true });
  } catch (error: any) {
    console.error('Failed to get products:', error);
    return { error: error.message, products: [] };
  }
}

export async function getProductById(id: string) {
  try {
    return await repo.getProductById(id);
  } catch (error: any) {
    console.error('Failed to get product:', error);
    return { error: error.message };
  }
}

export async function getProductBySlug(slug: string) {
  try {
    return await repo.getProductBySlug(slug);
  } catch (error: any) {
    console.error('Failed to get product:', error);
    return { error: error.message };
  }
}

// ============================================================================
// DEPARTMENT OPERATIONS
// ============================================================================

export async function getDepartments() {
  try {
    const departments = await repo.getDepartments(true);
    return (departments || []).filter((department: any) => !isLegacyTechDepartment(department));
  } catch (error: any) {
    console.error('Failed to get departments:', error);
    return [];
  }
}

export async function getDepartmentBySlug(slug: string) {
  try {
    return await repo.getDepartmentBySlug(slug);
  } catch (error: any) {
    console.error('Failed to get department:', error);
    return null;
  }
}

// ============================================================================
// CATEGORY OPERATIONS
// ============================================================================

export async function getCategoriesByDepartment(departmentId: string, parentId?: string | null) {
  try {
    return await repo.getCategoriesByDepartment(departmentId, parentId, true);
  } catch (error: any) {
    console.error('Failed to get categories:', error);
    return [];
  }
}

export async function getCategoryBySlug(slug: string) {
  const normalizedSlug = normalizeText(slug);
  if (!normalizedSlug) return null;

  try {
    const category = await repo.getCategoryBySlug(normalizedSlug);
    if (category && category.is_active !== false) {
      return category;
    }
  } catch (error: any) {
    console.error('Failed to get category by slug (direct):', error);
  }

  // Fallback for duplicated slugs across departments or anon-read issues.
  try {
    const categories = await repo.getCategories(true);
    const matched = (categories || []).find((category: any) => {
      const department = getCategoryDepartment(category);
      return normalizeText(category?.slug) === normalizedSlug && !isLegacyTechDepartment(department || {});
    });
    return matched || null;
  } catch (error: any) {
    console.error('Failed to get category by slug (fallback):', error);
    return null;
  }
}

export async function getCategories() {
  try {
    const categories = await repo.getCategories(true);
    return (categories || []).filter((category: any) => {
      const department = getCategoryDepartment(category);
      return !isLegacyTechDepartment(department || {});
    });
  } catch (error: any) {
    console.error('Failed to get categories list:', error);
    return [];
  }
}

export async function getMegaMenuTaxonomy() {
  try {
    const taxonomy = await repo.getMegaMenuTaxonomy();
    return (taxonomy || []).filter((department: any) => !isLegacyTechDepartment(department));
  } catch (error: any) {
    console.error('Failed to get taxonomy menu:', error);
    return [];
  }
}

// ============================================================================
// BRAND OPERATIONS
// ============================================================================

export async function getBrands() {
  try {
    return await repo.getBrands(true);
  } catch (error: any) {
    console.error('Failed to get brands:', error);
    return [];
  }
}

// ============================================================================
// SHIPPING OPERATIONS
// ============================================================================

export async function getShippingRateForWilaya(wilayaCode: string, method: 'home' | 'stopdesk') {
  try {
    return await repo.getShippingRate(wilayaCode, method);
  } catch (error: any) {
    console.error('Failed to get shipping rate:', error);
    return null;
  }
}

export async function getWilayas() {
  try {
    return await repo.getWilayas();
  } catch (error: any) {
    console.error('Failed to get wilayas:', error);
    return [];
  }
}

// ============================================================================
// ORDERS OPERATIONS
// ============================================================================

export async function createOrder(data: {
  session_id: string;
  order_number: string;
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: string;
  delivery_method: 'home' | 'desk' | 'stopdesk';
  wilaya_code: string;
  items: Array<{
    product_id: string;
    qty: number;
    unit_price_dzd: number;
    title_snapshot: string;
  }>;
  address_snapshot: {
    full_name: string;
    phone: string;
    address_line1: string;
    address_line2?: string;
    commune: string;
    wilaya_code: string;
  };
}) {
  try {
    const normalizedWilayaCode = Number.parseInt(String(data.wilaya_code), 10);
    return await repo.createOrder({
      order_number: data.order_number,
      session_id: data.session_id,
      payment_method: data.payment_method,
      subtotal: data.subtotal,
      shipping: data.shipping,
      total: data.total,
      wilaya_code: Number.isFinite(normalizedWilayaCode) ? normalizedWilayaCode : 0,
      delivery_method: data.delivery_method === 'stopdesk' ? 'desk' : data.delivery_method,
      address_snapshot: data.address_snapshot,
    });
  } catch (error: any) {
    console.error('Failed to create order:', error);
    return { error: error.message };
  }
}

// ============================================================================
// CONTENT OPERATIONS
// ============================================================================

export async function getHomePageBanners() {
  try {
    return await repo.getHomePageBanners();
  } catch (error: any) {
    console.error('Failed to get banners:', error);
    return [];
  }
}

export async function getMarqueeBrands() {
  try {
    return await repo.getMarqueeBrands();
  } catch (error: any) {
    console.error('Failed to get marquee brands:', error);
    return [];
  }
}

// ============================================================================
// ORDER OPERATIONS
// ============================================================================

export async function getOrdersBySession(sessionId: string) {
  try {
    console.log('🔍 getOrdersBySession - Session ID:', sessionId);
    const result = await repo.getOrders({ sessionId, limit: 100 });
    console.log('🔍 getOrdersBySession - Result:', result);
    return result.orders;
  } catch (error: any) {
    console.error('Failed to get orders:', error);
    return [];
  }
}

export async function getMyOrders() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    console.log('🔍 getMyOrders - Session ID from server:', sessionId);
    
    if (!sessionId) {
      console.log('❌ getMyOrders - No session_id found');
      return [];
    }
    
    const result = await repo.getOrders({ sessionId, limit: 100 });
    console.log('🔍 getMyOrders - Result:', result);
    return result.orders;
  } catch (error: any) {
    console.error('Failed to get my orders:', error);
    return [];
  }
}

export async function getOrderById(orderId: string) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    console.log('🔍 getOrderById - Session ID:', sessionId, 'Order ID:', orderId);
    
    if (!sessionId) {
      console.log('❌ getOrderById - No session_id found');
      return null;
    }
    
    // Get the order
    const order = await repo.getOrderById(orderId);
    
    // Verify the order belongs to this session
    if (order.session_id !== sessionId) {
      console.log('❌ getOrderById - Order does not belong to this session');
      return null;
    }
    
    console.log('🔍 getOrderById - Order:', order);
    return order;
  } catch (error: any) {
    console.error('Failed to get order:', error);
    return null;
  }
}

// ============================================================================
// CUSTOMER PROFILE OPERATIONS
// ============================================================================

export async function getMyProfile() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    if (!sessionId) {
      return null;
    }
    
    return await repo.getCustomerProfile(sessionId);
  } catch (error: any) {
    console.error('Failed to get profile:', error);
    return null;
  }
}

export async function updateMyProfile(formData: FormData) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    if (!sessionId) {
      return { error: 'Session non trouvée' };
    }
    
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    
    await repo.upsertCustomerProfile({
      session_id: sessionId,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update profile:', error);
    return { error: error.message };
  }
}

// ============================================================================
// CONTACT MESSAGES OPERATIONS
// ============================================================================

export async function submitContactMessage(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  try {
    return await repo.createContactMessage(data);
  } catch (error: any) {
    console.error('Failed to submit contact message:', error);
    return { error: error.message };
  }
}
