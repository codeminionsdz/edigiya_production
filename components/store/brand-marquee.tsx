"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getBrands } from "@/app/(store)/actions"

type BrandItem = {
  id: string
  name: string
  slug: string
  logo_url?: string | null
}

const mockBrands: BrandItem[] = [
  { id: "mock-on", name: "Optimum Nutrition", slug: "optimum-nutrition", logo_url: "/brands/on.png" },
  { id: "mock-myprotein", name: "MyProtein", slug: "myprotein", logo_url: "/brands/myprotein.png" },
  { id: "mock-dymatize", name: "Dymatize", slug: "dymatize", logo_url: "/brands/dymatize.png" },
  { id: "mock-muscletech", name: "MuscleTech", slug: "muscletech", logo_url: "/brands/muscletech.png" },
]

function slugifyBrandName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export function BrandMarquee() {
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const [brands, setBrands] = useState<BrandItem[]>(mockBrands)
  const [isLoading, setIsLoading] = useState(true)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  useEffect(() => {
    let active = true

    async function loadBrands() {
      setIsLoading(true)
      try {
        const rows = await getBrands()
        if (!active) return

        const normalized = (Array.isArray(rows) ? rows : [])
          .filter((brand: any) => Boolean(brand?.id && brand?.name))
          .map((brand: any) => ({
            id: String(brand.id),
            name: String(brand.name),
            slug: String(brand.slug || slugifyBrandName(String(brand.name))),
            logo_url: brand.logo_url ? String(brand.logo_url) : null,
          }))

        if (normalized.length > 0) {
          setBrands(normalized)
        } else {
          setBrands(mockBrands)
        }
      } catch (error) {
        console.error("Failed to load brands:", error)
        if (active) {
          setBrands(mockBrands)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadBrands()

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
  }, [updateScrollState, brands.length, isLoading])

  const scrollByCard = (direction: "left" | "right") => {
    const el = carouselRef.current
    if (!el) return
    const amount = Math.round(el.clientWidth * 0.75)
    el.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    })
  }

  return (
    <section className="border-y border-border bg-card/70 py-12 sm:py-14" aria-label="Shop by supplement brands">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-5 flex items-end justify-between sm:mb-6">
          <div>
            <Badge className="border-0 bg-primary text-primary-foreground">Top Brands</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Shop by Brand
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Trusted supplement brands</p>
          </div>
          <Link href="/brands" className="hidden text-sm font-semibold text-primary hover:opacity-80 sm:inline-flex">
            View all brands
          </Link>
        </div>

        <div className="relative">
          <div
            ref={carouselRef}
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pr-8 [scroll-behavior:smooth] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
          >
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`brand-skeleton-${index}`}
                    className="h-24 min-w-[68%] animate-pulse snap-start rounded-2xl border border-border bg-muted/45 sm:min-w-[42%] lg:min-w-[240px]"
                  />
                ))
              : brands.map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/brand/${encodeURIComponent(brand.slug)}`}
                    className="group relative flex h-24 min-w-[68%] snap-start items-center justify-center rounded-2xl border border-border bg-background/60 px-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-[0_14px_34px_-22px_rgba(255,214,0,0.85)] sm:min-w-[42%] lg:min-w-[240px]"
                  >
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.name}
                        className="max-h-10 w-full object-contain grayscale brightness-75 opacity-85 transition-all duration-300 group-hover:grayscale-0 group-hover:brightness-100 group-hover:opacity-100 group-hover:scale-[1.03]"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none"
                        }}
                      />
                    ) : null}
                    <span className="absolute bottom-2.5 left-1/2 max-w-[85%] -translate-x-1/2 truncate text-xs font-semibold tracking-wide text-muted-foreground transition-colors group-hover:text-primary">
                      {brand.name}
                    </span>
                  </Link>
                ))}
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-14 bg-gradient-to-r from-card via-card/75 to-transparent sm:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-gradient-to-l from-card via-card/75 to-transparent sm:block" />

          <button
            type="button"
            onClick={() => scrollByCard("left")}
            disabled={isLoading || brands.length === 0 || !canScrollLeft}
            className="absolute left-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground backdrop-blur-md transition-all hover:border-primary/70 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 lg:flex"
            aria-label="Scroll brands left"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>

          <button
            type="button"
            onClick={() => scrollByCard("right")}
            disabled={isLoading || brands.length === 0 || !canScrollRight}
            className="absolute right-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground backdrop-blur-md transition-all hover:border-primary/70 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 lg:flex"
            aria-label="Scroll brands right"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>

        <Link href="/brands" className="mt-3 inline-flex text-sm font-semibold text-primary hover:opacity-80 sm:hidden">
          View all brands
        </Link>
      </div>
    </section>
  )
}
