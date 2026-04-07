'use server';

import * as repo from '@/lib/repositories';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { isAdminAuthenticated } from '@/lib/admin-auth';

function requireEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required. Please set it in your environment or .env.local.`);
  }
  return value;
}

const SUPABASE_URL = requireEnvVar('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = requireEnvVar('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function getMarqueeBrandsAdmin() {
  try {
    const { data, error } = await supabaseAdmin
      .from('marquee_brands')
      .select(`
        *,
        brands(id, name, slug, logo_url)
      `)
      .order('sort_order');
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Failed to get marquee brands:', error);
    return [];
  }
}

export async function getAllBrands() {
  try {
    return await repo.getBrands(false);
  } catch (error: any) {
    console.error('Failed to get brands:', error);
    return [];
  }
}

export async function createBrandAdmin(data: {
  name: string;
  slug: string;
  logo_url?: string;
  is_active?: boolean;
}) {
  try {
    const result = await repo.createBrand({
      name: data.name,
      slug: data.slug,
      logo_url: data.logo_url,
      is_active: data.is_active ?? true,
    });

    revalidatePath('/admin/content');
    revalidatePath('/admin/products');
    revalidatePath('/brands');
    return { success: true, brand: result };
  } catch (error: any) {
    console.error('Failed to create brand:', error);
    return { error: error.message };
  }
}

export async function uploadAdminContentImage(formData: FormData) {
  if (!(await isAdminAuthenticated())) {
    return { error: 'Unauthorized' };
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
    console.error('Failed to upload content image:', error);
    return { error: error?.message || 'Upload impossible.' };
  }
}

export async function addBrandToMarquee(brandId: string, logoUrl: string) {
  try {
    // Get current count for sort_order
    const existing = await getMarqueeBrandsAdmin();
    const sortOrder = existing.length;

    await repo.createMarqueeBrand({
      brand_id: brandId,
      logo_url: logoUrl,
      sort_order: sortOrder,
      is_active: true,
    });

    revalidatePath('/admin/content');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to add brand to marquee:', error);
    return { error: error.message };
  }
}

export async function removeBrandFromMarquee(id: string) {
  try {
    await repo.deleteMarqueeBrand(id);
    revalidatePath('/admin/content');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to remove brand from marquee:', error);
    return { error: error.message };
  }
}

export async function updateMarqueeBrandOrder(id: string, sortOrder: number) {
  try {
    await repo.updateMarqueeBrand(id, { sort_order: sortOrder });
    revalidatePath('/admin/content');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update brand order:', error);
    return { error: error.message };
  }
}

export async function toggleMarqueeBrandActive(id: string, isActive: boolean) {
  try {
    await repo.updateMarqueeBrand(id, { is_active: isActive });
    revalidatePath('/admin/content');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to toggle brand active:', error);
    return { error: error.message };
  }
}

export async function addAllBrandsToMarquee() {
  try {
    const [existing, allBrands] = await Promise.all([
      getMarqueeBrandsAdmin(),
      getAllBrands(),
    ]);

    const existingIds = new Set(existing.map((item) => item.brand_id));
    const missing = allBrands.filter((brand) => !existingIds.has(brand.id));

    if (missing.length === 0) {
      return { success: true, inserted: 0 };
    }

    const startOrder = existing.length;
    const payload = missing.map((brand, index) => ({
      brand_id: brand.id,
      logo_url: brand.logo_url || '',
      sort_order: startOrder + index,
      is_active: true,
    }));

    const { error } = await supabaseAdmin.from('marquee_brands').insert(payload);
    if (error) throw error;

    revalidatePath('/admin/content');
    revalidatePath('/');
    return { success: true, inserted: payload.length };
  } catch (error: any) {
    console.error('Failed to add all brands to marquee:', error);
    return { error: error.message };
  }
}

export async function getHomePageBannersAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('homepage_banners')
      .select('*')
      .order('sort_order');

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Failed to get homepage banners:', error);
    return [];
  }
}

export async function createHomePageBannerAdmin(data: {
  title_fr: string;
  title_ar: string;
  description_fr?: string;
  description_ar?: string;
  link_url?: string;
  image_url?: string;
  is_active?: boolean;
}) {
  if (!(await isAdminAuthenticated())) {
    console.error('Admin authentication check failed');
    return { error: 'Vous n\'êtes pas authentifié comme administrateur' };
  }

  try {
    console.log('Creating homepage banner with data:', { title_fr: data.title_fr, title_ar: data.title_ar });
    
    const result = await repo.createHomepageBanner({
      title_fr: data.title_fr,
      title_ar: data.title_ar,
      description_fr: data.description_fr,
      description_ar: data.description_ar,
      link_url: data.link_url,
      image_url: data.image_url || '',
      sort_order: 0,
      is_active: data.is_active ?? true,
    });

    console.log('Homepage banner created successfully:', result);
    revalidatePath('/admin/content');
    revalidatePath('/');
    return { success: true, banner: result };
  } catch (error: any) {
    console.error('Failed to create homepage banner:', {
      message: error?.message,
      code: error?.code,
      detail: error?.details,
      status: error?.status,
    });
    return { error: error?.message || 'Erreur lors de la création du message d\'accueil' };
  }
}

export async function updateHomePageBannerAdmin(
  id: string,
  data: {
    title_fr?: string;
    title_ar?: string;
    description_fr?: string;
    description_ar?: string;
    link_url?: string;
    image_url?: string;
    is_active?: boolean;
  }
) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const result = await repo.updateHomepageBanner(id, {
      ...data,
      image_url: data.image_url ?? undefined,
    });

    revalidatePath('/admin/content');
    revalidatePath('/');
    return { success: true, banner: result };
  } catch (error: any) {
    console.error('Failed to update homepage banner:', error);
    return { error: error.message };
  }
}

export async function deleteHomePageBannerAdmin(id: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    await repo.deleteHomepageBanner(id);
    revalidatePath('/admin/content');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete homepage banner:', error);
    return { error: error.message };
  }
}
