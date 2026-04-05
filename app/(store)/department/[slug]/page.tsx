import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/store/product-card"
import type { Product } from "@/lib/data"
import {
  getCategoriesByDepartment,
  getDepartmentBySlug,
  getProducts,
} from "@/app/(store)/actions"

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function toUiProduct(product: any): Product {
  const brand = relationOne<{ name?: string | null }>(product?.brands)
  const category = relationOne<{ slug?: string | null }>(product?.categories)
  const department = relationOne<{ slug?: string | null }>(product?.departments)

  return {
    id: String(product?.id || ""),
    slug: String(product?.slug || ""),
    name: {
      fr: String(product?.title_fr || ""),
      ar: String(product?.title_ar || product?.title_fr || ""),
    },
    description: {
      fr: String(product?.description_fr || ""),
      ar: String(product?.description_ar || product?.description_fr || ""),
    },
    price: Number(product?.price_dzd || 0),
    compareAtPrice: product?.compare_at_price_dzd ? Number(product.compare_at_price_dzd) : undefined,
    images: Array.isArray(product?.product_images)
      ? product.product_images.map((image: any) => String(image?.url || "")).filter(Boolean)
      : [],
    category: String(category?.slug || ""),
    department: String(department?.slug || ""),
    brand: String(brand?.name || ""),
    rating: 4.8,
    reviewCount: 0,
    inStock: Number(product?.stock || 0) > 0,
    stockCount: Number(product?.stock || 0),
    specs: {},
    tags: [],
    isBestSeller: Boolean(product?.is_featured),
    isDeal: Boolean(product?.compare_at_price_dzd && Number(product.compare_at_price_dzd) > Number(product?.price_dzd || 0)),
  }
}

export default async function DepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ category?: string }>
}) {
  const { slug } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const { category: selectedCategorySlug } = resolvedSearchParams
  const department = await getDepartmentBySlug(slug)

  if (!department) {
    notFound()
  }

  const categories = await getCategoriesByDepartment(department.id, null)
  const categoryRows = Array.isArray(categories) ? categories : []
  const activeCategory =
    categoryRows.find(
      (category: any) =>
        String(category?.slug || "").toLowerCase() === String(selectedCategorySlug || "").toLowerCase()
    ) || null

  const productsResult = await getProducts({
    departmentId: department.id,
    categoryId: activeCategory?.id,
    limit: 48,
  })

  const rawProducts = productsResult?.products || []
  const products = rawProducts.map(toUiProduct)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Accueil
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/shop" className="hover:text-primary">
          Boutique
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{department.name_fr}</span>
      </nav>

      <div className="mb-6 rounded-2xl border border-border bg-card/65 p-5 backdrop-blur-sm">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{department.name_fr}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {activeCategory
            ? `${products.length} produit(s) dans ${activeCategory.name_fr}`
            : `${products.length} produit(s) disponible(s)`}
        </p>
      </div>

      {categoryRows.length > 0 && (
        <div className="mb-8 rounded-2xl border border-border bg-card/55 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Categories
            </h2>
            {activeCategory && (
              <Link
                href={`/department/${encodeURIComponent(department.slug)}`}
                className="text-xs font-semibold text-primary transition-opacity hover:opacity-80"
              >
                Effacer le filtre
              </Link>
            )}
          </div>

          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible lg:grid-cols-3">
            <Link
              href={`/department/${encodeURIComponent(department.slug)}`}
              className={`group rounded-xl border p-4 transition-all ${
                !activeCategory
                  ? "min-w-[78%] snap-start border-primary/70 bg-primary/10 shadow-[0_10px_26px_-18px_rgba(255,214,0,0.75)] sm:min-w-0"
                  : "min-w-[78%] snap-start border-border bg-background/70 hover:border-primary/40 sm:min-w-0"
              }`}
            >
              <p className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                Tous les produits
              </p>
              <p className="text-sm text-muted-foreground">Afficher tout le departement</p>
            </Link>

            {categoryRows.map((category) => (
              <Link
                key={category.id}
                href={`/department/${encodeURIComponent(department.slug)}?category=${encodeURIComponent(category.slug)}`}
                className={`group min-w-[78%] snap-start rounded-xl border p-4 transition-all sm:min-w-0 ${
                  activeCategory?.id === category.id
                    ? "border-primary/70 bg-primary/10 shadow-[0_10px_26px_-18px_rgba(255,214,0,0.75)]"
                    : "border-border bg-background/70 hover:border-primary/40"
                }`}
              >
                <p className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                  {category.name_fr}
                </p>
                <p className="text-sm text-muted-foreground">{category.name_ar}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {activeCategory ? `Produits: ${activeCategory.name_fr}` : "Produits du departement"}
        </h2>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {products.length} article(s)
        </span>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
          <p className="text-lg font-semibold text-foreground">Aucun produit trouve</p>
          <Link href={activeCategory ? `/department/${encodeURIComponent(department.slug)}` : "/shop"} className="mt-4">
            <Button className="gap-2">
              {activeCategory ? "Voir les autres categories" : "Retour a la boutique"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
