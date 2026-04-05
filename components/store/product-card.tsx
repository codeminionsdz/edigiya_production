"use client"

import Link from "next/link"
import Image from "next/image"
import { Heart, ShoppingCart, Star, Eye, Zap } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/locale-context"
import { useCart } from "@/lib/cart-store"
import type { Product } from "@/lib/data"
import { formatPrice } from "@/lib/data"

interface ProductCardProps {
  product: Product
  index?: number
}

function getBenefitLines(product: Product) {
  const text = `${product.name.fr} ${product.description.fr} ${product.tags.join(" ")}`.toLowerCase()

  if (text.includes("whey") || text.includes("protein")) {
    return ["Build Lean Muscle", "Speed Up Recovery"]
  }
  if (text.includes("creatine")) {
    return ["Increase Strength Output", "Recover Between Sets"]
  }
  if (text.includes("pre") || text.includes("workout")) {
    return ["Boost Energy & Focus", "Train Harder, Longer"]
  }
  if (text.includes("vitamin")) {
    return ["Support Daily Performance", "Improve Recovery Balance"]
  }

  return ["Trusted by Athletes", "Build Strength & Recovery"]
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { locale, t } = useLocale()
  const { addItem } = useCart()

  const discount = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0

  const savings = product.compareAtPrice ? product.compareAtPrice - product.price : 0
  const isLimitedStock = product.inStock && product.stockCount > 0 && product.stockCount <= 8
  const benefits = getBenefitLines(product)
  const trustRating = Number.isFinite(product.rating) && product.rating > 0 ? product.rating : 4.8
  const ctaLabel = product.isBestSeller ? "Buy Now" : "Add to Stack"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.05 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/70 hover:shadow-[0_22px_40px_-24px_rgba(255,214,0,0.65)]"
    >
      <div className="absolute start-3 top-3 z-10 flex flex-col gap-1.5">
        {product.isBestSeller && (
          <Badge className="border-0 bg-primary text-primary-foreground">
            Best Seller
          </Badge>
        )}
        {isLimitedStock && (
          <Badge className="border-0 bg-amber-500 text-black">
            Limited Stock
          </Badge>
        )}
        {discount > 0 && (
          <Badge className="border-0 bg-red-600 text-white">
            -{discount}%
          </Badge>
        )}
      </div>

      <div className="absolute end-3 top-3 z-10 flex flex-col gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-full bg-card/90 shadow-md backdrop-blur-sm hover:bg-card text-foreground"
          aria-label={t.nav.wishlist}
        >
          <Heart className="h-4 w-4" />
        </Button>
        <Link href={`/product/${product.slug}`}>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full bg-card/90 shadow-md backdrop-blur-sm hover:bg-card text-foreground"
            aria-label="View product"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <Link href={`/product/${product.slug}`} className="relative aspect-square overflow-hidden bg-muted p-6">
        {product.images && product.images.length > 0 ? (
          <Image
            src={product.images[0]}
            alt={product.name[locale]}
            fill
            className="object-contain transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10">
              <ShoppingCart className="h-8 w-8 text-primary/40" />
            </div>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {product.brand}
        </p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground transition-colors hover:text-primary">
            {product.name[locale]}
          </h3>
        </Link>

        <div className="mt-2 space-y-1">
          {benefits.slice(0, 2).map((benefit) => (
            <p key={benefit} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span>{benefit}</span>
            </p>
          ))}
        </div>

        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
          <span>{trustRating.toFixed(1)}</span>
          <span>Trusted by Athletes</span>
        </div>

        <div className="mt-3 flex items-end gap-2">
          <span className="text-2xl font-extrabold leading-none text-foreground">
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-sm font-medium text-muted-foreground line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>

        {discount > 0 && (
          <p className="mt-1 text-xs font-semibold text-red-500">
            Save {formatPrice(savings)}
          </p>
        )}

        <p className={`mt-1.5 text-xs font-medium ${product.inStock ? "text-green-500" : "text-red-500"}`}>
          {product.inStock ? t.sections.inStock : t.sections.outOfStock}
        </p>

        <Button
          onClick={() => addItem(product)}
          disabled={!product.inStock}
          className="mt-3 w-full gap-2 bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:-translate-y-0.5 hover:bg-[#E5C100] hover:shadow-lg hover:shadow-primary/40"
          size="sm"
        >
          <ShoppingCart className="h-4 w-4" />
          {ctaLabel}
        </Button>
      </div>
    </motion.div>
  )
}
