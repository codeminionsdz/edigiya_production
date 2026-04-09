"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useLocale } from "@/lib/locale-context"
import { getBrands, getMegaMenuTaxonomy, getProducts } from "@/app/(store)/actions"
import { BrandLogo } from "@/components/store/brand-logo"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SearchDepartment = {
  id: string
  slug: string
  name_fr: string
  name_ar: string
  categories?: Array<{
    id: string
    slug: string
    name_fr: string
    name_ar: string
  }>
}

type SearchBrand = {
  id: string
  name: string
  slug?: string | null
  logo_url?: string | null
}

type SearchCategoryHit = {
  id: string
  slug: string
  name_fr: string
  name_ar: string
  department_slug: string
}

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

function isLegacyTechDepartment(department: { slug?: string | null; name_fr?: string | null; name_ar?: string | null }) {
  const slug = normalizeText(department.slug)
  const nameFr = normalizeText(department.name_fr)
  const nameAr = normalizeText(department.name_ar)
  if (!slug && !nameFr && !nameAr) return false
  if (LEGACY_TECH_DEPARTMENT_SLUGS.has(slug)) return true
  const haystack = `${slug} ${nameFr} ${nameAr}`
  return LEGACY_TECH_HINTS.some((hint) => haystack.includes(hint))
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function formatPriceDZD(price: number) {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
  }).format(price)
}

