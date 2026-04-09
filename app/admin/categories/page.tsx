"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import {
  adminCanDeleteCategory,
  adminCreateCategory,
  adminCreateDepartment,
  adminDeleteCategory,
  adminGetCategoryTree,
  adminGetDepartments,
  adminMoveCategoryDown,
  adminMoveCategoryUp,
  adminSlugExists,
  adminToggleCategoryActive,
  adminUploadDepartmentImage,
  adminUpdateCategory,
} from "@/app/admin/actions"

interface Department {
  id: string
  slug: string
  name_fr: string
  name_ar: string
  image_url?: string | null
  is_active?: boolean
}

interface CategoryNode {
  id: string
  name_fr: string
  name_ar: string
  slug: string
  parent_id: string | null
  department_id: string
  sort_order: number
  is_active: boolean
  children: CategoryNode[]
}

interface EditorState {
  name_fr: string
  name_ar: string
  slug: string
  sort_order: number
  is_active: boolean
}

interface DepartmentEditorState {
  name_fr: string
  name_ar: string
  slug: string
  image_url: string
  is_active: boolean
}

function initialEditorState(): EditorState {
  return {
    name_fr: "",
    name_ar: "",
    slug: "",
    sort_order: 0,
    is_active: true,
  }
}

function initialDepartmentEditorState(): DepartmentEditorState {
  return {
    name_fr: "",
    name_ar: "",
    slug: "",
    image_url: "",
    is_active: true,
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export default function CategoriesPage() {
  const { toast } = useToast()
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("")
  const [tree, setTree] = useState<CategoryNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false)
  const [isUploadingDepartmentImage, setIsUploadingDepartmentImage] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create")
  const [editorParentId, setEditorParentId] = useState<string | null>(null)
  const [editorCategoryId, setEditorCategoryId] = useState<string | null>(null)
  const [editorState, setEditorState] = useState<EditorState>(initialEditorState)
  const [departmentEditorOpen, setDepartmentEditorOpen] = useState(false)
  const [departmentEditorMode, setDepartmentEditorMode] = useState<"create" | "edit">("create")
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null)
  const [departmentEditorState, setDepartmentEditorState] =
    useState<DepartmentEditorState>(initialDepartmentEditorState)
  const [departmentDeleteOpen, setDepartmentDeleteOpen] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)

  useEffect(() => {
    let active = true

    async function loadDepartments() {
      setIsLoading(true)
      try {
        const rows = await adminGetDepartments()
        const departmentRows = Array.isArray(rows) ? rows : []

        if (!active) return
        setDepartments(departmentRows)
        if (departmentRows.length > 0) {
          setSelectedDepartmentId(departmentRows[0].id)
        } else {
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Failed to load departments:", error)
        if (active) {
          setDepartments([])
          setIsLoading(false)
        }
      }
    }

    void loadDepartments()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedDepartmentId) return
    void refreshTree(selectedDepartmentId)
  }, [selectedDepartmentId])

  useEffect(() => {
    if (departments.length === 0) return
    const exists = departments.some((department) => department.id === selectedDepartmentId)
    if (!selectedDepartmentId || !exists) {
      setSelectedDepartmentId(departments[0].id)
    }
  }, [departments, selectedDepartmentId])

  const refreshTree = async (departmentId = selectedDepartmentId) => {
    if (!departmentId) return
    setIsLoading(true)
    try {
      const rows = await adminGetCategoryTree(departmentId)
      const treeRows = Array.isArray(rows) ? rows : []
      setTree(treeRows)
      setExpandedIds(new Set(treeRows.map((node) => node.id)))
    } catch (error) {
      console.error("Failed to load category tree:", error)
      setTree([])
    } finally {
      setIsLoading(false)
    }
  }

  const openDepartmentDialog = () => {
    setDepartmentEditorMode("create")
    setEditingDepartmentId(null)
    setDepartmentEditorState(initialDepartmentEditorState())
    setDepartmentEditorOpen(true)
  }

  const openEditDepartmentDialog = () => {
    if (!selectedDepartmentId) return
    const department = departments.find((row) => row.id === selectedDepartmentId)
    if (!department) return

    setDepartmentEditorMode("edit")
    setEditingDepartmentId(department.id)
    setDepartmentEditorState({
      name_fr: String(department.name_fr || ""),
      name_ar: String(department.name_ar || ""),
      slug: String(department.slug || ""),
      image_url: String(department.image_url || ""),
      is_active: Boolean(department.is_active ?? true),
    })
    setDepartmentEditorOpen(true)
  }

  const requestDeleteDepartment = () => {
    if (!selectedDepartmentId) return
    setDepartmentDeleteOpen(true)
  }

  const handleDepartmentImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingDepartmentImage(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const result = await adminUploadDepartmentImage(formData)
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String(result.error))
      }

      if (result && typeof result === "object" && "url" in result) {
        setDepartmentEditorState((previous) => ({
          ...previous,
          image_url: String(result.url),
        }))
        toast({
          title: "Image telechargee",
          description: "La photo du departement est prete.",
        })
      } else {
        throw new Error("Upload impossible.")
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur upload",
        description: error?.message || "Impossible de telecharger l'image.",
      })
    } finally {
      event.target.value = ""
      setIsUploadingDepartmentImage(false)
    }
  }

  const handleCreateDepartment = async () => {
    if (!departmentEditorState.name_fr.trim() || !departmentEditorState.name_ar.trim() || !departmentEditorState.slug.trim()) {
      toast({
        variant: "destructive",
        title: "Validation",
        description: "name_fr, name_ar et slug sont obligatoires.",
      })
      return
    }

    const normalizedSlug = slugify(departmentEditorState.slug)
    const alreadyExists = departments.some((department) => department.slug === normalizedSlug)
    if (alreadyExists) {
      toast({
        variant: "destructive",
        title: "Slug deja utilise",
        description: "Ce slug existe deja pour un autre departement.",
      })
      return
    }

    setIsCreatingDepartment(true)

    try {
      const created = await adminCreateDepartment({
        slug: normalizedSlug,
        name_fr: departmentEditorState.name_fr.trim(),
        name_ar: departmentEditorState.name_ar.trim(),
        image_url: departmentEditorState.image_url.trim() || undefined,
        sort_order: departments.length,
        is_active: departmentEditorState.is_active,
      })

      if (created && typeof created === "object" && "error" in created) {
        throw new Error(String(created.error))
      }

      const createdId =
        created && typeof created === "object" && "id" in created && typeof created.id === "string"
          ? created.id
          : ""

      const rows = await adminGetDepartments()
      const departmentRows = Array.isArray(rows) ? rows : []
      const fallbackRows =
        departmentRows.length > 0
          ? departmentRows
          : createdId
            ? [
                ...departments,
                {
                  id: createdId,
                  slug: normalizedSlug,
                  name_fr: departmentEditorState.name_fr.trim(),
                  name_ar: departmentEditorState.name_ar.trim(),
                  image_url: departmentEditorState.image_url.trim() || null,
                },
              ]
            : departments
      setDepartments(fallbackRows)

      const createdDepartment =
        (createdId
          ? fallbackRows.find((department) => department.id === createdId)
          : undefined) || fallbackRows.find((department) => department.slug === normalizedSlug)

      if (createdDepartment) {
        setSelectedDepartmentId(createdDepartment.id)
      } else if (createdId) {
        setSelectedDepartmentId(createdId)
      }

      setDepartmentEditorOpen(false)
      toast({
        title: "Departement cree",
        description: "Vous pouvez maintenant ajouter vos categories et sous-categories.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Impossible de creer le departement.",
      })
    } finally {
      setIsCreatingDepartment(false)
    }
  }

  const handleUpdateDepartment = async () => {
    if (!editingDepartmentId) return

    if (!departmentEditorState.name_fr.trim() || !departmentEditorState.name_ar.trim() || !departmentEditorState.slug.trim()) {
      toast({
        variant: "destructive",
        title: "Validation",
        description: "name_fr, name_ar et slug sont obligatoires.",
      })
      return
    }

    const normalizedSlug = slugify(departmentEditorState.slug)
    const alreadyExists = departments.some(
      (department) => department.slug === normalizedSlug && department.id !== editingDepartmentId
    )
    if (alreadyExists) {
      toast({
        variant: "destructive",
        title: "Slug deja utilise",
        description: "Ce slug existe deja pour un autre departement.",
      })
      return
    }

    setIsCreatingDepartment(true)

    try {
      const response = await fetch(`/api/admin/departments/${encodeURIComponent(editingDepartmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: normalizedSlug,
          name_fr: departmentEditorState.name_fr.trim(),
          name_ar: departmentEditorState.name_ar.trim(),
          image_url: departmentEditorState.image_url.trim() || null,
          is_active: departmentEditorState.is_active,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(String(json?.error || "Impossible de mettre a jour le departement."))
      }

      // Instant UI update (no reload)
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === editingDepartmentId
            ? {
                ...d,
                slug: normalizedSlug,
                name_fr: departmentEditorState.name_fr.trim(),
                name_ar: departmentEditorState.name_ar.trim(),
                image_url: departmentEditorState.image_url.trim() || null,
                is_active: departmentEditorState.is_active,
              }
            : d
        )
      )
      setSelectedDepartmentId(editingDepartmentId)

      setDepartmentEditorOpen(false)
      toast({
        title: "Departement mis a jour",
        description: "Les informations ont ete enregistrees.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Impossible de mettre a jour le departement.",
      })
    } finally {
      setIsCreatingDepartment(false)
    }
  }

  const handleDeleteDepartment = async () => {
    if (!selectedDepartmentId) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/departments/${encodeURIComponent(selectedDepartmentId)}`, {
        method: "DELETE",
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(String(json?.error || "Impossible de supprimer le departement."))
      }

      const deletedId = selectedDepartmentId
      setDepartments((prev) => prev.filter((d) => d.id !== deletedId))

      // Pick a new selection (if any) and refresh tree
      const remaining = departments.filter((d) => d.id !== deletedId)
      const nextId = remaining[0]?.id || ""
      setSelectedDepartmentId(nextId)
      if (nextId) {
        await refreshTree(nextId)
      } else {
        setTree([])
      }

      toast({
        title: "Departement supprime",
        description: "Le departement a ete supprime avec succes.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur suppression",
        description: error?.message || "Impossible de supprimer le departement.",
      })
    } finally {
      setDepartmentDeleteOpen(false)
      setIsSaving(false)
    }
  }

  const toggleExpanded = (categoryId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const openCreateDialog = (parentId: string | null) => {
    setEditorMode("create")
    setEditorParentId(parentId)
    setEditorCategoryId(null)
    setEditorState(initialEditorState())
    setEditorOpen(true)
  }

  const openEditDialog = (category: CategoryNode) => {
    setEditorMode("edit")
    setEditorParentId(category.parent_id)
    setEditorCategoryId(category.id)
    setEditorState({
      name_fr: category.name_fr,
      name_ar: category.name_ar,
      slug: category.slug,
      sort_order: category.sort_order || 0,
      is_active: category.is_active,
    })
    setEditorOpen(true)
  }

  const handleSave = async () => {
    if (!selectedDepartmentId) return
    if (!editorState.name_fr.trim() || !editorState.name_ar.trim() || !editorState.slug.trim()) {
      toast({
        variant: "destructive",
        title: "Validation",
        description: "name_fr, name_ar et slug sont obligatoires.",
      })
      return
    }

    setIsSaving(true)

    try {
      const normalizedSlug = slugify(editorState.slug)
      const slugExists = await adminSlugExists(
        normalizedSlug,
        selectedDepartmentId,
        editorMode === "edit" ? editorCategoryId || undefined : undefined
      )

      if (slugExists) {
        toast({
          variant: "destructive",
          title: "Slug deja utilise",
          description: "Ce slug existe deja dans ce departement.",
        })
        return
      }

      if (editorMode === "create") {
        const result = await adminCreateCategory({
          department_id: selectedDepartmentId,
          parent_id: editorParentId,
          name_fr: editorState.name_fr.trim(),
          name_ar: editorState.name_ar.trim(),
          slug: normalizedSlug,
          sort_order: Number(editorState.sort_order) || 0,
          is_active: editorState.is_active,
        })

        if (result && typeof result === "object" && "error" in result) {
          throw new Error(String(result.error))
        }
      } else if (editorCategoryId) {
        const result = await adminUpdateCategory(editorCategoryId, {
          name_fr: editorState.name_fr.trim(),
          name_ar: editorState.name_ar.trim(),
          slug: normalizedSlug,
          sort_order: Number(editorState.sort_order) || 0,
          is_active: editorState.is_active,
        })

        if (result && typeof result === "object" && "error" in result) {
          throw new Error(String(result.error))
        }
      }

      setEditorOpen(false)
      await refreshTree()
      toast({
        title: editorMode === "create" ? "Categorie creee" : "Categorie mise a jour",
        description: "La taxonomie a ete actualisee.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Impossible de sauvegarder la categorie.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (category: CategoryNode) => {
    setIsSaving(true)
    try {
      const result = await adminToggleCategoryActive(category.id, !category.is_active)
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String(result.error))
      }
      await refreshTree()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Impossible de changer l'etat de la categorie.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleMove = async (categoryId: string, direction: "up" | "down") => {
    setIsSaving(true)
    try {
      const result =
        direction === "up"
          ? await adminMoveCategoryUp(categoryId)
          : await adminMoveCategoryDown(categoryId)
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String(result.error))
      }
      await refreshTree()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Impossible de reordonner la categorie.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const requestDelete = (category: CategoryNode) => {
    setDeleteTarget(category)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsSaving(true)
    try {
      const check = await adminCanDeleteCategory(deleteTarget.id)
      if (!check || typeof check !== "object" || !("can" in check)) {
        throw new Error("Verification de suppression impossible.")
      }

      if (!check.can) {
        toast({
          variant: "destructive",
          title: "Suppression bloquee",
          description: check.reason || "Cette categorie ne peut pas etre supprimee.",
        })
        setDeleteOpen(false)
        setDeleteTarget(null)
        return
      }

      const result = await adminDeleteCategory(deleteTarget.id)
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String(result.error))
      }

      setDeleteOpen(false)
      setDeleteTarget(null)
      await refreshTree()
      toast({
        title: "Categorie supprimee",
        description: "La categorie a ete supprimee.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Impossible de supprimer la categorie.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const renderNode = (node: CategoryNode, level: number) => {
    const isExpanded = expandedIds.has(node.id)
    const canHaveChild = level < 2
    const hasChildren = node.children.length > 0

    return (
      <div key={node.id} className="space-y-1">
        <div
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
            node.is_active ? "border-border bg-card" : "border-border bg-muted/40"
          }`}
          style={{ marginLeft: `${level * 16}px` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7"
              onClick={() => toggleExpanded(node.id)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="w-7" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{node.name_fr}</p>
            <p className="truncate text-xs text-muted-foreground">/{node.slug}</p>
          </div>

          {!node.is_active && <Badge variant="outline">Inactif</Badge>}

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7"
              disabled={!canHaveChild || isSaving}
              title={canHaveChild ? "Ajouter un enfant" : "Niveau maximum atteint (3 niveaux)"}
              onClick={() => openCreateDialog(node.id)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7"
              disabled={isSaving}
              onClick={() => openEditDialog(node)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7"
              disabled={isSaving}
              onClick={() => handleToggleActive(node)}
            >
              <Power className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7"
              disabled={isSaving}
              onClick={() => handleMove(node.id, "up")}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7"
              disabled={isSaving}
              onClick={() => handleMove(node.id, "down")}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7 text-destructive"
              disabled={isSaving}
              onClick={() => requestDelete(node)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">{node.children.map((child) => renderNode(child, level + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Administrez la taxonomie par departement (niveaux 1 a 3).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={openDepartmentDialog} disabled={isSaving || isCreatingDepartment}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un departement
          </Button>
          <Button type="button" onClick={() => openCreateDialog(null)} disabled={!selectedDepartmentId || isSaving}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une categorie racine
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Arbre des categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label>Departement</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner un departement" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={openEditDepartmentDialog}
                disabled={!selectedDepartmentId || isSaving || isCreatingDepartment}
                title="Modifier le departement"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 text-destructive"
                onClick={requestDeleteDepartment}
                disabled={!selectedDepartmentId || isSaving || isCreatingDepartment}
                title="Supprimer le departement"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-[92%]" />
              <Skeleton className="h-12 w-[84%]" />
            </div>
          ) : tree.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aucune categorie dans ce departement. Utilisez le bouton ci-dessus pour creer la premiere categorie.
            </div>
          ) : (
            <div className="space-y-2">{tree.map((node) => renderNode(node, 0))}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={departmentEditorOpen} onOpenChange={setDepartmentEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{departmentEditorMode === "edit" ? "Modifier le departement" : "Ajouter un departement"}</DialogTitle>
            <DialogDescription>
              {departmentEditorMode === "edit"
                ? "Mettez a jour le nom, le slug ou l'image du departement."
                : "Creez un departement (section principale), puis ajoutez les categories et sous-categories."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>name_fr</Label>
              <Input
                className="mt-1.5"
                value={departmentEditorState.name_fr}
                onChange={(event) =>
                  setDepartmentEditorState((previous) => {
                    const value = event.target.value
                    return {
                      ...previous,
                      name_fr: value,
                      slug: previous.slug ? previous.slug : slugify(value),
                    }
                  })
                }
              />
            </div>
            <div>
              <Label>name_ar</Label>
              <Input
                className="mt-1.5"
                dir="rtl"
                value={departmentEditorState.name_ar}
                onChange={(event) =>
                  setDepartmentEditorState((previous) => ({ ...previous, name_ar: event.target.value }))
                }
              />
            </div>
            <div>
              <Label>slug</Label>
              <Input
                className="mt-1.5"
                value={departmentEditorState.slug}
                onChange={(event) =>
                  setDepartmentEditorState((previous) => ({ ...previous, slug: event.target.value }))
                }
              />
            </div>
            <div>
              <Label>image</Label>
              <Input
                className="mt-1.5"
                type="file"
                accept="image/*"
                onChange={handleDepartmentImageUpload}
                disabled={isUploadingDepartmentImage || isCreatingDepartment}
              />
              {isUploadingDepartmentImage && (
                <p className="mt-1 text-xs text-muted-foreground">Telechargement en cours...</p>
              )}
              {departmentEditorState.image_url ? (
                <div className="mt-3 rounded-lg border border-border bg-card p-2">
                  <img
                    src={departmentEditorState.image_url}
                    alt="Apercu departement"
                    className="h-20 w-full rounded-md object-cover"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDepartmentEditorState((previous) => ({ ...previous, image_url: "" }))
                      }
                    >
                      Supprimer l'image
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Selectionnez une image depuis votre appareil.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">is_active</p>
                <p className="text-xs text-muted-foreground">Desactivez pour masquer ce departement du menu.</p>
              </div>
              <Button
                type="button"
                variant={departmentEditorState.is_active ? "default" : "outline"}
                onClick={() =>
                  setDepartmentEditorState((previous) => ({ ...previous, is_active: !previous.is_active }))
                }
              >
                {departmentEditorState.is_active ? "Actif" : "Inactif"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDepartmentEditorOpen(false)}
              disabled={isCreatingDepartment || isUploadingDepartmentImage}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={departmentEditorMode === "edit" ? handleUpdateDepartment : handleCreateDepartment}
              disabled={isCreatingDepartment || isUploadingDepartmentImage}
            >
              {isCreatingDepartment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {departmentEditorMode === "edit" ? "Enregistrer" : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={departmentDeleteOpen} onOpenChange={setDepartmentDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le departement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action peut supprimer des categories et des produits associes. Si des produits sont lies a des commandes,
              la suppression sera refusee. Dans ce cas, desactivez le departement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDepartment} disabled={isSaving}>
              {isSaving ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editorMode === "create" ? "Ajouter une categorie" : "Modifier la categorie"}</DialogTitle>
            <DialogDescription>
              {editorMode === "create"
                ? editorParentId
                  ? "Cette categorie sera creee comme enfant."
                  : "Cette categorie sera creee a la racine."
                : "Mettez a jour les informations puis enregistrez."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>name_fr</Label>
              <Input
                className="mt-1.5"
                value={editorState.name_fr}
                onChange={(event) =>
                  setEditorState((previous) => {
                    const value = event.target.value
                    return {
                      ...previous,
                      name_fr: value,
                      slug: previous.slug ? previous.slug : slugify(value),
                    }
                  })
                }
              />
            </div>
            <div>
              <Label>name_ar</Label>
              <Input
                className="mt-1.5"
                dir="rtl"
                value={editorState.name_ar}
                onChange={(event) => setEditorState((previous) => ({ ...previous, name_ar: event.target.value }))}
              />
            </div>
            <div>
              <Label>slug</Label>
              <Input
                className="mt-1.5"
                value={editorState.slug}
                onChange={(event) => setEditorState((previous) => ({ ...previous, slug: event.target.value }))}
              />
            </div>
            <div>
              <Label>sort_order</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={editorState.sort_order}
                onChange={(event) =>
                  setEditorState((previous) => ({
                    ...previous,
                    sort_order: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">is_active</p>
                <p className="text-xs text-muted-foreground">Desactivez pour masquer sans supprimer.</p>
              </div>
              <Button
                type="button"
                variant={editorState.is_active ? "default" : "outline"}
                onClick={() => setEditorState((previous) => ({ ...previous, is_active: !previous.is_active }))}
              >
                {editorState.is_active ? "Actif" : "Inactif"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la categorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              La suppression est bloquee si la categorie contient des enfants ou des produits. Pour un retrait sans
              risque, utilisez plutot Disable/Enable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isSaving && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Mise a jour en cours...
        </div>
      )}
    </div>
  )
}
