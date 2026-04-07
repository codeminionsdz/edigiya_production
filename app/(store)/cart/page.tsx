"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useEffect, useState } from "react"
import { useLocale } from "@/lib/locale-context"
import { useCart } from "@/lib/cart-store"
import { formatPrice, type Product } from "@/lib/data"
import { getProducts } from "@/app/(store)/actions"
import { ProductCard } from "@/components/store/product-card"

function mapDbProductToUiProduct(dbProduct: any): Product {
  return {
    id: dbProduct.id,
    slug: dbProduct.slug,
    name: {
      fr: dbProduct.title_fr || dbProduct.name_fr || "",
      ar: dbProduct.title_ar || dbProduct.name_ar || dbProduct.title_fr || "",
    },
    description: {
      fr: dbProduct.description_fr || dbProduct.description || "",
      ar: dbProduct.description_ar || dbProduct.description || dbProduct.description_fr || "",
    },
    price: dbProduct.price_dzd || 0,
    compareAtPrice: dbProduct.compare_at_price_dzd || undefined,
    images: (dbProduct.product_images || []).map((image: any) => image.url).filter(Boolean),
    category: dbProduct.categories?.slug || dbProduct.category || "",
    department: dbProduct.departments?.slug || dbProduct.department || "",
    brand: dbProduct.brands?.name || dbProduct.brand || "",
    rating: 5,
    reviewCount: dbProduct.reviewCount || 0,
    inStock: (dbProduct.stock || 0) > 0,
    stockCount: dbProduct.stock || 0,
    specs: (dbProduct.product_specs || []).reduce((acc: Record<string, string>, spec: any) => {
      if (spec.key && spec.value_fr) acc[spec.key] = spec.value_fr
      return acc
    }, {}),
    tags: dbProduct.tags || [],
    isNew: Boolean(dbProduct.is_new),
    isBestSeller: Boolean(dbProduct.is_featured),
    isDeal: Boolean(dbProduct.compare_at_price_dzd && dbProduct.compare_at_price_dzd > dbProduct.price_dzd),
  }
}

export default function CartPage() {
  const { locale, t } = useLocale()
  const { items, removeItem, updateQuantity, totalPrice } = useCart()
  const [crossSell, setCrossSell] = useState<Product[]>([])

  useEffect(() => {
    let active = true

    async function loadCrossSell() {
      try {
        const result = await getProducts({ limit: 8 })
        const rows = (result?.products || []).map(mapDbProductToUiProduct)
        const filtered = rows
          .filter((p) => !items.some((item) => item.product.id === p.id) && p.inStock)
          .slice(0, 4)

        if (active) setCrossSell(filtered)
      } catch (error) {
        console.error("Failed to load cart cross-sell products:", error)
        if (active) setCrossSell([])
      }
    }

    void loadCrossSell()
    return () => {
      active = false
    }
  }, [items])

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-20">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="mt-6 font-heading text-2xl font-bold text-foreground">{t.cart.empty}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {locale === "fr" ? "Explorez notre boutique et trouvez ce qu'il vous faut." : "استكشف متجرنا وابحث عما تحتاجه."}
        </p>
        <Link href="/shop" className="mt-6">
          <Button className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            {t.cart.continueShopping}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-8 font-heading text-2xl font-bold text-foreground sm:text-3xl">{t.cart.title}</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card">
            {items.map((item, i) => (
              <motion.div
                key={item.product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex gap-4 p-4 ${i < items.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div className="flex flex-1 flex-col">
                  <Link href={`/product/${item.product.slug}`} className="text-sm font-semibold text-foreground hover:text-primary">
                    {item.product.name[locale]}
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.product.brand}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center rounded-md border border-border">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center text-foreground hover:bg-muted" aria-label="Decrease">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="flex h-8 w-8 items-center justify-center border-x border-border text-xs font-medium text-foreground">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center text-foreground hover:bg-muted" aria-label="Increase">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground">{formatPrice(item.product.price * item.quantity)}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.product.id)} aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <Link href="/shop" className="mt-4 inline-block">
            <Button variant="ghost" className="gap-1 text-primary">{t.cart.continueShopping}</Button>
          </Link>
        </div>

        {/* Summary */}
        <div>
          <div className="sticky top-24 rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-bold text-foreground">{t.cart.summary}</h2>
            <Separator className="my-4" />
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.cart.subtotal}</span>
                <span className="font-semibold text-foreground">{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.cart.shipping}</span>
                <span className="text-muted-foreground">{locale === "fr" ? "Calculee a la livraison" : "تحسب عند التوصيل"}</span>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between">
              <span className="font-heading text-lg font-bold text-foreground">{t.cart.total}</span>
              <span className="font-heading text-lg font-bold text-foreground">{formatPrice(totalPrice)}</span>
            </div>
            <Link href="/checkout" className="mt-6 block">
              <Button className="w-full gap-2" size="lg">
                {t.cart.checkout}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Cross-sell */}
      {crossSell.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-heading text-xl font-bold text-foreground">{t.cart.crossSell}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {crossSell.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
