"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowUp, ArrowDown, CheckCircle2, Loader2, Plus, Save, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CategoryPicker } from "./category-picker"
import { useToast } from "@/components/ui/use-toast"
import {
  adminCheckProductSlug,
  adminCreateProduct,
  adminGetBrands,
  adminGetDepartments,
  adminGetProductById,
  adminHasProductSeoColumns,
  adminHasProductVariantsTable,
  adminUpdateProduct,
  adminUploadProductImage,
} from "@/app/admin/actions"

type ProductEditorMode = "create" | "edit"

interface ProductEditorProps {
  mode: ProductEditorMode
  productId?: string
}

interface DepartmentOption {
  id: string
  slug: string
  name_fr: string
  name_ar: string
}

interface BrandOption {
  id: string
  name: string
}

interface SpecItem {
  id: string
  key: string
  value_fr: string
  value_ar: string
  sort_order: number
}

interface ImageItem {
  id: string
  url: string
  alt_fr: string
  alt_ar: string
  sort_order: number
  is_primary: boolean
}

interface VariantItem {
  id: string
  name: string
  value: string
  price_delta_dzd: string
  stock: string
}

interface ProductFormState {
  title_fr: string
  title_ar: string
  description_fr: string
  description_ar: string
  slug: string
  brand_id: string
  department_id: string
  category_id: string | null
  is_active: boolean
  is_featured: boolean
  price_dzd: string
  compare_at_price_dzd: string
  sku: string
  stock: string
  specs: SpecItem[]
  images: ImageItem[]
  variants: VariantItem[]
  seo: {
    meta_title_fr: string
    meta_title_ar: string
    meta_description_fr: string
    meta_description_ar: string
  }
}

type FormErrors = Record<string, string>

const FIELD_TO_TAB = {
  title_fr: "general",
  title_ar: "general",
  slug: "general",
  department_id: "general",
  category_id: "general",
  price_dzd: "pricing",
  stock: "inventory",
} as const

function createId(prefix = "row") {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function parseNumber(value: string) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : NaN
}

