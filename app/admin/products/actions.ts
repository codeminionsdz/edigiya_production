"use server"

import { supabaseAdmin } from "@/lib/db"

// ============ PRODUCT CATEGORIES ACTIONS ============

export async function getProductCategories(productId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_categories")
      .select("*, categories(id, slug, name_fr, name_ar)")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error("Error fetching product categories:", error)
    return { error: String(error), data: [] }
  }
}

export async function addProductCategory(productId: string, categoryId: string, sortOrder: number = 0) {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_categories")
      .insert([
        {
          product_id: productId,
          category_id: categoryId,
          sort_order: sortOrder,
        },
      ])
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error("Error adding product category:", error)
    return { error: String(error), data: null }
  }
}

export async function removeProductCategory(productId: string, categoryId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("product_categories")
      .delete()
      .eq("product_id", productId)
      .eq("category_id", categoryId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error("Error removing product category:", error)
    return { success: false, error: String(error) }
  }
}

// ============ PRODUCT DEPARTMENTS ACTIONS ============

export async function getProductDepartments(productId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_departments")
      .select("*, departments(id, slug, name_fr, name_ar)")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error("Error fetching product departments:", error)
    return { error: String(error), data: [] }
  }
}

export async function addProductDepartment(productId: string, departmentId: string, sortOrder: number = 0) {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_departments")
      .insert([
        {
          product_id: productId,
          department_id: departmentId,
          sort_order: sortOrder,
        },
      ])
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error("Error adding product department:", error)
    return { error: String(error), data: null }
  }
}

export async function removeProductDepartment(productId: string, departmentId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("product_departments")
      .delete()
      .eq("product_id", productId)
      .eq("department_id", departmentId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error("Error removing product department:", error)
    return { success: false, error: String(error) }
  }
}

// ============ GET ALL CATEGORIES AND DEPARTMENTS ============

export async function getAllCategories() {
  try {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("id, slug, name_fr, name_ar")
      .order("name_fr", { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error("Error fetching categories:", error)
    return { error: String(error), data: [] }
  }
}

export async function getAllDepartments() {
  try {
    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("id, slug, name_fr, name_ar")
      .order("name_fr", { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error("Error fetching departments:", error)
    return { error: String(error), data: [] }
  }
}
