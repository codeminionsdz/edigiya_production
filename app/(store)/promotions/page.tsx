import Link from "next/link"
import { ArrowRight, Tag } from "lucide-react"
import { ProductCard } from "@/components/store/product-card"
import type { Product } from "@/lib/data"
import { getProducts } from "@/app/(store)/actions"

function toUiProduct(product: any): Product {
  return {
    id: product.id,
    slug: product.slug,
    name: {
      fr: product.title_fr || "",
      ar: product.title_ar || product.title_fr || "",
    },
    description: {
      fr: product.description_fr || "",
      ar: product.description_ar || product.description_fr || "",
    },
    price: product.price_dzd || 0,
    compareAtPrice: product.compare_at_price_dzd || undefined,
    images: (product.product_images || []).map((image: any) => image.url),
    category: product.categories?.slug || "",
    department: product.departments?.slug || "",
    brand: product.brands?.name || "",
    rating: 5,
    reviewCount: 0,
    inStock: (product.stock || 0) > 0,
    stockCount: product.stock || 0,
    specs: {},
    tags: [],
    isNew: false,
    isBestSeller: Boolean(product.is_featured),
    isDeal: Boolean(product.compare_at_price_dzd && product.compare_at_price_dzd > product.price_dzd),
  }
}

export default async function PromotionsPage() {
  const result = await getProducts({ limit: 48 })
  const rows = result?.products || []

  const deals = rows
    .filter((product) => product.compare_at_price_dzd && product.compare_at_price_dzd > product.price_dzd)
    .map(toUiProduct)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Tag className="h-3.5 w-3.5" />
            Promotions en cours
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">Offres speciales</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Profitez des meilleures reductions sur une selection de produits.
          </p>
        </div>
        <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          Voir toute la boutique
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center">
          <p className="text-lg font-semibold text-foreground">Aucune promotion pour le moment</p>
          <p className="mt-2 text-sm text-muted-foreground">Revenez bientot pour de nouvelles offres.</p>
          <Link href="/shop" className="mt-4">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Explorer la boutique
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {deals.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}
