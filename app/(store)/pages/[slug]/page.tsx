"use server"

import { getCustomPageBySlug, getPageProducts } from "@/app/admin/navbar/actions"
import { ProductCard } from "@/components/store/product-card"
import { Metadata } from "next"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getCustomPageBySlug(slug)

  if (result.error || !result.data) {
    return {
      title: "Page Not Found",
    }
  }

  return {
    title: result.data.title_fr,
    description: result.data.meta_description_fr,
  }
}

// Helper to transform Supabase product to ProductCard format
function transformProduct(supabaseProduct: any) {
  const images = supabaseProduct.product_images
    ? supabaseProduct.product_images
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((img: any) => img.url)
    : []

  const specs: Record<string, string> = {}
  if (supabaseProduct.product_specs) {
    supabaseProduct.product_specs.forEach((spec: any) => {
      specs[spec.key] = spec.value_fr || spec.value_ar || ""
    })
  }

  return {
    id: supabaseProduct.id,
    slug: supabaseProduct.slug,
    name: {
      fr: supabaseProduct.title_fr || "Unknown",
      ar: supabaseProduct.title_ar || "Unknown EN",
    },
    description: {
      fr: supabaseProduct.description_fr || "",
      ar: supabaseProduct.description_ar || "",
    },
    price: Number(supabaseProduct.price_dzd) || 0,
    compareAtPrice: supabaseProduct.compare_at_price_dzd
      ? Number(supabaseProduct.compare_at_price_dzd)
      : undefined,
    images: images,
    category: supabaseProduct.categories?.name_fr || "Unknown",
    department: supabaseProduct.departments?.name_fr || "Unknown",
    brand: supabaseProduct.brands?.name || "Unknown Brand",
    rating: 4.8, // Default rating
    reviewCount: 12, // Default review count
    inStock: supabaseProduct.stock > 0,
    stockCount: supabaseProduct.stock || 0,
    specs: specs,
    tags: [],
    isBestSeller: supabaseProduct.is_featured || false,
  }
}

export default async function CustomPage({ params }: PageProps) {
  const { slug } = await params
  console.log("🔍 Looking for page with slug:", slug)

  const result = await getCustomPageBySlug(slug)
  console.log("📊 Result:", result)

  if (result.error || !result.data) {
    console.log("❌ Page not found:", result.error || "No data")
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Page Not Found</h1>
          <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const page = result.data

  // Get products for this page
  const productsResult = await getPageProducts(page.id)
  const pageProducts = productsResult.data || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <article>
        {page.image_url && (
          <img
            src={page.image_url}
            alt={page.title_fr}
            className="mb-6 h-96 w-full rounded-lg object-cover"
          />
        )}
        <h1 className="mb-4 text-4xl font-bold">{page.title_fr}</h1>
        <div className="prose max-w-none mb-12">
          <div dangerouslySetInnerHTML={{ __html: page.content_fr || "" }} />
        </div>

        {/* Display Products if any */}
        {pageProducts.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <h2 className="mb-8 text-3xl font-bold">Featured Products</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageProducts.map((pageProduct: any, index: number) => {
                const product = pageProduct.products
                if (!product) return null

                const transformedProduct = transformProduct(product)
                return (
                  <ProductCard
                    key={pageProduct.id}
                    product={transformedProduct}
                    index={index}
                  />
                )
              })}
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
