"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import {
  Star, ShoppingCart, MessageCircle, Truck, Shield,
  ChevronRight, Minus, Plus, ShoppingBag, Link2, Share2, Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocale } from "@/lib/locale-context"
import { useCart } from "@/lib/cart-store"
import { getProducts } from "@/app/(store)/actions"
import { formatPrice, type Product } from "@/lib/data"
import { DEFAULT_STORE_SETTINGS, loadStoreSettings, toWhatsAppUrl } from "@/lib/store-settings"

function mapDbProductToUiProduct(dbProduct: any): Product {
  return {
    id: dbProduct.id,
    slug: dbProduct.slug,
    name: {
      fr: dbProduct.title_fr || "",
      ar: dbProduct.title_ar || dbProduct.title_fr || "",
    },
    description: {
      fr: dbProduct.description_fr || "",
      ar: dbProduct.description_ar || dbProduct.description_fr || "",
    },
    price: dbProduct.price_dzd || 0,
    compareAtPrice: dbProduct.compare_at_price_dzd || undefined,
    images: (dbProduct.product_images || []).map((image: any) => image.url).filter(Boolean),
    category: dbProduct.categories?.slug || "",
    department: dbProduct.departments?.slug || "",
    brand: dbProduct.brands?.name || "",
    rating: 5,
    reviewCount: 0,
    inStock: (dbProduct.stock || 0) > 0,
    stockCount: dbProduct.stock || 0,
    specs: {},
    tags: [],
    isNew: false,
    isBestSeller: Boolean(dbProduct.is_featured),
    isDeal: Boolean(dbProduct.compare_at_price_dzd && dbProduct.compare_at_price_dzd > dbProduct.price_dzd),
  }
}

