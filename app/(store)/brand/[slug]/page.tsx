import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/store/product-card"
import { BrandLogo } from "@/components/store/brand-logo"
import type { Product } from "@/lib/data"
import { getBrands, getProducts } from "@/app/(store)/actions"

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function slugifyBrandName(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
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

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const normalizedSlug = String(slug || "").trim().toLowerCase()

  const brandsResult = await getBrands()
  const brands = Array.isArray(brandsResult) ? brandsResult : []

  const brand =
    brands.find((row: any) => String(row?.slug || "").trim().toLowerCase() === normalizedSlug) ||
    brands.find((row: any) => slugifyBrandName(row?.name) === normalizedSlug)

  if (!brand) {
    notFound()
  }

  const productsResult = await getProducts({ brandId: brand.id, limit: 48 })
  const products = (productsResult?.products || []).map(toUiProduct)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Accueil
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/brands" className="hover:text-primary">
          Marques
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{brand.name}</span>
      </nav>

      <div className="mb-8 rounded-2xl border border-border bg-card/65 p-5">
        <div className="flex items-center gap-4">
          <BrandLogo
            src={brand.logo_url}
            alt={brand.name}
            width={96}
            height={48}
            unoptimized
            imgClassName="grayscale"
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{brand.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length} offres disponibles
            </p>
          </div>
        </div>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
          <p className="text-lg font-semibold text-foreground">Aucun produit trouve</p>
          <Link href="/shop" className="mt-4">
            <Button className="gap-2">
              Retour a la boutique
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
