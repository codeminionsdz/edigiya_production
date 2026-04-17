"use server"

import { supabaseAdmin } from "@/lib/db"

// ============ NAVBAR ITEMS ACTIONS ============

export async function getNavbarItems() {
  try {
    const { data, error } = await supabaseAdmin
      .from("navbar_items")
      .select("*")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true })

    if (error) throw error
    return { data: data || [] }
  } catch (error) {
    console.error("Error fetching navbar items:", error)
    return { error: "Failed to fetch navbar items", data: [] }
  }
}

export async function getAllNavbarItems() {
  try {
    const { data, error } = await supabaseAdmin
      .from("navbar_items")
      .select("*")
      .order("sort_order", { ascending: true })

    if (error) throw error
    return { data: data || [] }
  } catch (error) {
    console.error("Error fetching all navbar items:", error)
    return { error: "Failed to fetch navbar items", data: [] }
  }
}

export async function createNavbarItem(item: {
  label_ar: string
  label_fr: string
  url: string
  sort_order?: number
  type?: string
  target?: string
  icon_name?: string
  parent_id?: string | null
}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("navbar_items")
      .insert([
        {
          label_ar: item.label_ar,
          label_fr: item.label_fr,
          url: item.url,
          sort_order: item.sort_order || 0,
          type: item.type || "link",
          target: item.target || "_self",
          icon_name: item.icon_name,
          parent_id: item.parent_id || null,
          is_active: true,
        },
      ])
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error("Error creating navbar item:", error)
    return { error: String(error), data: null }
  }
}

export async function updateNavbarItem(
  id: string,
  item: {
    label_ar?: string
    label_fr?: string
    url?: string
    sort_order?: number
    type?: string
    target?: string
    icon_name?: string
    is_active?: boolean
  }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("navbar_items")
      .update(item)
      .eq("id", id)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error("Error updating navbar item:", error)
    return { error: String(error), data: null }
  }
}

export async function deleteNavbarItem(id: string) {
  try {
    const { error } = await supabaseAdmin
      .from("navbar_items")
      .delete()
      .eq("id", id)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error("Error deleting navbar item:", error)
    return { success: false, error: String(error) }
  }
}

export async function updateNavbarItemOrder(items: Array<{ id: string; sort_order: number }>) {
  try {
    const updates = items.map((item) =>
      supabaseAdmin
        .from("navbar_items")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id)
    )

    const results = await Promise.all(updates)

    for (const result of results) {
      if (result.error) throw result.error
    }

    return { success: true, error: null }
  } catch (error) {
    console.error("Error updating navbar order:", error)
    return { success: false, error: String(error) }
  }
}

// ============ CUSTOM PAGES ACTIONS ============

