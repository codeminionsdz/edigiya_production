import { notFound } from "next/navigation"
import { getProductBySlug } from "@/lib/repositories"
import { ProductPageClient } from "./client"
import type { Product } from "@/lib/data"

function transformProduct(dbProduct: any): Product {
  return {
    id: dbProduct.id,
    slug: dbProduct.slug,
    name: {
      fr: dbProduct.title_fr,
      ar: dbProduct.title_ar,
    },
    description: {
      fr: dbProduct.description_fr || "",
      ar: dbProduct.description_ar || "",
    },
    price: dbProduct.price_dzd,
    compareAtPrice: dbProduct.compare_at_price_dzd || undefined,
    images: (dbProduct.product_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((img: any) => img.url),
    category: dbProduct.categories?.slug || "",
    subcategory: undefined, // TODO: handle subcategories
    department: dbProduct.departments?.slug || "",
    brand: dbProduct.brands?.name || "",
    rating: 4.5, // TODO: implement reviews
    reviewCount: 0, // TODO: implement reviews
    inStock: dbProduct.stock > 0,
    stockCount: dbProduct.stock,
    specs: (dbProduct.product_specs || []).reduce((acc: Record<string, string>, spec: any) => {
      acc[spec.key] = spec.value_fr // Use FR for now, client can handle locale later
      return acc
    }, {}),
    tags: [], // TODO: implement tags
    isNew: false, // TODO: implement based on created_at
    isBestSeller: false, // TODO: implement based on sales
    isDeal: dbProduct.compare_at_price_dzd ? true : false,
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let dbProduct: any = null
  try {
    dbProduct = await getProductBySlug(slug)
  } catch (error) {
    console.error("ProductPage getProductBySlug failed:", error)
    notFound()
  }
  if (!dbProduct) notFound()

  const product = transformProduct(dbProduct)

  return <ProductPageClient product={product} />
}