function slugifyBrandName(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { locale, t } = useLocale()
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [productsRows, setProductsRows] = useState<any[]>([])
  const [departments, setDepartments] = useState<SearchDepartment[]>([])
  const [brands, setBrands] = useState<SearchBrand[]>([])

  useEffect(() => {
    if (!open) return

    let active = true

    async function loadSearchData() {
      setIsLoading(true)
      try {
        const [productsResult, taxonomyRows, brandRows] = await Promise.all([
          getProducts({ limit: 120 }),
          getMegaMenuTaxonomy(),
          getBrands(),
        ])

        if (!active) return

        const allProducts = Array.isArray(productsResult?.products) ? productsResult.products : []
        const filteredByDepartment = allProducts.filter((product: any) => {
          const department = relationOne<{ slug?: string | null; name_fr?: string | null; name_ar?: string | null }>(
            product?.departments
          )
          return !isLegacyTechDepartment(department || {})
        })

        const allowedBrandIds = new Set(
          filteredByDepartment
            .map((product: any) => {
              const brand = relationOne<{ id?: string | null }>(product?.brands)
              return String(brand?.id || product?.brand_id || "")
            })
            .filter(Boolean)
        )

        const allBrands = Array.isArray(brandRows) ? brandRows : []
        const filteredBrandsRows =
          allowedBrandIds.size > 0
            ? allBrands.filter((brand: any) => allowedBrandIds.has(String(brand?.id || "")))
            : allBrands

        setProductsRows(filteredByDepartment)
        setDepartments(Array.isArray(taxonomyRows) ? taxonomyRows : [])
        setBrands(filteredBrandsRows)
      } catch (error) {
        console.error("Failed to load search data:", error)
        if (active) {
          setProductsRows([])
          setDepartments([])
          setBrands([])
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadSearchData()

    return () => {
      active = false
    }
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()

  const categoryHits = useMemo<SearchCategoryHit[]>(
    () =>
      departments.flatMap((department) =>
        (department.categories || []).map((category) => ({
          id: String(category.id),
          slug: String(category.slug),
          name_fr: String(category.name_fr || ""),
          name_ar: String(category.name_ar || category.name_fr || ""),
          department_slug: String(department.slug),
        }))
      ),
    [departments]
  )

  const filteredProducts = useMemo(() => {
    const rows = productsRows || []
    if (!normalizedQuery) return rows.slice(0, 6)

    return rows
      .filter((product: any) => {
        const brand = relationOne<{ name?: string | null }>(product?.brands)
        const haystack = `${product?.title_fr || ""} ${product?.title_ar || ""} ${brand?.name || ""}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .slice(0, 8)
  }, [productsRows, normalizedQuery])

  const filteredBrands = useMemo(() => {
    const rows = brands || []
    if (!normalizedQuery) return rows.slice(0, 6)
    return rows.filter((brand) => String(brand.name || "").toLowerCase().includes(normalizedQuery)).slice(0, 8)
  }, [brands, normalizedQuery])

  const filteredDepartments = useMemo(() => {
    const rows = departments || []
    if (!normalizedQuery) return rows.slice(0, 4)
    return rows.filter((department) => {
      const label = locale === "ar" ? department.name_ar : department.name_fr
      return String(label || "").toLowerCase().includes(normalizedQuery)
    })
  }, [departments, normalizedQuery, locale])

  const filteredCategories = useMemo(() => {
    const rows = categoryHits || []
    if (!normalizedQuery) return rows.slice(0, 5)
    return rows
      .filter((category) => {
        const label = locale === "ar" ? category.name_ar : category.name_fr
        return String(label || "").toLowerCase().includes(normalizedQuery)
      })
      .slice(0, 8)
  }, [categoryHits, normalizedQuery, locale])

  const hasResults =
    filteredProducts.length > 0 ||
    filteredBrands.length > 0 ||
    filteredDepartments.length > 0 ||
    filteredCategories.length > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        locale === "ar"
          ? "\u0628\u062d\u062b \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a"
          : locale === "fr"
            ? "Recherche produits"
            : "Product search"
      }
      contentClassName="border-border bg-card"
      commandClassName="bg-card text-foreground"
    >
      <CommandInput
        placeholder={t.nav.search}
        value={query}
        onValueChange={setQuery}
      />

      <CommandList>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {locale === "ar"
              ? "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644..."
              : locale === "fr"
                ? "Chargement..."
                : "Loading..."}
          </div>
        ) : (
          <>
            {!hasResults && (
              <CommandEmpty>
                {locale === "ar"
                  ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c."
                  : locale === "fr"
                    ? "Aucun resultat trouve."
                    : "No results found."}
              </CommandEmpty>
            )}

            {filteredProducts.length > 0 && (
              <CommandGroup
                heading={
                  locale === "ar"
                    ? "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a"
                    : locale === "fr"
                      ? "Produits"
                      : "Products"
                }
              >
                {filteredProducts.map((product: any) => {
                  const brand = relationOne<{ name?: string | null }>(product?.brands)
                  const image = Array.isArray(product?.product_images) ? product.product_images[0]?.url : ""
                  const productLabel =
                    locale === "ar"
                      ? String(product?.title_ar || product?.title_fr || "")
                      : String(product?.title_fr || product?.title_ar || "")

                  return (
                    <CommandItem key={product.id} asChild>
                      <Link
                        href={`/product/${product.slug}`}
                        onClick={() => onOpenChange(false)}
                        className="flex items-center justify-between gap-3 rounded-md"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40">
                            {image ? (
                              <img src={String(image)} alt={productLabel} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-medium">{productLabel}</span>
                            <span className="block truncate text-xs text-muted-foreground">{brand?.name || "Brand"}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-primary">
                          {formatPriceDZD(Number(product?.price_dzd || 0))}
                        </span>
                      </Link>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {filteredBrands.length > 0 && (
              <CommandGroup
                heading={
                  locale === "ar"
                    ? "\u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u062a\u062c\u0627\u0631\u064a\u0629"
                    : locale === "fr"
                      ? "Marques"
                      : "Brands"
                }
              >
                {filteredBrands.map((brand) => {
                  const brandSlug = String(brand.slug || slugifyBrandName(brand.name))
                  return (
                    <CommandItem key={brand.id} asChild>
                      <Link
                        href={`/brand/${encodeURIComponent(brandSlug)}`}
                        onClick={() => onOpenChange(false)}
                        className="flex items-center justify-between gap-3 rounded-md"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 px-2">
                            <BrandLogo
                              src={brand.logo_url}
                              alt={brand.name}
                              width={64}
                              height={24}
                              unoptimized
                              imgClassName="h-full w-full object-contain"
                            />
                          </div>
                          <span className="truncate text-sm">{brand.name}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {filteredDepartments.length > 0 && (
              <CommandGroup
                heading={
                  locale === "ar"
                    ? "\u0627\u0644\u0623\u0642\u0633\u0627\u0645"
                    : locale === "fr"
                      ? "Departements"
                      : "Departments"
                }
              >
                {filteredDepartments.map((department) => (
                  <CommandItem key={department.id} asChild>
                    <Link
                      href={`/department/${encodeURIComponent(department.slug)}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{locale === "ar" ? department.name_ar : department.name_fr}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredCategories.length > 0 && (
              <CommandGroup
                heading={
                  locale === "ar"
                    ? "\u0627\u0644\u0641\u0626\u0627\u062a"
                    : locale === "fr"
                      ? "Categories"
                      : "Categories"
                }
              >
                {filteredCategories.map((category) => (
                  <CommandItem key={category.id} asChild>
                    <Link
                      href={`/category/${encodeURIComponent(category.slug)}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{locale === "ar" ? category.name_ar : category.name_fr}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>

      <div className="border-t border-border p-2">
        <Link
          href="/shop"
          onClick={() => onOpenChange(false)}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          {locale === "ar"
            ? "\u0641\u062a\u062d \u0627\u0644\u0645\u062a\u062c\u0631 \u0627\u0644\u0643\u0627\u0645\u0644"
            : locale === "fr"
              ? "Voir la boutique complete"
              : "Open full shop"}
        </Link>
      </div>
    </CommandDialog>
  )
}
