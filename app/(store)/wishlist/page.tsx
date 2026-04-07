"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, ShoppingCart, Trash2, Star, ShoppingBag } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/locale-context"
import { useCart } from "@/lib/cart-store"
import { products, formatPrice } from "@/lib/data"

export default function WishlistPage() {
  const { locale, t } = useLocale()
  const { addItem } = useCart()
  const [wishlistIds, setWishlistIds] = useState(["p1", "p3", "p6", "p9"])

  const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id))

  const removeFromWishlist = (id: string) => {
    setWishlistIds((prev) => prev.filter((wid) => wid !== id))
  }

  if (wishlistProducts.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-20">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
          <Heart className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="mt-6 font-heading text-2xl font-bold text-foreground">
          {locale === "fr" ? "Votre liste de favoris est vide" : "قائمة المفضلة فارغة"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {locale === "fr" ? "Ajoutez des produits a vos favoris pour les retrouver ici." : "اضف منتجات الى المفضلة لتجدها هنا."}
        </p>
        <Link href="/shop" className="mt-6">
          <Button className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            {locale === "fr" ? "Explorer la boutique" : "استكشاف المتجر"}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{t.nav.wishlist}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {wishlistProducts.length} {locale === "fr" ? "produits sauvegardes" : "منتجات محفوظة"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatePresence>
          {wishlistProducts.map((product) => {
            const discount = product.compareAtPrice
              ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
              : 0

            return (
              <motion.div
                key={product.id}
                layout
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card"
              >
                <button
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute end-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-red-500 shadow-md backdrop-blur-sm transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {discount > 0 && (
                  <div className="absolute start-3 top-3 z-10">
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">-{discount}%</span>
                  </div>
                )}

                <Link href={`/product/${product.slug}`} className="relative aspect-square overflow-hidden bg-muted p-6">
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10">
                      <ShoppingCart className="h-8 w-8 text-primary/40" />
                    </div>
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{product.brand}</p>
                  <Link href={`/product/${product.slug}`}>
                    <h3 className="mt-0.5 text-sm font-semibold text-foreground line-clamp-2 hover:text-primary">{product.name[locale]}</h3>
                  </Link>
                  <div className="mt-2 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`} />
                    ))}
                    <span className="ms-1 text-xs text-muted-foreground">({product.reviewCount})</span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-lg font-bold text-foreground">{formatPrice(product.price)}</span>
                    {product.compareAtPrice && (
                      <span className="text-sm text-muted-foreground line-through">{formatPrice(product.compareAtPrice)}</span>
                    )}
                  </div>
                  <Button onClick={() => addItem(product)} className="mt-3 w-full gap-2" size="sm">
                    <ShoppingCart className="h-4 w-4" />
                    {t.sections.addToCart}
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
