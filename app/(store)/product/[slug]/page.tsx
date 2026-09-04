import { notFound } from "next/navigation"
import type { Metadata } from "next"
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
      if (spec.key && spec.value_fr) acc[spec.key] = spec.value_fr
      return acc
    }, {}),
    specsAr: (dbProduct.product_specs || []).reduce((acc: Record<string, string>, spec: any) => {
      if (spec.key && spec.value_ar) acc[spec.key] = spec.value_ar
      return acc
    }, {}),
    variants: (dbProduct.product_variants || []).map((variant: any) => ({ id: variant.id, name: variant.name || "", value: variant.value || "", priceDelta: Number(variant.price_delta_dzd || 0), stock: variant.stock == null ? null : Number(variant.stock) })),
    tags: [], // TODO: implement tags
    isNew: false, // TODO: implement based on created_at
    isBestSeller: false, // TODO: implement based on sales
    isDeal: Boolean(dbProduct.compare_at_price_dzd && dbProduct.compare_at_price_dzd > dbProduct.price_dzd),
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product: any = await getProductBySlug(slug).catch(() => null)
  if (!product) return { title: "Produit | Edigiya" }
  const title = product.title_fr || "Produit"
  const description = product.description_fr || `Découvrez ${title} chez Edigiya.`
  return { title: `${title} | Edigiya`, description, openGraph: { title, description, images: product.product_images?.[0]?.url ? [product.product_images[0].url] : undefined } }
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
