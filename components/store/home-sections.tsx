"use client"

import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Shield, Truck, Banknote, Headphones, Star, ArrowRight,
  Package, Send, MessageCircle, ChevronLeft, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductCard } from "./product-card"
import { useLocale } from "@/lib/locale-context"
import { collections, testimonials } from "@/lib/data"
import type { Product } from "@/lib/data"
import { getDepartments, getProducts } from "@/app/(store)/actions"
import { DEFAULT_STORE_SETTINGS, fetchStoreSettings, loadStoreSettings, toWhatsAppUrl } from "@/lib/store-settings"

type StoreDepartment = {
  id: string
  slug: string
  name_fr: string
  name_ar: string
  image_url?: string | null
}

export function DepartmentsGrid() {
  const { locale, t } = useLocale()
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const [departments, setDepartments] = useState<StoreDepartment[]>([])
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDepartments() {
      setIsLoadingDepartments(true)
      try {
        const rows = await getDepartments()
        if (!active) return

        const normalized = (Array.isArray(rows) ? rows : [])
          .filter((department: any) => Boolean(department?.id && department?.slug))
          .map((department: any) => ({
            id: String(department.id),
            slug: String(department.slug),
            name_fr: String(department.name_fr || ""),
            name_ar: String(department.name_ar || department.name_fr || ""),
            image_url: department.image_url ? String(department.image_url) : null,
          }))

        setDepartments(normalized)
      } catch (error) {
        console.error("Failed to load departments:", error)
        if (active) {
          setDepartments([])
        }
      } finally {
        if (active) {
          setIsLoadingDepartments(false)
        }
      }
    }

    void loadDepartments()

    return () => {
      active = false
    }
  }, [])

  const updateScrollState = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < maxScroll - 4)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = carouselRef.current
    if (!el) return

    const onScroll = () => updateScrollState()
    const onResize = () => updateScrollState()

    el.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)

    return () => {
      el.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [updateScrollState, departments.length, isLoadingDepartments])

  const scrollByCard = (direction: "left" | "right") => {
    const el = carouselRef.current
    if (!el) return
    const amount = Math.round(el.clientWidth * 0.82)
    el.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    })
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:py-16">
      <div className="mb-6 flex items-end justify-between sm:mb-8">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {t.sections.departments}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === "fr" ? "Supplements premium pour chaque objectif fitness" : "تصفح فئاتنا"}
          </p>
        </div>
        <Link href="/shop" className="hidden sm:inline-flex">
          <Button variant="ghost" className="gap-1 text-primary">
            {t.sections.viewAll}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="relative">
        <div
          ref={carouselRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 pr-8 [scroll-behavior:smooth] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
        >
          {isLoadingDepartments
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`department-skeleton-${i}`}
                  className="h-44 min-w-[74%] animate-pulse snap-start rounded-[1.75rem] border border-border bg-muted/45 sm:h-52 sm:min-w-[44%] lg:h-60 lg:min-w-[30%] xl:min-w-[280px]"
                />
              ))
            : departments.map((department, i) => {
                const title = locale === "ar" ? department.name_ar || department.name_fr : department.name_fr || department.name_ar
                const hasImage = Boolean(department.image_url)

                return (
                  <motion.div
                    key={department.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.06 }}
                    className="group relative h-44 min-w-[74%] snap-start overflow-hidden rounded-[1.75rem] border border-border sm:h-52 sm:min-w-[44%] lg:h-60 lg:min-w-[30%] xl:min-w-[280px]"
                  >
                    <Link
                      href={`/department/${encodeURIComponent(department.slug)}`}
                      className="absolute inset-0"
                      aria-label={title}
                    >
                      {hasImage ? (
                        <img
                          src={department.image_url || ""}
                          alt={title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,214,0,0.28),transparent_38%),linear-gradient(135deg,rgba(38,38,38,1)_0%,rgba(20,20,20,1)_100%)]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/68" />
                      <div className="absolute inset-0 ring-1 ring-inset ring-white/15 transition-all duration-300 group-hover:ring-primary/70 group-hover:shadow-[0_18px_38px_-22px_rgba(255,214,0,0.8)]" />

                      <div className="absolute inset-0 flex items-center justify-center p-5 text-center">
                        <h3 className="font-heading text-xl font-bold tracking-tight text-white transition-colors duration-300 group-hover:text-primary sm:text-2xl">
                          {title}
                        </h3>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
        </div>

        {!isLoadingDepartments && departments.length === 0 && (
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/70 p-6 text-center text-sm text-muted-foreground">
            {locale === "fr" ? "Aucun departement actif pour le moment." : "لا توجد اقسام مفعلة حاليا."}
          </div>
        )}

        {/* Cinematic gradient edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-14 bg-gradient-to-r from-background via-background/75 to-transparent sm:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-gradient-to-l from-background via-background/75 to-transparent sm:block" />

        {/* Desktop arrows */}
        <button
          type="button"
          onClick={() => scrollByCard("left")}
          disabled={isLoadingDepartments || departments.length === 0 || !canScrollLeft}
          className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-md backdrop-blur-md transition-all hover:border-primary/70 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 lg:flex"
          aria-label="Scroll categories left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard("right")}
          disabled={isLoadingDepartments || departments.length === 0 || !canScrollRight}
          className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-md backdrop-blur-md transition-all hover:border-primary/70 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 lg:flex"
          aria-label="Scroll categories right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  )
}

export function CollectionsSection() {
  const { locale, t } = useLocale()

  return (
    <section className="bg-muted/50 py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {t.sections.collections}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === "fr" ? "Des packs penses pour chaque besoin" : "حزم مصممة لكل حاجة"}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {collections.map((col, i) => (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <Link
                href={`/shop?collection=${col.slug}`}
                className="group relative flex flex-col items-center overflow-hidden rounded-xl border border-border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${col.color} text-white shadow-lg`}>
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {col.name[locale]}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {col.description[locale]}
                </p>
                <span className="mt-3 text-xs font-medium text-primary">
                  {col.productCount} {locale === "fr" ? "produits" : "منتج"}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FeaturedProducts() {
  const { locale, t } = useLocale()
  const [tab, setTab] = useState("bestSellers")
  const [products, setProducts] = useState<Array<Product & { created_at?: string }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadProducts() {
      setIsLoading(true)
      try {
        const result = await getProducts({ limit: 12 })
        if (!active) return
        const normalized = (result?.products || []).map((product: any) => ({
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
          inStock: product.inventory_type === "unlimited" || (product.stock || 0) > 0,
          stockCount: product.stock || 0,
          specs: {},
          tags: [],
          isNew: false,
          isBestSeller: Boolean(product.is_featured),
          isDeal: Boolean(product.compare_at_price_dzd && product.compare_at_price_dzd > product.price_dzd),
          created_at: product.created_at,
        }))
        setProducts(normalized)
      } catch (error) {
        console.error("Failed to load featured products:", error)
        if (active) setProducts([])
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadProducts()

    return () => {
      active = false
    }
  }, [])

  const latestProducts = useMemo(
    () =>
      [...products].sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      ),
    [products]
  )

  const filtered = {
    bestSellers: products.filter((p) => p.isBestSeller),
    new: latestProducts,
    deals: products.filter((p) => p.isDeal),
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {t.sections.featured}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === "fr" ? "Notre sélection pour vous" : "اختيارنا لك"}
          </p>
        </div>
        <Link href="/shop">
          <Button variant="ghost" className="gap-1 text-primary">
            {t.sections.viewAll}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-6 inline-flex h-auto gap-2 rounded-full bg-[#edf2ed] p-1.5">
          <TabsTrigger value="bestSellers" className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-[#14235d] data-[state=active]:text-white">
            {t.sections.bestSellers}
          </TabsTrigger>
          <TabsTrigger value="new" className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-[#14235d] data-[state=active]:text-white">
            {t.sections.newArrivals}
          </TabsTrigger>
          <TabsTrigger value="deals" className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-[#14235d] data-[state=active]:text-white">
            {t.sections.deals}
          </TabsTrigger>
        </TabsList>

        {(Object.keys(filtered) as Array<keyof typeof filtered>).map((key) => (
          <TabsContent key={key} value={key} className="mt-0">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`product-skeleton-${key}-${i}`} className="h-72 animate-pulse rounded-[1.5rem] border border-[#dfe6e0] bg-[#f3f7f2]" />
                ))}
              </div>
            ) : filtered[key].length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {filtered[key].map((product, i) => (
                  <div key={product.id} className="group overflow-hidden rounded-[1.6rem] border border-[#dfe6e0] bg-white shadow-[0_10px_30px_rgba(20,35,93,0.04)] transition duration-300 hover:-translate-y-1 hover:border-[#2daa22]/50 hover:shadow-[0_18px_40px_rgba(20,35,93,0.10)] dark:border-white/10 dark:bg-white/[.04]">
                    {(() => {
                      const displayPrice = typeof product.price === "number" ? product.price : 0
                      const hasComparePrice = typeof product.compareAtPrice === "number" && product.compareAtPrice > displayPrice

                      return (
                        <>
                          <div className="relative overflow-hidden bg-[#eef4ef]">
                            <Link href={`/product/${product.slug}`} className="block">
                              <div className="relative aspect-[1.08] overflow-hidden">
                                {product.images?.[0] ? (
                                  <img
                                    src={product.images[0]}
                                    alt={product.name[locale] || product.name.fr}
                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(118,168,126,0.22),transparent_38%),linear-gradient(135deg,#edf6ee_0%,#dfeee1_100%)]">
                                    <span className="text-3xl font-black text-[#14235d]/20">E</span>
                                  </div>
                                )}

                                {product.isDeal && (
                                  <span className="absolute left-3 top-3 rounded-full bg-[#f04d4d] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                                    {locale === "fr" ? "Promo" : "عرض"}
                                  </span>
                                )}

                                {product.isBestSeller && (
                                  <span className="absolute right-3 top-3 rounded-full bg-[#14235d] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                                    {locale === "fr" ? "Top" : "مميز"}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </div>

                          <div className="space-y-3 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2daa22]">
                                {product.brand || (locale === "fr" ? "Edigiya" : "إديجيا")}
                              </span>
                              <span className="text-[10px] font-medium text-[#536078] dark:text-[#b8c0d0]">
                                {product.stockCount > 0 ? (locale === "fr" ? "En stock" : "متوفر") : (locale === "fr" ? "Épuisé" : "غير متوفر")}
                              </span>
                            </div>

                            <Link href={`/product/${product.slug}`} className="block">
                              <h3 className="line-clamp-2 min-h-[3rem] text-base font-bold leading-5 text-[#14235d] transition hover:text-[#2daa22] dark:text-white">
                                {product.name[locale] || product.name.fr}
                              </h3>
                            </Link>

                            <p className="line-clamp-2 text-xs leading-5 text-[#536078] dark:text-[#b8c0d0]">
                              {product.description[locale] || product.description.fr}
                            </p>

                            <div className="flex items-end justify-between gap-3 pt-1">
                              <div>
                                <p className="text-xl font-black tracking-[-0.04em] text-[#14235d] dark:text-white">
                                  {new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(displayPrice)} DA
                                </p>
                                {hasComparePrice && (
                                  <p className="text-xs text-[#7a8496] line-through">
                                    {new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(product.compareAtPrice ?? 0)} DA
                                  </p>
                                )}
                              </div>

                              <Link
                                href={`/product/${product.slug}`}
                                className="inline-flex items-center justify-center rounded-full bg-[#14235d] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#24366f]"
                              >
                                {locale === "fr" ? "Voir" : "عرض"}
                              </Link>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                {locale === "fr" ? "Aucun produit pour le moment" : "لا توجد منتجات حاليا"}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}

export function TrustSection() {
  const { t } = useLocale()
  const items = [
    { icon: Shield, title: t.trust.warranty, desc: t.trust.warrantyDesc },
    { icon: Truck, title: t.trust.delivery, desc: t.trust.deliveryDesc },
    { icon: Banknote, title: t.trust.cod, desc: t.trust.codDesc },
    { icon: Headphones, title: t.trust.support, desc: t.trust.supportDesc },
  ]

  return (
    <section className="border-y border-border bg-card py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="flex items-start gap-4"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TestimonialsSection() {
  const { locale, t } = useLocale()

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          {t.sections.testimonials}
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.slice(0, 3).map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-3 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star
                  key={j}
                  className={`h-4 w-4 ${
                    j < item.rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
                  }`}
                />
              ))}
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {`"${item.text[locale]}"`}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {item.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.city}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export function NewsletterSection() {
  const { locale, t } = useLocale()
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS)

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        const settings = await fetchStoreSettings()
        if (active) setSettings(settings)
      } catch (error) {
        console.error('Failed to load store settings:', error)
        if (active) setSettings(loadStoreSettings())
      }
    }

    void loadSettings()

    return () => {
      active = false
    }
  }, [])

  return (
    <section className="bg-gradient-to-b from-[#F5D93A] to-[#E8C500] text-[#111111]">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-16 md:flex-row md:justify-between">
        <div className="text-center md:text-start">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">{t.sections.newsletter}</h2>
          <p className="mt-2 text-sm text-[#2B2B2B]/85">{t.sections.newsletterSub}</p>
        </div>
        <div className="flex w-full max-w-md gap-2">
          <Input
            type="email"
            placeholder={t.sections.emailPlaceholder}
            className="border-black/15 bg-white/92 text-[#111111] placeholder:text-[#555555] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
          />
          <Button
            variant="secondary"
            className="shrink-0 gap-1.5 border-black/20 bg-white text-[#111111] hover:bg-black hover:text-white"
          >
            <Send className="h-4 w-4" />
            {t.sections.subscribe}
          </Button>
        </div>
      </div>
      {/* WhatsApp CTA */}
      <div className="border-t border-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-4">
          <MessageCircle className="h-5 w-5 text-[#111111]/75" />
          <a
            href={toWhatsAppUrl(settings.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#111111] hover:underline"
          >
            {t.sections.whatsappCta}
          </a>
        </div>
      </div>
    </section>
  )
}
