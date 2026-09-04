"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useLocale } from "@/lib/locale-context"
import { getHomePageBanners } from "@/app/(store)/actions"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type HeroBanner = {
  title_fr?: string | null
  title_ar?: string | null
  description_fr?: string | null
  description_ar?: string | null
  link_url?: string | null
}

export function HomeHeroText() {
  const { locale } = useLocale()
  const [banners, setBanners] = useState<HeroBanner[]>([])
  const [current, setCurrent] = useState(0)

  const isArabic = locale === "ar"

  useEffect(() => {
    let active = true

    async function loadBanners() {
      try {
        const data = await getHomePageBanners()
        if (!active) return
        if (Array.isArray(data) && data.length > 0) {
          setBanners(data)
        }
      } catch (error) {
        console.error("Failed to load homepage banners:", error)
      }
    }

    void loadBanners()
    return () => {
      active = false
    }
  }, [])

  // Auto-rotate banners every 6 seconds
  useEffect(() => {
    if (banners.length <= 1) return

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length)
    }, 6000)

    return () => clearInterval(timer)
  }, [banners.length])

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % (banners.length || 1))
  }, [banners.length])

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + (banners.length || 1)) % (banners.length || 1))
  }, [banners.length])

  const banner = banners[current]

  const getDefaultBanner = (): HeroBanner => ({
    title_fr: "Edigiya — des offres pensées pour vous",
    title_ar: "Edigiya – عروض تناسب احتياجاتك",
    description_fr: "Premium supplements, fast delivery, and trusted support for every athlete.",
    description_ar: "منتجات رياضية أصلية، احترافية، وتوصيل سريع لكل الولايات.",
  })

  const displayBanner = banner || getDefaultBanner()

  const title = isArabic
    ? displayBanner.title_ar || displayBanner.title_fr || getDefaultBanner().title_ar
    : displayBanner.title_fr || displayBanner.title_ar || getDefaultBanner().title_fr

  const description = isArabic
    ? displayBanner.description_ar || displayBanner.description_fr || getDefaultBanner().description_ar
    : displayBanner.description_fr || displayBanner.description_ar || getDefaultBanner().description_fr

  const cta = isArabic ? "تسوّق الآن" : "Shop now"
  const href = displayBanner.link_url?.trim() || "/shop"

  return (
    <section className="relative bg-slate-950 text-white overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300 sm:text-xl">
              {description}
            </p>
            <div className="mt-10 flex justify-center">
              <Link
                href={href}
                className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
              >
                {cta}
              </Link>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 justify-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="group relative"
              aria-label={`Banner ${i + 1}`}
            >
              <motion.div
                className="h-1.5 rounded-full transition-all duration-500 md:h-2"
                style={{
                  width: i === current ? "46px" : "12px",
                  backgroundColor: i === current ? "hsl(var(--primary))" : "rgba(255,255,255,0.42)",
                }}
                whileHover={{ width: "46px", backgroundColor: "hsl(var(--primary))" }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60 md:left-6"
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60 md:right-6"
            aria-label="Next banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </section>
  )
}