function sortByOrder<T extends { sort_order?: number }>(rows: T[]) {
  return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

function createInitialState(): ProductFormState {
  return {
    title_fr: "",
    title_ar: "",
    description_fr: "",
    description_ar: "",
    slug: "",
    brand_id: "",
    department_id: "",
    category_id: null,
    is_active: true,
    is_featured: false,
    price_dzd: "",
    compare_at_price_dzd: "",
    sku: "",
    stock: "0",
    specs: [],
    images: [],
    variants: [],
    seo: {
      meta_title_fr: "",
      meta_title_ar: "",
      meta_description_fr: "",
      meta_description_ar: "",
    },
  }
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function ProductEditor({ mode, productId }: ProductEditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [form, setForm] = useState<ProductFormState>(() => createInitialState())
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [variantsSupported, setVariantsSupported] = useState(true)
  const [seoSupported, setSeoSupported] = useState<boolean | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [activeTab, setActiveTab] = useState("general")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "taken" | "available">("idle")
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null)
  const hasManuallyEditedSlugRef = useRef(false)
  const hasShownCreatedToastRef = useRef(false)

  const title = mode === "create" ? "Nouveau produit" : "Modifier le produit"
  const submitLabel = mode === "create" ? "Creer le produit" : "Enregistrer les modifications"

  const inStock = useMemo(() => {
    const parsedStock = parseNumber(form.stock)
    return Number.isFinite(parsedStock) && parsedStock > 0
  }, [form.stock])

  const setField = <K extends keyof ProductFormState>(field: K, value: ProductFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field as string]) return prev
      const next = { ...prev }
      delete next[field as string]
      return next
    })
  }

  const handleCategoryChange = useCallback((categoryId: string | null) => {
    setForm((prev) => ({ ...prev, category_id: categoryId }))
    setErrors((prev) => {
      if (!prev.category_id) return prev
      const next = { ...prev }
      delete next.category_id
      return next
    })
  }, [])

  const normalizeSpecRows = (rows: SpecItem[]) =>
    sortByOrder(rows).map((spec, index) => ({
      id: spec.id || createId("spec"),
      key: spec.key || "",
      value_fr: spec.value_fr || "",
      value_ar: spec.value_ar || "",
      sort_order: spec.sort_order ?? index,
    }))

  const normalizeImageRows = (rows: ImageItem[]) =>
    sortByOrder(rows).map((image, index) => ({
      id: image.id || createId("img"),
      url: image.url || "",
      alt_fr: image.alt_fr || "",
      alt_ar: image.alt_ar || "",
      sort_order: image.sort_order ?? index,
      is_primary: index === 0,
    }))

  const normalizeVariantRows = (rows: VariantItem[]) =>
    rows.map((variant) => ({
      id: variant.id || createId("var"),
      name: variant.name || "",
      value: variant.value || "",
      price_delta_dzd: variant.price_delta_dzd || "0",
      stock: variant.stock || "0",
    }))

  useEffect(() => {
    async function loadEditor() {
      setIsLoading(true)
      try {
        const [departmentRows, brandRows, hasVariants, hasSeo] = await Promise.all([
          adminGetDepartments(),
          adminGetBrands(),
          adminHasProductVariantsTable(),
          adminHasProductSeoColumns(),
        ])

        setDepartments(Array.isArray(departmentRows) ? departmentRows : [])
        setBrands(Array.isArray(brandRows) ? brandRows : [])
        setVariantsSupported(Boolean(hasVariants))
        setSeoSupported(Boolean(hasSeo))

        if (mode === "edit") {
          if (!productId) throw new Error("ID produit manquant.")

          const productResult = await adminGetProductById(productId)
          if (!productResult || (typeof productResult === "object" && "error" in productResult)) {
            throw new Error("Produit introuvable.")
          }
          const product = productResult as any

          setForm({
            title_fr: product.title_fr || "",
            title_ar: product.title_ar || "",
            description_fr: product.description_fr || "",
            description_ar: product.description_ar || "",
            slug: product.slug || "",
            brand_id: product.brand_id || "",
            department_id: product.department_id || "",
            category_id: product.category_id || null,
            is_active: Boolean(product.is_active),
            is_featured: Boolean(product.is_featured),
            price_dzd: product.price_dzd === null || product.price_dzd === undefined ? "" : String(product.price_dzd),
            compare_at_price_dzd:
              product.compare_at_price_dzd === null || product.compare_at_price_dzd === undefined
                ? ""
                : String(product.compare_at_price_dzd),
            sku: product.sku || "",
            stock: product.stock === null || product.stock === undefined ? "0" : String(product.stock),
            specs: normalizeSpecRows(product.product_specs || []),
            images: normalizeImageRows(product.product_images || []),
            variants: normalizeVariantRows(product.product_variants || []),
            seo: {
              meta_title_fr: product.meta_title_fr || "",
              meta_title_ar: product.meta_title_ar || "",
              meta_description_fr: product.meta_description_fr || "",
              meta_description_ar: product.meta_description_ar || "",
            },
          })
        }
      } catch (error: any) {
        console.error("Failed to load product editor:", error)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: error?.message || "Impossible de charger le formulaire produit.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    void loadEditor()
  }, [mode, productId, toast])

  useEffect(() => {
    if (mode !== "edit" || !productId) return
    if (searchParams.get("created") !== "1") return
    if (hasShownCreatedToastRef.current) return

    hasShownCreatedToastRef.current = true
    toast({
      title: "Produit cree",
      description: "Le produit a bien ete cree. Vous pouvez continuer l'edition.",
    })
    router.replace(`/admin/products/${productId}/edit`)
  }, [mode, productId, router, searchParams, toast])

  const validate = () => {
    const nextErrors: FormErrors = {}
    if (!form.title_fr.trim()) nextErrors.title_fr = "Le titre FR est requis."
    if (!form.department_id) nextErrors.department_id = "Le departement est requis."
    if (!form.category_id) nextErrors.category_id = "La categorie est requise."

    setErrors(nextErrors)
    const firstField = Object.keys(nextErrors)[0]
    if (firstField && firstField in FIELD_TO_TAB) {
      setActiveTab(FIELD_TO_TAB[firstField as keyof typeof FIELD_TO_TAB])
    }

    return Object.keys(nextErrors).length === 0
  }

  const handleSlugBlur = async () => {
    const normalizedSlug = toSlug(form.slug)
    if (!normalizedSlug) return
    setSlugStatus("checking")
    try {
      const result = await adminCheckProductSlug(normalizedSlug, mode === "edit" ? productId : undefined)
      if (result && typeof result === "object" && "exists" in result) {
        setSlugStatus(result.exists ? "taken" : "available")
      } else {
        setSlugStatus("idle")
      }
    } catch (error) {
      console.error("Slug check failed:", error)
      setSlugStatus("idle")
    }
  }

  const handleUploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    setIsUploadingImages(true)
    const uploaded: ImageItem[] = []
    let failedCount = 0

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        const result = await adminUploadProductImage(formData)

        if (result && typeof result === "object" && "error" in result) {
          failedCount += 1
          continue
        }

        if (result && typeof result === "object" && "url" in result) {
          uploaded.push({
            id: createId("img"),
            url: String(result.url),
            alt_fr: "",
            alt_ar: "",
            sort_order: 0,
            is_primary: false,
          })
        } else {
          failedCount += 1
        }
      }

      if (uploaded.length > 0) {
        setForm((prev) => {
          const merged = [...prev.images, ...uploaded].map((image, index) => ({
            ...image,
            sort_order: index,
          }))
          if (!merged.some((image) => image.is_primary) && merged.length > 0) {
            merged[0] = { ...merged[0], is_primary: true }
          }
          return { ...prev, images: merged }
        })
      }

      if (uploaded.length > 0) {
        toast({
          title: "Images ajoutees",
          description: `${uploaded.length} image(s) telechargee(s).`,
        })
      }

      if (failedCount > 0) {
        toast({
          variant: "destructive",
          title: "Upload incomplet",
          description: `${failedCount} image(s) n'ont pas pu etre telechargees.`,
        })
      }
    } finally {
      event.target.value = ""
      setIsUploadingImages(false)
    }
  }

  const addSpecRow = () => {
    setForm((prev) => ({
      ...prev,
      specs: [
        ...prev.specs,
        { id: createId("spec"), key: "", value_fr: "", value_ar: "", sort_order: prev.specs.length },
      ],
    }))
  }

  const updateSpecRow = (id: string, patch: Partial<SpecItem>) => {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.map((spec) => (spec.id === id ? { ...spec, ...patch } : spec)),
    }))
  }

  const moveSpecRow = (id: string, direction: "up" | "down") => {
    setForm((prev) => {
      const index = prev.specs.findIndex((spec) => spec.id === id)
      if (index < 0) return prev
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.specs.length) return prev
      const reordered = moveItem(prev.specs, index, targetIndex).map((spec, rowIndex) => ({
        ...spec,
        sort_order: rowIndex,
      }))
      return { ...prev, specs: reordered }
    })
  }

  const removeSpecRow = (id: string) => {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.filter((spec) => spec.id !== id).map((spec, index) => ({ ...spec, sort_order: index })),
    }))
  }

  const addVariantRow = () => {
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { id: createId("var"), name: "", value: "", price_delta_dzd: "0", stock: "0" }],
    }))
  }

  const updateVariantRow = (id: string, patch: Partial<VariantItem>) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)),
    }))
  }

  const moveVariantRow = (id: string, direction: "up" | "down") => {
    setForm((prev) => {
      const index = prev.variants.findIndex((variant) => variant.id === id)
      if (index < 0) return prev
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.variants.length) return prev
      return { ...prev, variants: moveItem(prev.variants, index, targetIndex) }
    })
  }

  const removeVariantRow = (id: string) => {
    setForm((prev) => ({ ...prev, variants: prev.variants.filter((variant) => variant.id !== id) }))
  }

  const setPrimaryImage = (id: string) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((image) => ({ ...image, is_primary: image.id === id })),
    }))
  }

  const updateImage = (id: string, patch: Partial<ImageItem>) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((image) => (image.id === id ? { ...image, ...patch } : image)),
    }))
  }

  const removeImage = (id: string) => {
    setForm((prev) => {
      const next = prev.images.filter((image) => image.id !== id).map((image, index) => ({
        ...image,
        sort_order: index,
      }))
      if (!next.some((image) => image.is_primary) && next.length > 0) {
        next[0] = { ...next[0], is_primary: true }
      }
      return { ...prev, images: next }
    })
  }

  const handleImageDrop = (targetId: string) => {
    if (!draggedImageId || draggedImageId === targetId) return
    setForm((prev) => {
      const fromIndex = prev.images.findIndex((image) => image.id === draggedImageId)
      const toIndex = prev.images.findIndex((image) => image.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return prev
      const reordered = moveItem(prev.images, fromIndex, toIndex).map((image, index) => ({
        ...image,
        sort_order: index,
      }))
      return { ...prev, images: reordered }
    })
    setDraggedImageId(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const orderedImages = [...form.images]
      const primaryIndex = orderedImages.findIndex((image) => image.is_primary)
      if (primaryIndex > 0) {
        const [primary] = orderedImages.splice(primaryIndex, 1)
        orderedImages.unshift(primary)
      }

      const normalizedTitleFr = form.title_fr.trim()
      const normalizedTitleAr = form.title_ar.trim() || normalizedTitleFr
      const normalizedSlug = toSlug(form.slug || normalizedTitleFr)
      const priceValue = parseNumber(form.price_dzd)
      const stockValue = parseNumber(form.stock)
      const compareAtValue = parseNumber(form.compare_at_price_dzd)

      const payload = {
        slug: normalizedSlug,
        title_fr: normalizedTitleFr,
        title_ar: normalizedTitleAr,
        description_fr: form.description_fr.trim(),
        description_ar: form.description_ar.trim(),
        brand_id: form.brand_id || undefined,
        department_id: form.department_id,
        category_id: form.category_id!,
        price_dzd: Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : 0,
        compare_at_price_dzd:
          Number.isFinite(compareAtValue) && compareAtValue >= 0 ? compareAtValue : undefined,
        sku: form.sku.trim() || undefined,
        stock: Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : 0,
        is_featured: form.is_featured,
        is_active: form.is_active,
        specs: form.specs
          .filter((spec) => spec.key.trim().length > 0)
          .map((spec, index) => ({
            key: spec.key.trim(),
            value_fr: spec.value_fr.trim(),
            value_ar: spec.value_ar.trim(),
            sort_order: index,
          })),
        images: orderedImages.map((image, index) => ({
          url: image.url,
          alt_fr: image.alt_fr.trim(),
          alt_ar: image.alt_ar.trim(),
          sort_order: index,
        })),
        variants: form.variants
          .filter((variant) => variant.name.trim().length > 0 && variant.value.trim().length > 0)
          .map((variant) => ({
            name: variant.name.trim(),
            value: variant.value.trim(),
            price_delta_dzd: parseNumber(variant.price_delta_dzd) || 0,
            stock: parseNumber(variant.stock) || 0,
          })),
        seo: {
          meta_title_fr: form.seo.meta_title_fr.trim(),
          meta_title_ar: form.seo.meta_title_ar.trim(),
          meta_description_fr: form.seo.meta_description_fr.trim(),
          meta_description_ar: form.seo.meta_description_ar.trim(),
        },
      }

      const result =
        mode === "create"
          ? await adminCreateProduct(payload)
          : await adminUpdateProduct(productId!, payload)

      if (result && typeof result === "object" && "error" in result) {
        toast({ variant: "destructive", title: "Erreur", description: String(result.error) })
        return
      }

      if (!result || typeof result !== "object" || !("id" in result)) {
        toast({ variant: "destructive", title: "Erreur", description: "Reponse serveur invalide." })
        return
      }

      if (mode === "create") {
        router.push(`/admin/products/${result.id}/edit?created=1`)
        return
      }

      toast({ title: "Produit mis a jour", description: "Les modifications ont ete enregistrees." })
      router.refresh()
    } catch (error: any) {
      console.error("Product save failed:", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Une erreur est survenue lors de l'enregistrement.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products">
            <Button variant="ghost" size="icon" type="button">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              L'editeur enregistre le category_id du niveau le plus profond selectionne.
            </p>
          </div>
        </div>
        <Button type="submit" disabled={isSubmitting || isUploadingImages} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitLabel}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto bg-muted px-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="specifications">Specifications</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Informations generales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title_fr">Titre FR *</Label>
                  <Input
                    id="title_fr"
                    value={form.title_fr}
                    onChange={(event) => {
                      const value = event.target.value
                      setField("title_fr", value)
                      if (!hasManuallyEditedSlugRef.current) {
                        setField("slug", toSlug(value))
                      }
                    }}
                    placeholder="Ex: ASUS ROG Strix G16"
                  />
                  {errors.title_fr && <p className="text-xs text-destructive">{errors.title_fr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="title_ar">Titre AR</Label>
                  <Input
                    id="title_ar"
                    dir="rtl"
                    value={form.title_ar}
                    onChange={(event) => setField("title_ar", event.target.value)}
                  />
                  {errors.title_ar && <p className="text-xs text-destructive">{errors.title_ar}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(event) => {
                      hasManuallyEditedSlugRef.current = true
                      setSlugStatus("idle")
                      setField("slug", toSlug(event.target.value))
                    }}
                    onBlur={handleSlugBlur}
                    placeholder="asus-rog-strix-g16"
                  />
                  {slugStatus === "checking" && (
                    <Badge variant="secondary" className="gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Verification...
                    </Badge>
                  )}
                  {slugStatus === "available" && (
                    <Badge variant="secondary" className="gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Disponible
                    </Badge>
                  )}
                  {slugStatus === "taken" && <Badge variant="destructive">Slug deja pris</Badge>}
                </div>
                {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="description_fr">Description FR</Label>
                  <Textarea
                    id="description_fr"
                    rows={5}
                    value={form.description_fr}
                    onChange={(event) => setField("description_fr", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description_ar">Description AR</Label>
                  <Textarea
                    id="description_ar"
                    rows={5}
                    dir="rtl"
                    value={form.description_ar}
                    onChange={(event) => setField("description_ar", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Departement *</Label>
                  <Select
                    value={form.department_id}
                    onValueChange={(value) => {
                      setField("department_id", value)
                      setField("category_id", null)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un departement" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name_fr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.department_id && <p className="text-xs text-destructive">{errors.department_id}</p>}
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label>Categorie *</Label>
                  <CategoryPicker
                    departmentId={form.department_id || undefined}
                    selectedCategoryId={form.category_id}
                    onCategoryChange={handleCategoryChange}
                  />
                  {errors.category_id && <p className="text-xs text-destructive">{errors.category_id}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Marque (optionnel)</Label>
                  <Select
                    value={form.brand_id || "none"}
                    onValueChange={(value) => setField("brand_id", value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une marque" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Label htmlFor="is_featured">Produit mis en avant</Label>
                    <Switch
                      id="is_featured"
                      checked={form.is_featured}
                      onCheckedChange={(checked) => setField("is_featured", checked)}
                    />
                  </div>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Label htmlFor="is_active">Actif</Label>
                    <Switch
                      id="is_active"
                      checked={form.is_active}
                      onCheckedChange={(checked) => setField("is_active", checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>Prix</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="price_dzd">Prix (DZD)</Label>
                <Input
                  id="price_dzd"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price_dzd}
                  onChange={(event) => setField("price_dzd", event.target.value)}
                />
                {errors.price_dzd && <p className="text-xs text-destructive">{errors.price_dzd}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compare_at_price_dzd">Ancien prix (DZD)</Label>
                <Input
                  id="compare_at_price_dzd"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.compare_at_price_dzd}
                  onChange={(event) => setField("compare_at_price_dzd", event.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Stock et disponibilite</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={form.sku}
                    onChange={(event) => setField("sku", event.target.value)}
                    placeholder="Optionnel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock">Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(event) => setField("stock", event.target.value)}
                  />
                  {errors.stock && <p className="text-xs text-destructive">{errors.stock}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">En stock</p>
                  <p className="text-xs text-muted-foreground">
                    Derive du stock, vous pouvez le forcer rapidement via le switch.
                  </p>
                </div>
                <Switch
                  checked={inStock}
                  onCheckedChange={(checked) => {
                    if (checked && parseNumber(form.stock) <= 0) setField("stock", "1")
                    if (!checked) setField("stock", "0")
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specifications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Specifications</CardTitle>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addSpecRow}>
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.specs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune specification pour ce produit.</p>
              ) : (
                form.specs.map((spec, index) => (
                  <div key={spec.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <Label className="text-xs">Cle</Label>
                      <Input
                        className="mt-1"
                        value={spec.key}
                        onChange={(event) => updateSpecRow(spec.id, { key: event.target.value })}
                        placeholder="Ex: RAM"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Valeur FR</Label>
                      <Input
                        className="mt-1"
                        value={spec.value_fr}
                        onChange={(event) => updateSpecRow(spec.id, { value_fr: event.target.value })}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Valeur AR</Label>
                      <Input
                        className="mt-1"
                        dir="rtl"
                        value={spec.value_ar}
                        onChange={(event) => updateSpecRow(spec.id, { value_ar: event.target.value })}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Label className="text-xs">Ordre</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        min={0}
                        value={spec.sort_order}
                        onChange={(event) =>
                          updateSpecRow(spec.id, {
                            sort_order: Number.isNaN(Number(event.target.value)) ? 0 : Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end gap-2 md:col-span-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => moveSpecRow(spec.id, "up")}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={index === form.specs.length - 1}
                        onClick={() => moveSpecRow(spec.id, "down")}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="destructive" onClick={() => removeSpecRow(spec.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                id="image_upload"
                type="file"
                accept="image/*"
                multiple
                disabled={isUploadingImages}
                onChange={handleUploadImages}
                className="max-w-md"
              />

              {isUploadingImages && (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Upload en cours...
                </Badge>
              )}

              {form.images.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune image pour ce produit.</p>
              ) : (
                <div className="space-y-3">
                  {form.images.map((image, index) => (
                    <div
                      key={image.id}
                      className="grid gap-3 rounded-md border p-3 md:grid-cols-12"
                      draggable
                      onDragStart={() => setDraggedImageId(image.id)}
                      onDragEnd={() => setDraggedImageId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleImageDrop(image.id)}
                    >
                      <div className="md:col-span-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt={image.alt_fr || "Product image"}
                          className="h-20 w-full rounded-md border object-cover"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs">Alt FR</Label>
                        <Input
                          className="mt-1"
                          value={image.alt_fr}
                          onChange={(event) => updateImage(image.id, { alt_fr: event.target.value })}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs">Alt AR</Label>
                        <Input
                          className="mt-1"
                          dir="rtl"
                          value={image.alt_ar}
                          onChange={(event) => updateImage(image.id, { alt_ar: event.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2 md:col-span-4 md:justify-end">
                        <Button
                          type="button"
                          variant={image.is_primary ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPrimaryImage(image.id)}
                        >
                          {image.is_primary ? "Image principale" : "Definir principale"}
                        </Button>
                        <Button type="button" variant="outline" size="icon" disabled={index === 0}>
                          <GripVertical className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="destructive" size="icon" onClick={() => removeImage(image.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Glissez-deposez les lignes pour reordonner. La premiere image est la principale.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Variants</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={addVariantRow}
                disabled={!variantsSupported}
              >
                <Plus className="h-4 w-4" />
                Ajouter un variant
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!variantsSupported && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  La table <code>product_variants</code> est absente. Cette section est desactivee.
                </div>
              )}

              {variantsSupported && form.variants.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun variant configure pour ce produit.</p>
              )}

              {variantsSupported &&
                form.variants.map((variant, index) => (
                  <div key={variant.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <Label className="text-xs">Nom</Label>
                      <Input
                        className="mt-1"
                        value={variant.name}
                        onChange={(event) => updateVariantRow(variant.id, { name: event.target.value })}
                        placeholder="Ex: Couleur"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Valeur</Label>
                      <Input
                        className="mt-1"
                        value={variant.value}
                        onChange={(event) => updateVariantRow(variant.id, { value: event.target.value })}
                        placeholder="Ex: Noir"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Delta prix</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        value={variant.price_delta_dzd}
                        onChange={(event) => updateVariantRow(variant.id, { price_delta_dzd: event.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Stock</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        min={0}
                        value={variant.stock}
                        onChange={(event) => updateVariantRow(variant.id, { stock: event.target.value })}
                      />
                    </div>
                    <div className="flex items-end gap-2 md:col-span-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => moveVariantRow(variant.id, "up")}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={index === form.variants.length - 1}
                        onClick={() => moveVariantRow(variant.id, "down")}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="destructive" onClick={() => removeVariantRow(variant.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {seoSupported === false && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Les colonnes SEO ne sont pas detectees sur <code>products</code>. Lancez la migration SEO pour activer l'enregistrement.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="meta_title_fr">Meta title FR</Label>
                  <Input
                    id="meta_title_fr"
                    value={form.seo.meta_title_fr}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, seo: { ...prev.seo, meta_title_fr: event.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meta_title_ar">Meta title AR</Label>
                  <Input
                    id="meta_title_ar"
                    dir="rtl"
                    value={form.seo.meta_title_ar}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, seo: { ...prev.seo, meta_title_ar: event.target.value } }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="meta_description_fr">Meta description FR</Label>
                  <Textarea
                    id="meta_description_fr"
                    rows={4}
                    value={form.seo.meta_description_fr}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, meta_description_fr: event.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meta_description_ar">Meta description AR</Label>
                  <Textarea
                    id="meta_description_ar"
                    rows={4}
                    dir="rtl"
                    value={form.seo.meta_description_ar}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, meta_description_ar: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  )
}