export function ProductPageClient({ product }: { product: Product }) {
  const { locale, t } = useLocale()
  const { addItem } = useCart()
  const [qty, setQty] = useState(1)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [stackSuggestions, setStackSuggestions] = useState<Product[]>([])
  const [stackLoading, setStackLoading] = useState(true)
  const [stackAdded, setStackAdded] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    setSettings(loadStoreSettings())
  }, [])

  const discount = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0

  useEffect(() => {
    let active = true

    async function loadStackSuggestions() {
      setStackLoading(true)
      try {
        const result = await getProducts({ limit: 60 })
        if (!active) return

        const rows = (result?.products || []).map(mapDbProductToUiProduct)
        const candidates = rows.filter((p) => p.id !== product.id && p.inStock)
        const sameCategory = candidates.filter((p) => p.category === product.category)
        const sameDepartment = candidates.filter((p) => p.department === product.department)

        const merged = [...sameCategory, ...sameDepartment, ...candidates]
        const unique: Product[] = []
        const seen = new Set<string>()

        for (const item of merged) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          unique.push(item)
          if (unique.length >= 2) break
        }

        setStackSuggestions(unique)
      } catch (error) {
        console.error("Failed to load stack suggestions:", error)
        if (active) setStackSuggestions([])
      } finally {
        if (active) setStackLoading(false)
      }
    }

    void loadStackSuggestions()

    return () => {
      active = false
    }
  }, [product.id, product.category, product.department])

  const stackItems = useMemo(() => [product, ...stackSuggestions].slice(0, 3), [product, stackSuggestions])
  const stackBaseTotal = useMemo(
    () => stackItems.reduce((sum, item) => sum + item.price, 0),
    [stackItems]
  )
  const stackCompareTotal = useMemo(
    () => stackItems.reduce((sum, item) => sum + (item.compareAtPrice || item.price), 0),
    [stackItems]
  )
  const stackSavings = Math.max(0, stackCompareTotal - stackBaseTotal)

  const handleAddFullStack = () => {
    if (stackItems.length === 0) return
    stackItems.forEach((item) => addItem(item, 1))
    setStackAdded(true)
    window.setTimeout(() => setStackAdded(false), 1600)
  }

  const getShareUrl = () => {
    if (typeof window === "undefined") return ""
    return window.location.href || `${window.location.origin}/product/${product.slug}`
  }

  const handleCopyShareLink = async () => {
    const shareUrl = getShareUrl()
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1800)
    } catch (error) {
      console.error("Failed to copy share link:", error)
    }
  }

  const handleShareFacebook = () => {
    const shareUrl = getShareUrl()
    if (!shareUrl) return
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    window.open(facebookUrl, "_blank", "noopener,noreferrer")
  }

  const handleShareInstagram = async () => {
    await handleCopyShareLink()
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer")
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">{t.nav.home}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/shop" className="hover:text-primary">{t.nav.shop}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{product.name[locale]}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image Gallery */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-4"
        >
          {/* Main Image */}
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
            {product.images && product.images.length > 0 ? (
              <Image
                src={product.images[selectedImageIndex]}
                alt={product.name[locale]}
                fill
                className="object-contain p-8"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-primary/10">
                  <ShoppingBag className="h-16 w-16 text-primary/40" />
                </div>
              </div>
            )}
            {/* Badges */}
            <div className="absolute start-4 top-4 flex flex-col gap-2">
              {product.isNew && (
                <Badge className="bg-secondary text-secondary-foreground">{locale === "fr" ? "Nouveau" : "جديد"}</Badge>
              )}
              {discount > 0 && (
                <Badge className="bg-red-600 text-white">-{discount}%</Badge>
              )}
            </div>
          </div>
          
          {/* Thumbnail Images */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative aspect-square w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    selectedImageIndex === idx ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <Image
                    src={img}
                    alt={`${product.name[locale]} ${idx + 1}`}
                    fill
                    className="object-contain p-2"
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          <p className="text-sm font-medium uppercase tracking-wide text-primary">{product.brand}</p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {product.name[locale]}
          </h1>

          {/* Rating */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.floor(product.rating)
                      ? "fill-amber-400 text-amber-400"
                      : "fill-muted text-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-foreground">{product.rating}</span>
            <span className="text-sm text-muted-foreground">
              ({product.reviewCount} {t.product.reviews})
            </span>
          </div>

          {/* Price */}
          <div className="mt-4 flex items-end gap-3">
            <span className="font-heading text-3xl font-bold text-foreground">
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice && (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
            {discount > 0 && (
              <Badge className="border border-primary/40 bg-primary/10 text-primary">
                {locale === "fr" ? `Economisez ${formatPrice(product.compareAtPrice! - product.price)}` : `وفر ${formatPrice(product.compareAtPrice! - product.price)}`}
              </Badge>
            )}
          </div>

          {/* Stock */}
          <div className="mt-3">
            <span className={`text-sm font-medium ${product.inStock ? "text-green-600" : "text-red-500"}`}>
              {product.inStock ? `${t.sections.inStock} (${product.stockCount})` : t.sections.outOfStock}
            </span>
          </div>

          <Separator className="my-6" />

          <p className="text-sm leading-relaxed text-muted-foreground">
            {product.description[locale]}
          </p>

          {/* Purchase Panel */}
          <div className="mt-6 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {locale === "fr" ? "Quantite" : "\u0627\u0644\u0643\u0645\u064a\u0629"}
              </p>
              <span className={`text-xs font-semibold ${product.inStock ? "text-green-600" : "text-red-500"}`}>
                {product.inStock ? `${t.sections.inStock} (${product.stockCount})` : t.sections.outOfStock}
              </span>
            </div>

            <div className="mt-2 flex w-fit items-center rounded-xl border border-border/80 bg-background/40">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-muted"
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="flex h-11 w-12 items-center justify-center border-x border-border/80 text-sm font-semibold text-foreground">
                {qty}
              </span>
              <button
                onClick={() => setQty(qty + 1)}
                className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-muted"
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button
              onClick={() => addItem(product, qty)}
              disabled={!product.inStock}
              size="lg"
              className="mt-4 h-12 w-full gap-2 rounded-xl text-base font-semibold shadow-[0_12px_26px_-16px_rgba(255,214,0,0.95)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-15px_rgba(255,214,0,0.95)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShoppingCart className="h-4.5 w-4.5" />
              {t.sections.addToCart}
            </Button>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link href="/checkout" className="w-full">
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-11 w-full rounded-xl font-semibold"
                  onClick={() => addItem(product, qty)}
                >
                  {t.sections.buyNow}
                </Button>
              </Link>

              <a
                href={`${toWhatsAppUrl(settings.whatsapp)}?text=${encodeURIComponent(product.name.fr)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button
                  variant="outline"
                  className="h-11 w-full gap-2 rounded-xl border-green-600/70 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t.product.askWhatsApp}
                </Button>
              </a>
            </div>

            <div className="mt-4 border-t border-border/70 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {locale === "fr" ? "Partager" : "\u0645\u0634\u0627\u0631\u0643\u0629"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full px-3"
                  onClick={() => void handleCopyShareLink()}
                >
                  {shareCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {shareCopied
                    ? locale === "fr"
                      ? "Lien copie"
                      : "\u062a\u0645 \u0627\u0644\u0646\u0633\u062e"
                    : locale === "fr"
                      ? "Copier le lien"
                      : "\u0646\u0633\u062e \u0627\u0644\u0631\u0627\u0628\u0637"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border-[#1877F2]/35 px-3 text-[#1877F2] hover:bg-[#1877F2]/10"
                  onClick={handleShareFacebook}
                >
                  <Share2 className="h-4 w-4" />
                  Facebook
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border-pink-500/35 px-3 text-pink-500 hover:bg-pink-500/10"
                  onClick={() => void handleShareInstagram()}
                >
                  <Share2 className="h-4 w-4" />
                  Instagram
                </Button>
              </div>
            </div>
          </div>

          {/* Trust */}
          <div className="mt-4 grid gap-2 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2.5 text-sm text-foreground">
              <Truck className="h-4 w-4 text-primary" />
              {t.trust.delivery} - {t.trust.deliveryDesc}
            </div>
            <div className="flex items-center gap-2.5 text-sm text-foreground">
              <Shield className="h-4 w-4 text-primary" />
              {t.trust.warranty} - {t.trust.warrantyDesc}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recommended Stack */}
      {!stackLoading && stackItems.length >= 2 && (
        <section className="mt-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-bold text-foreground">
                {locale === "fr" ? "Recommended Stack" : "الباقة الموصى بها"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "fr"
                  ? "Frequently bought together for better results."
                  : "غالبا ما تُشترى معا لنتائج أفضل."}
              </p>
            </div>
            <Badge className="border border-primary/35 bg-primary/15 text-primary">
              {locale === "fr" ? "Save 10% when buying together" : "وفر 10% عند الشراء معا"}
            </Badge>
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-stretch">
            <div className="flex-1 overflow-x-auto pb-1">
              <div className="flex flex-col gap-3 sm:min-w-max sm:flex-row sm:items-center">
                {stackItems.map((item, index) => (
                  <div key={`stack-item-${item.id}-${index}`} className="flex items-center gap-3">
                    <Link
                      href={`/product/${item.slug}`}
                      className="group flex w-full sm:w-[220px] items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/45 hover:shadow-[0_14px_30px_-20px_rgba(255,214,0,0.9)]"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        {item.images?.[0] ? (
                          <Image
                            src={item.images[0]}
                            alt={item.name[locale]}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="56px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">
                          {item.name[locale]}
                        </p>
                        <p className="mt-1 text-sm font-bold text-primary">{formatPrice(item.price)}</p>
                      </div>
                    </Link>
                    {index < stackItems.length - 1 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-primary">
                        <Plus className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full rounded-xl border border-border bg-card p-4 lg:w-[290px]">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {locale === "fr" ? "Stack Total" : "إجمالي الباقة"}
              </p>
              <p className="mt-2 font-heading text-2xl font-bold text-foreground">
                {formatPrice(stackBaseTotal)}
              </p>
              {stackSavings > 0 && (
                <p className="mt-1 text-sm font-medium text-primary">
                  {locale === "fr" ? "You save" : "توفيرك"} {formatPrice(stackSavings)}
                </p>
              )}

              <Button
                onClick={handleAddFullStack}
                disabled={!product.inStock}
                className={`mt-4 w-full gap-2 transition-all ${stackAdded ? "shadow-[0_0_0_3px_rgba(255,214,0,0.25)]" : "hover:shadow-[0_14px_28px_-16px_rgba(255,214,0,0.95)]"}`}
                size="lg"
              >
                <ShoppingCart className="h-4.5 w-4.5" />
                {stackAdded
                  ? locale === "fr"
                    ? "Stack Added"
                    : "تمت إضافة الباقة"
                  : locale === "fr"
                    ? "Add Full Stack"
                    : "أضف الباقة كاملة"}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {locale === "fr"
                  ? "All selected products are added in one tap."
                  : "تتم إضافة كل المنتجات بضغطة واحدة."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Tabs */}
      <Tabs defaultValue="specs" className="mt-12">
        <TabsList className="bg-muted">
          <TabsTrigger value="specs">{t.product.specs}</TabsTrigger>
          <TabsTrigger value="description">{t.product.description}</TabsTrigger>
          <TabsTrigger value="reviews">{t.product.reviews} ({product.reviewCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="specs" className="mt-4">
          <div className="rounded-xl border border-border bg-card">
            {Object.entries(product.specs).map(([key, value], i) => (
              <div
                key={key}
                className={`flex items-center justify-between px-5 py-3 ${
                  i % 2 === 0 ? "bg-muted/50" : ""
                } ${i < Object.entries(product.specs).length - 1 ? "border-b border-border" : ""}`}
              >
                <span className="text-sm font-medium text-muted-foreground">{key}</span>
                <span className="text-sm font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="description" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description[locale]}
            </p>
          </div>
        </TabsContent>
        <TabsContent value="reviews" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {locale === "fr" ? "Les avis seront bientot disponibles." : "التقييمات ستكون متاحة قريبا."}
            </p>
            <Button className="mt-4" variant="outline">{t.product.writeReview}</Button>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  )
}
