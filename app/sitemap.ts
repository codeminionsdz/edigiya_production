import type { MetadataRoute } from "next"
import { getBrands, getCategories, getDepartments, getProducts } from "@/lib/repositories"

const LEGACY_TECH_DEPARTMENT_SLUGS = new Set([
  "informatique",
  "electronique",
  "accessoires",
  "pcs-gaming",
  "laptops",
  "composants",
  "moniteurs",
  "apple",
  "cameras",
  "reseau",
  "imprimantes",
  "bureautique",
  "peripheriques",
  "stockage",
  "chaises-bureaux",
])

const LEGACY_TECH_HINTS = [
  "info",
  "electron",
  "gaming",
  "laptop",
  "monitor",
  "camera",
  "reseau",
  "imprimante",
  "bureau",
  "peripher",
  "stockage",
  "apple",
]

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase()
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function isLegacyTechDepartment(department: { slug?: string | null; name_fr?: string | null; name_ar?: string | null }) {
  const slug = normalizeText(department.slug)
  const nameFr = normalizeText(department.name_fr)
  const nameAr = normalizeText(department.name_ar)
  if (!slug && !nameFr && !nameAr) return false
  if (LEGACY_TECH_DEPARTMENT_SLUGS.has(slug)) return true
  const haystack = `${slug} ${nameFr} ${nameAr}`
  return LEGACY_TECH_HINTS.some((hint) => haystack.includes(hint))
}

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function getBaseUrl() {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim()
  if (!raw) return "http://localhost:3000"
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol
}

function withBase(baseUrl: string, pathname: string) {
  return `${baseUrl}${pathname}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: withBase(baseUrl, "/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: withBase(baseUrl, "/shop"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: withBase(baseUrl, "/brands"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: withBase(baseUrl, "/promotions"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: withBase(baseUrl, "/support"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: withBase(baseUrl, "/contact"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ]

  try {
    const [productsResult, departments, categories, brands] = await Promise.all([
      getProducts({ limit: 5000, onlyActive: true }),
      getDepartments(true),
      getCategories(true),
      getBrands(true),
    ])

    const productEntries: MetadataRoute.Sitemap = (productsResult.products || [])
      .filter((product: any) => Boolean(product?.slug))
      .map((product: any) => ({
        url: withBase(baseUrl, `/product/${encodeURIComponent(product.slug)}`),
        lastModified: product.updated_at ? new Date(product.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))

    const departmentEntries: MetadataRoute.Sitemap = (departments || [])
      .filter((department: any) => Boolean(department?.slug) && !isLegacyTechDepartment(department))
      .map((department: any) => ({
        url: withBase(baseUrl, `/department/${encodeURIComponent(department.slug)}`),
        lastModified: department.updated_at ? new Date(department.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }))

    const categoryEntries: MetadataRoute.Sitemap = (categories || [])
      .filter((category: any) => {
        if (!category?.slug) return false
        const department = relationOne<any>(category?.departments)
        return !isLegacyTechDepartment(department || {})
      })
      .map((category: any) => ({
        url: withBase(baseUrl, `/category/${encodeURIComponent(category.slug)}`),
        lastModified: category.updated_at ? new Date(category.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))

    const brandEntries: MetadataRoute.Sitemap = (brands || [])
      .map((brand: any) => {
        const slug = String(brand?.slug || slugify(brand?.name || ""))
        return {
          slug,
          updated_at: brand?.updated_at,
        }
      })
      .filter((brand) => Boolean(brand.slug))
      .map((brand) => ({
        url: withBase(baseUrl, `/brand/${encodeURIComponent(brand.slug)}`),
        lastModified: brand.updated_at ? new Date(brand.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))

    return [...staticEntries, ...departmentEntries, ...categoryEntries, ...brandEntries, ...productEntries]
  } catch (error) {
    console.error("Failed to generate sitemap dynamically:", error)
    return staticEntries
  }
}
