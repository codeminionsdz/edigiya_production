"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { adminCreateCategory } from "@/app/admin/actions"

interface AddCategoryDialogProps {
  departmentId: string
  parentId: string | null
  onClose: () => void
  onCategoryAdded: (categoryId: string) => void
}

export function AddCategoryDialog({ departmentId, parentId, onClose, onCategoryAdded }: AddCategoryDialogProps) {
  const [nameFr, setNameFr] = useState("")
  const [nameAr, setNameAr] = useState("")
  const [slug, setSlug] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    try {
      setError("")
      if (!nameFr.trim() || !nameAr.trim() || !slug.trim()) {
        setError("Tous les champs sont obligatoires")
        return
      }

      setIsSaving(true)

      const result = await adminCreateCategory({
        department_id: departmentId,
        parent_id: parentId,
        name_fr: nameFr.trim(),
        name_ar: nameAr.trim(),
        slug: slug.toLowerCase().trim(),
        sort_order: 0,
        is_active: true,
      })

      if (result && "error" in result) {
        setError(result.error)
        return
      }

      if (result?.id) {
        onCategoryAdded(result.id)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleNameFrChange = (value: string) => {
    setNameFr(value)
    if (!slug) {
      setSlug(value.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, ""))
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une categorie</DialogTitle>
          <DialogDescription>
            {parentId ? "Ajouter comme sous-categorie" : "Ajouter comme categorie racine"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Nom (Francais) *</Label>
            <Input
              className="mt-1.5"
              placeholder="Ex: Whey Protein"
              value={nameFr}
              onChange={(event) => handleNameFrChange(event.target.value)}
              disabled={isSaving}
            />
          </div>

          <div>
            <Label>Nom (Arabe) *</Label>
            <Input
              className="mt-1.5"
              dir="rtl"
              placeholder="اسم الفئة"
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
              disabled={isSaving}
            />
          </div>

          <div>
            <Label>Slug (URL) *</Label>
            <Input
              className="mt-1.5"
              placeholder="whey-protein"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              disabled={isSaving}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Creer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
