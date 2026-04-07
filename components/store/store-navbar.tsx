"use client"

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Heart,
  Menu,
  Moon,
  Search,
  ShoppingCart,
  Sun,
  Dumbbell,
  User,
  X,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchDialog } from "./search-dialog"
import { useLocale } from "@/lib/locale-context"
import { useCart } from "@/lib/cart-store"
import { getCategories, getMegaMenuTaxonomy } from "@/app/(store)/actions"

interface MegaMenuSubcategory {
  id: string
  slug: string
  name_fr: string
  name_ar: string
}

interface MegaMenuCategory {
  id: string
  slug: string
  name_fr: string
  name_ar: string
  children: MegaMenuSubcategory[]
}

interface MegaMenuDepartment {
  id: string
  slug: string
  name_fr: string
  name_ar: string
  icon?: string | null
  categories: MegaMenuCategory[]
}

interface MobileNavCategory {
  id: string
  slug: string
  name_fr: string
  name_ar: string
  image?: string | null
}

function DeptIcon({ className }: { name?: string | null; slug?: string; className?: string }) {
  return <Dumbbell className={className} />
}

function labelByLocale(locale: "fr" | "ar", fr: string, ar: string) {
  return locale === "ar" ? ar : fr
}

export function StoreNavbar() {
  const { locale, setLocale, t } = useLocale()
  const { totalItems } = useCart()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [taxonomy, setTaxonomy] = useState<MegaMenuDepartment[]>([])
  const [taxonomyLoading, setTaxonomyLoading] = useState(true)
  const [activeDeptId, setActiveDeptId] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileCategories, setMobileCategories] = useState<MobileNavCategory[]>([])
  const [mobileCategoriesLoading, setMobileCategoriesLoading] = useState(true)

  const megaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let active = true

    async function loadTaxonomy() {
      setTaxonomyLoading(true)
      try {
        const rows = await getMegaMenuTaxonomy()
        if (!active) return
        const departments = Array.isArray(rows) ? rows : []
        setTaxonomy(departments)
        if (departments.length > 0) {
          setActiveDeptId((previous) => previous || departments[0].id)
        }
      } catch (error) {
        console.error("Failed to load mega menu taxonomy:", error)
        if (active) {
          setTaxonomy([])
        }
      } finally {
        if (active) {
          setTaxonomyLoading(false)
        }
      }
    }

    void loadTaxonomy()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadMobileCategories() {
      setMobileCategoriesLoading(true)
      try {
        const rows = await getCategories()
        if (!active) return

        const allCategories = (Array.isArray(rows) ? rows : [])
          .filter((category: any) => !category.parent_id)
          .map((category: any) => ({
            id: category.id,
            slug: category.slug,
            name_fr: category.name_fr,
            name_ar: category.name_ar,
            image: category.image_url || null,
          }))
          .filter((category: MobileNavCategory) => !!category.slug && !!category.name_fr && !!category.name_ar)

        setMobileCategories(allCategories)
      } catch (error) {
        console.error("Failed to load mobile categories:", error)
        if (active) {
          setMobileCategories([])
        }
      } finally {
        if (active) {
          setMobileCategoriesLoading(false)
        }
      }
    }

    void loadMobileCategories()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (megaRef.current && !megaRef.current.contains(event.target as Node)) {
        setMegaMenuOpen(false)
      }
    }

    if (megaMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [megaMenuOpen])

  const activeDepartment = useMemo(
    () => taxonomy.find((department) => department.id === activeDeptId) || null,
    [taxonomy, activeDeptId]
  )

  const openMegaMenu = () => {
    setMegaMenuOpen((previous) => !previous)
    if (!megaMenuOpen && taxonomy.length > 0) {
      setActiveDeptId(taxonomy[0].id)
    }
  }

  return (
    <>
      <div className="border-b border-border bg-muted/40 px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm">
          <div className="flex gap-4 text-muted-foreground">
            <a href="/contact" className="hover:text-foreground">
              {t.nav.contact}
            </a>
            <span className="hidden sm:inline">|</span>
            <a href="/support" className="hidden hover:text-foreground sm:inline">
              {t.nav.support}
            </a>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 gap-1.5 px-2"
            >
              {mounted ? (
                <>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span className="hidden text-xs sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
                </>
              ) : (
                <div className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocale(locale === "fr" ? "ar" : "fr")}
              className="h-8 gap-1.5 px-2"
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs">{locale === "fr" ? "العربية" : "FR"}</span>
            </Button>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md transition-colors duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="group flex shrink-0 items-center rounded-xl border border-border/70 bg-muted/25 px-2 py-1.5 transition-all duration-200 hover:border-primary/45 hover:bg-muted/45"
          >
            <div className="relative h-9 w-[118px] overflow-hidden rounded-md sm:h-10 sm:w-[132px]">
              <img
                src="/brand/logo.jpg"
                alt="Nutrition Store"
                width={180}
                height={56}
                className="h-full w-full scale-[1.35] object-contain object-center transition-transform duration-300 group-hover:scale-[1.38] dark:hidden"
              />
              <img
                src="/brand/logo.jpg"
                alt="Nutrition Store"
                width={180}
                height={56}
                className="hidden h-full w-full scale-[1.35] object-contain object-center transition-transform duration-300 group-hover:scale-[1.38] dark:block"
              />
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex">
            <div className="relative" ref={megaRef}>
              <button
                onClick={openMegaMenu}
                disabled={taxonomyLoading || taxonomy.length === 0}
                className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Menu className="h-4 w-4" />
                {t.nav.departments}
                <ChevronDown className={`h-4 w-4 transition-transform ${megaMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {megaMenuOpen && (
                <div className="absolute left-0 top-full mt-2 flex w-[860px] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  <div className="w-60 shrink-0 border-r border-border bg-muted/30 p-2">
                    {taxonomy.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">Aucun departement actif</p>
                    ) : (
                      taxonomy.map((department) => (
                        <Link
                          key={department.id}
                          href={`/shop?department=${encodeURIComponent(department.slug)}`}
                          onMouseEnter={() => setActiveDeptId(department.id)}
                          onClick={() => setMegaMenuOpen(false)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            activeDepartment?.id === department.id
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <DeptIcon name={department.icon} slug={department.slug} className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {labelByLocale(locale, department.name_fr, department.name_ar)}
                          </span>
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-40 rtl:rotate-180" />
                        </Link>
                      ))
                    )}
                  </div>

                  <div className="flex-1 p-4">
                    {activeDepartment ? (
                      <>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-foreground">
                            {labelByLocale(locale, activeDepartment.name_fr, activeDepartment.name_ar)}
                          </h3>
                          <Link
                            href={`/shop?department=${encodeURIComponent(activeDepartment.slug)}`}
                            onClick={() => setMegaMenuOpen(false)}
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            {t.sections.viewAll}
                            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                          </Link>
                        </div>

                        {activeDepartment.categories.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                            Aucune categorie active dans ce departement.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            {activeDepartment.categories.map((category) => (
                              <div key={category.id}>
                                <Link
                                  href={`/shop?department=${encodeURIComponent(activeDepartment.slug)}&category=${encodeURIComponent(category.slug)}`}
                                  onClick={() => setMegaMenuOpen(false)}
                                  className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                                >
                                  {labelByLocale(locale, category.name_fr, category.name_ar)}
                                </Link>
                                {category.children.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {category.children.map((subcategory) => (
                                      <Link
                                        key={subcategory.id}
                                        href={`/shop?department=${encodeURIComponent(activeDepartment.slug)}&category=${encodeURIComponent(category.slug)}&subcategory=${encodeURIComponent(subcategory.slug)}`}
                                        onClick={() => setMegaMenuOpen(false)}
                                        className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                      >
                                        {labelByLocale(locale, subcategory.name_fr, subcategory.name_ar)}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                        Selectionnez un departement.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link href="/shop" className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              {t.nav.shop}
            </Link>
            <Link href="/brands" className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              {t.nav.brands}
            </Link>
            <Link href="/promotions" className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              {t.nav.deals}
            </Link>
          </nav>

          <div className="flex max-w-md flex-1 items-center gap-2">
            <div className="relative hidden flex-1 sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t.nav.search} className="h-9 pl-9 text-sm" onClick={() => setSearchOpen(true)} readOnly />
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="sm:hidden">
              <Search className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
              <Link href="/account">
                <User className="h-5 w-5" />
                <span className="sr-only">{t.nav.account || "Account"}</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
              <Link href="/wishlist">
                <Heart className="h-5 w-5" />
                <span className="sr-only">{t.nav.wishlist}</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link href="/cart">
                <ShoppingCart className="h-5 w-5" />
                <span className="sr-only">{t.nav.cart}</span>
                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {totalItems}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => {
                setMobileOpen((previous) => !previous)
              }}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span className="sr-only">Menu</span>
            </Button>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ease-out lg:hidden ${
            mobileOpen
              ? "max-h-[85vh] border-t border-border bg-card opacity-100"
              : "pointer-events-none max-h-0 border-t border-transparent opacity-0"
          }`}
        >
          <div className="space-y-5 px-4 py-3">
            <Link
              href="/"
              className="mb-2 flex items-center justify-center rounded-xl border border-border/70 bg-muted/25 py-2"
              onClick={() => setMobileOpen(false)}
            >
              <div className="relative h-8 w-[112px] overflow-hidden rounded-md">
                <img
                  src="/brand/logo.jpg"
                  alt="Nutrition Store"
                  width={160}
                  height={50}
                  className="h-full w-full scale-[1.32] object-contain object-center dark:hidden"
                />
                <img
                  src="/brand/logo.jpg"
                  alt="Nutrition Store"
                  width={160}
                  height={50}
                  className="hidden h-full w-full scale-[1.32] object-contain object-center dark:block"
                />
              </div>
            </Link>

            <div>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Navigation
              </p>
              <div className="rounded-xl border border-border/80 bg-card/70">
                <Link
                  href="/shop"
                  className="block border-b border-border/70 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  {t.nav.shop}
                </Link>
                <Link
                  href="/brands"
                  className="block border-b border-border/70 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  {t.nav.brands}
                </Link>
                <Link
                  href="/promotions"
                  className="block px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  {t.nav.deals}
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {locale === "fr" ? "Categories" : "الفئات"}
              </p>
              <div className="rounded-xl border border-border/80 bg-card/70">
                {mobileCategoriesLoading ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    {locale === "fr" ? "Chargement des categories..." : "جاري تحميل الفئات..."}
                  </p>
                ) : mobileCategories.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    {locale === "fr" ? "Aucune categorie active" : "لا توجد فئات نشطة"}
                  </p>
                ) : (
                  mobileCategories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/category/${encodeURIComponent(category.slug)}`}
                      className="block border-b border-border/70 px-4 py-3 text-sm font-semibold text-foreground transition-colors last:border-b-0 hover:bg-primary/10 hover:text-primary"
                      onClick={() => setMobileOpen(false)}
                    >
                      {labelByLocale(locale, category.name_fr, category.name_ar)}
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/account"
                className="rounded-lg border border-border/80 px-3 py-2.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                onClick={() => setMobileOpen(false)}
              >
                {locale === "fr" ? "Mon Compte" : "حسابي"}
              </Link>
              <Link
                href="/wishlist"
                className="rounded-lg border border-border/80 px-3 py-2.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                onClick={() => setMobileOpen(false)}
              >
                {t.nav.wishlist}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}