export async function getCustomPages() {
  try {
    const { data, error } = await supabaseAdmin
      .from("custom_pages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error) throw error
    return { data: data || [] }
  } catch (error) {
    console.error("Error fetching custom pages:", error)
    return { error: "Failed to fetch custom pages", data: [] }
  }
}

export async function getAllCustomPages() {
  try {
    const { data, error } = await supabaseAdmin
      .from("custom_pages")
      .select("*")
      .order("sort_order", { ascending: true })

    if (error) throw error
    return { data: data || [] }
  } catch (error) {
    console.error("Error fetching all custom pages:", error)
    return { error: "Failed to fetch all custom pages", data: [] }
  }
}

export async function getCustomPageBySlug(slug: string) {
  try {
    console.log("🔍 Fetching page with slug:", slug)
    
    const { data, error } = await supabaseAdmin
      .from("custom_pages")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()

    console.log("📊 Query result:", { data, error })

    if (error) {
      console.error("❌ Query error:", error)
      throw error
    }
    
    if (!data) {
      console.error("❌ Page not found with slug:", slug)
      return { error: "Page not found", data: null }
    }
    
    console.log("✅ Page found:", data)
    return { data, error: null }
  } catch (error) {
    console.error("Error fetching custom page:", error)
    return { error: String(error), data: null }
  }
}

export async function createCustomPage(page: {
  slug: string
  title_ar: string
  title_fr: string
  content_ar?: string
  content_fr?: string
  meta_description_ar?: string
  meta_description_fr?: string
  meta_keywords?: string
  image_url?: string
  is_navbar_visible?: boolean
  sort_order?: number
}) {
  try {
    // Check if slug already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("custom_pages")
      .select("id")
      .eq("slug", page.slug)
      .maybeSingle()  // Changed from .single() to .maybeSingle()

    if (checkError) {
      console.error("Error checking existing slug:", checkError)
      return { error: "Failed to check slug", data: null }
    }

    if (existing) {
      return { error: "Slug already exists", data: null }
    }

    const { data, error } = await supabaseAdmin
      .from("custom_pages")
      .insert([
        {
          slug: page.slug,
          title_ar: page.title_ar,
          title_fr: page.title_fr,
          content_ar: page.content_ar || "",
          content_fr: page.content_fr || "",
          meta_description_ar: page.meta_description_ar || "",
          meta_description_fr: page.meta_description_fr || "",
          meta_keywords: page.meta_keywords || "",
          image_url: page.image_url || null,
          is_navbar_visible: page.is_navbar_visible || false,
          sort_order: page.sort_order || 0,
          is_active: true,
        },
      ])
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error("Error creating custom page:", error)
    return { error: String(error), data: null }
  }
}

export async function updateCustomPage(
  id: string,
  page: {
    title_ar?: string
    title_fr?: string
    content_ar?: string
    content_fr?: string
    meta_description_ar?: string
    meta_description_fr?: string
    meta_keywords?: string
    image_url?: string
    is_active?: boolean
    is_navbar_visible?: boolean
    sort_order?: number
  }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("custom_pages")
      .update(page)
      .eq("id", id)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error("Error updating custom page:", error)
    return { error: String(error), data: null }
  }
}

export async function deleteCustomPage(id: string) {
  try {
    const { error } = await supabaseAdmin
      .from("custom_pages")
      .delete()
      .eq("id", id)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error("Error deleting custom page:", error)
    return { success: false, error: String(error) }
  }
}

export async function toggleCustomPageActive(id: string, isActive: boolean) {
  try {
    const { data, error } = await supabaseAdmin
      .from("custom_pages")
      .update({ is_active: isActive })
      .eq("id", id)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error("Error toggling custom page:", error)
    return { error: String(error), data: null }
  }
}

// ============ CUSTOM PAGE PRODUCTS ACTIONS ============

export async function getPageProducts(pageId: string) {
  try {
    console.log("📦 Fetching products for page:", pageId)
    
    const { data, error } = await supabaseAdmin
      .from("custom_page_products")
      .select(`
        *,
        products(
          *,
          brands(id, name, slug, logo_url),
          departments(id, slug, name_fr, name_ar),
          categories(id, slug, name_fr, name_ar),
          product_images(id, url, alt_fr, alt_ar, sort_order),
          product_specs(id, key, value_fr, value_ar, sort_order)
        )
      `)
      .eq("page_id", pageId)
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("❌ Error fetching products:", error)
      throw error
    }
    
    console.log("✅ Products found:", data?.length || 0, data)
    return { data: data || [], error: null }
  } catch (error) {
    console.error("Error fetching page products:", error)
    return { error: String(error), data: [] }
  }
}

export async function addProductToPage(pageId: string, productId: string, sortOrder: number = 0) {
  try {
    const { data, error } = await supabaseAdmin
      .from("custom_page_products")
      .insert([
        {
          page_id: pageId,
          product_id: productId,
          sort_order: sortOrder,
        },
      ])
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error("Error adding product to page:", error)
    return { error: String(error), data: null }
  }
}

export async function removeProductFromPage(pageId: string, productId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("custom_page_products")
      .delete()
      .eq("page_id", pageId)
      .eq("product_id", productId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error("Error removing product from page:", error)
    return { success: false, error: String(error) }
  }
}

export async function updatePageProductOrder(items: Array<{ id: string; sort_order: number }>) {
  try {
    const updates = items.map((item) =>
      supabaseAdmin
        .from("custom_page_products")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id)
    )

    const results = await Promise.all(updates)

    for (const result of results) {
      if (result.error) throw result.error
    }

    return { success: true, error: null }
  } catch (error) {
    console.error("Error updating product order:", error)
    return { success: false, error: String(error) }
  }
}
