"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import { Plus, Edit, Trash2, GripVertical, Image as ImageIcon, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getMarqueeBrandsAdmin,
  getAllBrands,
  addBrandToMarquee,
  addAllBrandsToMarquee,
  createBrandAdmin,
  updateBrandAdmin,
  createHomePageBannerAdmin,
  deleteHomePageBannerAdmin,
  getHomePageBannersAdmin,
  removeBrandFromMarquee,
  toggleMarqueeBrandActive,
  updateHomePageBannerAdmin,
  uploadAdminContentImage,
  updateMarqueeBrandOrder,
} from "@/app/admin/content/actions"
import { BrandLogo } from "@/components/store/brand-logo"
import { toast } from "sonner"

type MarqueeBrand = {
  id: string
  brand_id: string
  logo_url: string
  sort_order: number
  is_active: boolean
  brands: {
    id: string
    name: string
    slug: string
    logo_url: string | null
  }
}

type Brand = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  is_active: boolean
}

export default function AdminContentPage() {
  const [marqueeBrands, setMarqueeBrands] = useState<MarqueeBrand[]>([])
  const [allBrands, setAllBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBrandDialogOpen, setIsBrandDialogOpen] = useState(false)
  const [isEditBrandDialogOpen, setIsEditBrandDialogOpen] = useState(false)
  const [selectedBrandId, setSelectedBrandId] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [brandName, setBrandName] = useState("")
  const [brandSlug, setBrandSlug] = useState("")
  const [brandLogoUrl, setBrandLogoUrl] = useState("")
  const [brandIsActive, setBrandIsActive] = useState(true)
  const [isUploadingMarqueeLogo, setIsUploadingMarqueeLogo] = useState(false)
  const [isUploadingBrandLogo, setIsUploadingBrandLogo] = useState(false)
  const [editBrandId, setEditBrandId] = useState("")
  const [editBrandLogoUrl, setEditBrandLogoUrl] = useState("")
  const [isUploadingEditBrandLogo, setIsUploadingEditBrandLogo] = useState(false)
  const [isSavingEditBrand, setIsSavingEditBrand] = useState(false)
  const [homeBanners, setHomeBanners] = useState<any[]>([])
  const [isHeroDialogOpen, setIsHeroDialogOpen] = useState(false)
  const [heroTitleFr, setHeroTitleFr] = useState("")
  const [heroTitleAr, setHeroTitleAr] = useState("")
  const [heroDescriptionFr, setHeroDescriptionFr] = useState("")
  const [heroDescriptionAr, setHeroDescriptionAr] = useState("")
  const [heroLinkUrl, setHeroLinkUrl] = useState("")
  const [heroIsActive, setHeroIsActive] = useState(true)
  const [isCreatingHero, setIsCreatingHero] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [marqueeData, brandsData, homeBannersData] = await Promise.all([
        getMarqueeBrandsAdmin(),
        getAllBrands(),
        getHomePageBannersAdmin(),
      ])
      setMarqueeBrands(marqueeData)
      setAllBrands(brandsData)
      setHomeBanners(homeBannersData)
    } catch (error) {
      console.error("Failed to load data:", error)
      toast.error("Échec du chargement des données")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAddBrand = async () => {
    if (!selectedBrandId) {
      toast.error("Veuillez sélectionner une marque")
      return
    }

    const brand = allBrands.find((b) => b.id === selectedBrandId)
    if (!brand) return

    const finalLogoUrl = logoUrl || brand.logo_url || ""

    const result = await addBrandToMarquee(selectedBrandId, finalLogoUrl)
    if (result.error) {
      toast.error("Échec de l'ajout de la marque")
    } else {
      toast.success("Marque ajoutée avec succès")
      setIsDialogOpen(false)
      setSelectedBrandId("")
      setLogoUrl("")
      loadData()
    }
  }

  const handleRemoveBrand = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir retirer cette marque du marquee?")) return

    const result = await removeBrandFromMarquee(id)
    if (result.error) {
      toast.error("Échec de la suppression")
    } else {
      toast.success("Marque retirée avec succès")
      loadData()
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const result = await toggleMarqueeBrandActive(id, !isActive)
    if (result.error) {
      toast.error("Échec de la mise à jour")
    } else {
      toast.success("Statut mis à jour")
      loadData()
    }
  }

  const handleMoveBrand = async (id: string, direction: "up" | "down") => {
    const index = marqueeBrands.findIndex((brand) => brand.id === id)
    if (index === -1) return

    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= marqueeBrands.length) return

    const reordered = [...marqueeBrands]
    const [moving] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moving)

    setMarqueeBrands(reordered)

    try {
      await Promise.all(
        reordered.map((brand, order) => updateMarqueeBrandOrder(brand.id, order))
      )
      toast.success("Ordre mis à jour")
      loadData()
    } catch (error) {
      console.error("Failed to reorder marquee brands:", error)
      toast.error("Échec de la mise à jour de l'ordre")
      loadData()
    }
  }

  const handleCreateBrand = async () => {
    if (!brandName.trim() || !brandSlug.trim()) {
      toast.error("Veuillez saisir un nom et un slug")
      return
    }

    const result = await createBrandAdmin({
      name: brandName.trim(),
      slug: brandSlug.trim(),
      logo_url: brandLogoUrl.trim() || undefined,
      is_active: brandIsActive,
    })

    if (result.error) {
      toast.error("Échec de la création de la marque")
    } else {
      toast.success("Marque créée avec succès")
      setIsBrandDialogOpen(false)
      setBrandName("")
      setBrandSlug("")
      setBrandLogoUrl("")
      setBrandIsActive(true)
      loadData()
    }
  }

  const handleBrandNameChange = (value: string) => {
    setBrandName(value)
    if (!brandSlug) {
      const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
      setBrandSlug(slug)
    }
  }

  const handleAddAllBrands = async () => {
    const result = await addAllBrandsToMarquee()
    if (result.error) {
      toast.error("Échec de l'ajout des marques")
    } else {
      toast.success("Marques ajoutées avec succès")
      loadData()
    }
  }

  const handleUploadMarqueeLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingMarqueeLogo(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await uploadAdminContentImage(formData)

      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String(result.error))
      }

      if (result && typeof result === "object" && "url" in result) {
        setLogoUrl(String(result.url))
        toast.success("Logo telecharge avec succes")
      } else {
        throw new Error("Upload impossible")
      }
    } catch (error: any) {
      toast.error(error?.message || "Echec du telechargement du logo")
    } finally {
      event.target.value = ""
      setIsUploadingMarqueeLogo(false)
    }
  }

  const handleUploadBrandLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingBrandLogo(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await uploadAdminContentImage(formData)

      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String(result.error))
      }

      if (result && typeof result === "object" && "url" in result) {
        setBrandLogoUrl(String(result.url))
        toast.success("Logo telecharge avec succes")
      } else {
        throw new Error("Upload impossible")
      }
    } catch (error: any) {
      toast.error(error?.message || "Echec du telechargement du logo")
    } finally {
      event.target.value = ""
      setIsUploadingBrandLogo(false)
    }
  }

  const handleUploadEditBrandLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingEditBrandLogo(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await uploadAdminContentImage(formData)

      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String(result.error))
      }

      if (result && typeof result === "object" && "url" in result) {
        setEditBrandLogoUrl(String(result.url))
        toast.success("Logo telecharge avec succes")
      } else {
        throw new Error("Upload impossible")
      }
    } catch (error: any) {
      toast.error(error?.message || "Echec du telechargement du logo")
    } finally {
      event.target.value = ""
      setIsUploadingEditBrandLogo(false)
    }
  }

  const handleSaveEditBrandLogo = async () => {
    if (!editBrandId) {
      toast.error("Veuillez selectionner une marque")
      return
    }

    setIsSavingEditBrand(true)
    try {
      const payloadLogo = editBrandLogoUrl.trim()
      const result = await updateBrandAdmin(editBrandId, {
        logo_url: payloadLogo ? payloadLogo : null,
      })
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String(result.error))
      }
      toast.success("Logo mis a jour")
      setIsEditBrandDialogOpen(false)
      setEditBrandId("")
      setEditBrandLogoUrl("")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Echec de la mise a jour du logo")
    } finally {
      setIsSavingEditBrand(false)
    }
  }

  const handleCreateHomeBanner = async () => {
    if (!heroTitleFr.trim() || !heroTitleAr.trim()) {
      toast.error("Veuillez saisir un titre en français et en arabe")
      return
    }

    setIsCreatingHero(true)
    try {
      const result = await createHomePageBannerAdmin({
        title_fr: heroTitleFr.trim(),
        title_ar: heroTitleAr.trim(),
        description_fr: heroDescriptionFr.trim(),
        description_ar: heroDescriptionAr.trim(),
        link_url: heroLinkUrl.trim() || undefined,
        image_url: "",
        is_active: heroIsActive,
      })

      if (result.error) {
        console.error("Banner creation error:", result.error)
        toast.error(result.error || "Échec de la création du message d'accueil")
      } else if (result.success) {
        toast.success("Message d'accueil créé avec succès")
        setIsHeroDialogOpen(false)
        setHeroTitleFr("")
        setHeroTitleAr("")
        setHeroDescriptionFr("")
        setHeroDescriptionAr("")
        setHeroLinkUrl("")
        setHeroIsActive(true)
        loadData()
      }
    } catch (error) {
      console.error("Failed to create home banner:", error)
      toast.error((error as any)?.message || "Échec de la création du message d'accueil")
    } finally {
      setIsCreatingHero(false)
    }
  }

  const handleDeleteHomeBanner = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce message d'accueil?")) return

    const result = await deleteHomePageBannerAdmin(id)
    if (result.error) {
      toast.error("Échec de la suppression")
    } else {
      toast.success("Message d'accueil supprimé")
      loadData()
    }
  }

  const handleToggleHomeBannerActive = async (id: string, isActive: boolean) => {
    const result = await updateHomePageBannerAdmin(id, { is_active: !isActive })
    if (result.error) {
      toast.error("Échec de la mise à jour")
    } else {
      toast.success("Statut mis à jour")
      loadData()
    }
  }

  // Filter out brands that are already in marquee
  const availableBrands = allBrands.filter(
    (brand) => !marqueeBrands.some((mb) => mb.brand_id === brand.id)
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Gestion des marques
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez les marques affichées dans le bandeau défilant du site
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Message d'accueil</CardTitle>
              <CardDescription>
                Contrôlez le texte simple et professionnel qui s'affiche en haut de la page d'accueil.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={isHeroDialogOpen} onOpenChange={setIsHeroDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    Nouveau message
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer un message d'accueil</DialogTitle>
                    <DialogDescription>
                      Ajoutez un titre et une description pour la page d'accueil.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>titre (français)</Label>
                      <Input
                        placeholder="Titre en français"
                        value={heroTitleFr}
                        onChange={(e) => setHeroTitleFr(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>titre (العربية)</Label>
                      <Input
                        placeholder="العنوان باللغة العربية"
                        value={heroTitleAr}
                        onChange={(e) => setHeroTitleAr(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (français)</Label>
                      <Input
                        placeholder="Description en français"
                        value={heroDescriptionFr}
                        onChange={(e) => setHeroDescriptionFr(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (العربية)</Label>
                      <Input
                        placeholder="الوصف باللغة العربية"
                        value={heroDescriptionAr}
                        onChange={(e) => setHeroDescriptionAr(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL du lien (optionnel)</Label>
                      <Input
                        placeholder="/shop ou URL complète"
                        value={heroLinkUrl}
                        onChange={(e) => setHeroLinkUrl(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Visible</p>
                        <p className="text-xs text-muted-foreground">Activez pour afficher le message sur la page d'accueil</p>
                      </div>
                      <Switch checked={heroIsActive} onCheckedChange={setHeroIsActive} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsHeroDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleCreateHomeBanner} disabled={isCreatingHero}>
                      {isCreatingHero ? "Enregistrement..." : "Créer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {homeBanners.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-sm text-muted-foreground">Aucun message d'accueil configuré.</p>
              <Button size="sm" variant="outline" onClick={() => setIsHeroDialogOpen(true)}>
                Créer le premier message
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {homeBanners.map((banner) => (
                <Card key={banner.id} className="border-border">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{banner.title_fr || banner.title_ar}</p>
                      <p className="text-sm text-muted-foreground">{banner.description_fr || banner.description_ar}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Lien : {banner.link_url || "/shop"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={banner.is_active}
                        onCheckedChange={() => handleToggleHomeBannerActive(banner.id, banner.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteHomeBanner(banner.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Marques dans le marquee</CardTitle>
              <CardDescription>
                {marqueeBrands.length} marque{marqueeBrands.length !== 1 ? "s" : ""} configurée
                {marqueeBrands.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddAllBrands}
                disabled={availableBrands.length === 0}
              >
                Ajouter toutes
              </Button>
              <Dialog open={isEditBrandDialogOpen} onOpenChange={setIsEditBrandDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    Modifier logo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modifier le logo d'une marque</DialogTitle>
                    <DialogDescription>
                      Mettez a jour le champ <code>brands.logo_url</code>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Marque</Label>
                      <Select
                        value={editBrandId}
                        onValueChange={(value) => {
                          setEditBrandId(value)
                          const brand = allBrands.find((row) => row.id === value)
                          setEditBrandLogoUrl(String(brand?.logo_url || ""))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectionnez une marque" />
                        </SelectTrigger>
                        <SelectContent>
                          {allBrands.map((brand) => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Logo URL (optionnel)</Label>
                      <Input
                        placeholder="https://..."
                        value={editBrandLogoUrl}
                        onChange={(e) => setEditBrandLogoUrl(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Logo depuis l'appareil</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadEditBrandLogo}
                        disabled={isUploadingEditBrandLogo || isSavingEditBrand}
                      />
                      {isUploadingEditBrandLogo && (
                        <p className="text-xs text-muted-foreground">Telechargement en cours...</p>
                      )}
                      {editBrandLogoUrl ? (
                        <div className="rounded-md border border-border bg-card p-2">
                          <BrandLogo
                            src={editBrandLogoUrl}
                            alt="Apercu logo"
                            width={220}
                            height={80}
                            imgClassName="h-full w-full object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditBrandDialogOpen(false)} disabled={isSavingEditBrand}>
                      Annuler
                    </Button>
                    <Button onClick={handleSaveEditBrandLogo} disabled={isSavingEditBrand || isUploadingEditBrandLogo}>
                      {isSavingEditBrand ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isBrandDialogOpen} onOpenChange={setIsBrandDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    Nouvelle marque
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Creer une marque</DialogTitle>
                    <DialogDescription>
                      Ajoutez une nouvelle marque a la base de donnees.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        placeholder="Ex: Acer"
                        value={brandName}
                        onChange={(e) => handleBrandNameChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input
                        placeholder="ex: acer"
                        value={brandSlug}
                        onChange={(e) => setBrandSlug(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Logo depuis l'appareil (optionnel)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadBrandLogo}
                        disabled={isUploadingBrandLogo}
                      />
                      {isUploadingBrandLogo && (
                        <p className="text-xs text-muted-foreground">Telechargement en cours...</p>
                      )}
                      {brandLogoUrl && (
                        <div className="rounded-md border border-border bg-card p-2">
                          <img src={brandLogoUrl} alt="Apercu logo" className="h-16 w-full object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Active</p>
                        <p className="text-xs text-muted-foreground">Visible dans les listes</p>
                      </div>
                      <Switch checked={brandIsActive} onCheckedChange={setBrandIsActive} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsBrandDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleCreateBrand} disabled={isUploadingBrandLogo}>
                      Creer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter une marque
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter une marque au marquee</DialogTitle>
                    <DialogDescription>
                      Sélectionnez une marque à ajouter au bandeau défilant
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Marque</Label>
                      <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une marque" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableBrands.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">
                              Toutes les marques sont déjà ajoutées
                            </div>
                          ) : (
                            availableBrands.map((brand) => (
                              <SelectItem key={brand.id} value={brand.id}>
                                {brand.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Logo depuis l'appareil (optionnel)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadMarqueeLogo}
                        disabled={isUploadingMarqueeLogo}
                      />
                      {isUploadingMarqueeLogo && (
                        <p className="text-xs text-muted-foreground">Telechargement en cours...</p>
                      )}
                      {logoUrl && (
                        <div className="rounded-md border border-border bg-card p-2">
                          <img src={logoUrl} alt="Apercu logo marquee" className="h-16 w-full object-contain" />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Laissez vide pour utiliser le logo par défaut de la marque
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleAddBrand} disabled={!selectedBrandId || isUploadingMarqueeLogo}>
                      Ajouter
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </div>
          ) : marqueeBrands.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-sm text-muted-foreground">
                Aucune marque configurée
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddAllBrands}
                  disabled={availableBrands.length === 0}
                >
                  Ajouter toutes les marques
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsDialogOpen(true)}
                >
                  Ajouter la première marque
                </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsBrandDialogOpen(true)}
                  >
                    Nouvelle marque
                  </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {marqueeBrands.map((marqueeBrand) => (
                <Card key={marqueeBrand.id} className="border-border">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleMoveBrand(marqueeBrand.id, "up")}
                          disabled={marqueeBrands[0]?.id === marqueeBrand.id}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleMoveBrand(marqueeBrand.id, "down")}
                          disabled={marqueeBrands[marqueeBrands.length - 1]?.id === marqueeBrand.id}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-border bg-white p-2">
                        <BrandLogo
                          src={marqueeBrand.logo_url || marqueeBrand.brands.logo_url}
                          alt={marqueeBrand.brands.name}
                          width={96}
                          height={64}
                          unoptimized
                          imgClassName="h-full w-full object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {marqueeBrand.brands.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Position: {marqueeBrand.sort_order + 1}
                        </p>
                        {marqueeBrand.is_active ? (
                          <Badge className="mt-1 bg-green-100 text-green-800 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="mt-1 bg-gray-100 text-gray-800 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={marqueeBrand.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(marqueeBrand.id, marqueeBrand.is_active)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const brand = allBrands.find((row) => row.id === marqueeBrand.brands.id)
                          setEditBrandId(marqueeBrand.brands.id)
                          setEditBrandLogoUrl(String(brand?.logo_url || marqueeBrand.brands.logo_url || ""))
                          setIsEditBrandDialogOpen(true)
                        }}
                        title="Modifier logo"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveBrand(marqueeBrand.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
