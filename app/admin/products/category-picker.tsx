"use client"

import { useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { adminGetCategoriesByDepartment, adminGetCategoryPath } from "@/app/admin/actions"
import { AddCategoryDialog } from "./add-category-dialog"

interface CategoryLevel {
  id: string
  name_fr: string
  name_ar: string
}

interface CategoryPickerProps {
  departmentId?: string
  selectedCategoryId?: string | null
  onCategoryChange: (categoryId: string | null) => void
  onAddCategory?: (newCategoryId: string) => void
}

export function CategoryPicker({
  departmentId,
  selectedCategoryId,
  onCategoryChange,
  onAddCategory,
}: CategoryPickerProps) {
  const [level1, setLevel1] = useState<CategoryLevel[]>([])
  const [level2, setLevel2] = useState<CategoryLevel[]>([])
  const [level3, setLevel3] = useState<CategoryLevel[]>([])

  const [selected1, setSelected1] = useState("")
  const [selected2, setSelected2] = useState("")
  const [selected3, setSelected3] = useState("")

  const [loading1, setLoading1] = useState(false)
  const [loading2, setLoading2] = useState(false)
  const [loading3, setLoading3] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const loadLevel1 = async (deptId: string) => {
    try {
      setLoading1(true)
      const categories = await adminGetCategoriesByDepartment(deptId, null)
      setLevel1(Array.isArray(categories) ? categories : [])
    } catch (error) {
      console.error("Failed to load level 1 categories:", error)
      setLevel1([])
    } finally {
      setLoading1(false)
    }
  }

  const loadLevel2 = async (deptId: string, parentId: string) => {
    try {
      setLoading2(true)
      const categories = await adminGetCategoriesByDepartment(deptId, parentId)
      setLevel2(Array.isArray(categories) ? categories : [])
    } catch (error) {
      console.error("Failed to load level 2 categories:", error)
      setLevel2([])
    } finally {
      setLoading2(false)
    }
  }

  const loadLevel3 = async (deptId: string, parentId: string) => {
    try {
      setLoading3(true)
      const categories = await adminGetCategoriesByDepartment(deptId, parentId)
      setLevel3(Array.isArray(categories) ? categories : [])
    } catch (error) {
      console.error("Failed to load level 3 categories:", error)
      setLevel3([])
    } finally {
      setLoading3(false)
    }
  }

  const prefillFromCategory = async (categoryId: string) => {
    try {
      const path = await adminGetCategoryPath(categoryId)
      if (path.length > 0) {
        setSelected1(path[0].id)
      }
      if (path.length > 1) {
        setSelected2(path[1].id)
      }
      if (path.length > 2) {
        setSelected3(path[2].id)
      }
    } catch (error) {
      console.error("Failed to prefill category path:", error)
    }
  }

  useEffect(() => {
    setSelected1("")
    setSelected2("")
    setSelected3("")
    setLevel1([])
    setLevel2([])
    setLevel3([])

    if (!departmentId) return
    void loadLevel1(departmentId)
  }, [departmentId])

  useEffect(() => {
    if (!departmentId || !selectedCategoryId) return
    void prefillFromCategory(selectedCategoryId)
  }, [departmentId, selectedCategoryId])

  useEffect(() => {
    if (!departmentId) return

    if (!selected1) {
      setLevel2([])
      setLevel3([])
      setSelected2("")
      setSelected3("")
      return
    }

    setSelected2("")
    setSelected3("")
    setLevel3([])
    void loadLevel2(departmentId, selected1)
  }, [selected1, departmentId])

  useEffect(() => {
    if (!departmentId) return

    if (!selected2) {
      setLevel3([])
      setSelected3("")
      return
    }

    setSelected3("")
    void loadLevel3(departmentId, selected2)
  }, [selected2, departmentId])

  useEffect(() => {
    const deepest = selected3 || selected2 || selected1 || null
    onCategoryChange(deepest)
  }, [selected1, selected2, selected3, onCategoryChange])

  const clearTaxonomy = () => {
    setSelected1("")
    setSelected2("")
    setSelected3("")
  }

  const handleCategoryAdded = async (newCategoryId: string) => {
    setShowAddDialog(false)

    if (departmentId) {
      await loadLevel1(departmentId)
      await prefillFromCategory(newCategoryId)
    }

    onAddCategory?.(newCategoryId)
  }

  if (!departmentId) {
    return <div className="text-sm text-muted-foreground">Select a department first</div>
  }

  return (
    <Card className="border-border p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Taxonomy</h3>
          <Button variant="ghost" size="sm" onClick={clearTaxonomy} className="h-8 px-2 text-xs">
            <X className="mr-1 h-3 w-3" />
            Clear taxonomy
          </Button>
        </div>

        <div>
          <Label className="text-xs">Category</Label>
          {loading1 ? (
            <Skeleton className="mt-1.5 h-9" />
          ) : (
            <Select value={selected1} onValueChange={setSelected1}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {level1.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name_fr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selected1 && (
          <div>
            <Label className="text-xs">Subcategory</Label>
            {loading2 ? (
              <Skeleton className="mt-1.5 h-9" />
            ) : level2.length > 0 ? (
              <Select value={selected2} onValueChange={setSelected2}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choose a subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {level2.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1.5 text-xs text-muted-foreground">No subcategory available</div>
            )}
          </div>
        )}

        {selected2 && (
          <div>
            <Label className="text-xs">Sub-subcategory</Label>
            {loading3 ? (
              <Skeleton className="mt-1.5 h-9" />
            ) : level3.length > 0 ? (
              <Select value={selected3} onValueChange={setSelected3}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choose a sub-subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {level3.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1.5 text-xs text-muted-foreground">No sub-subcategory available</div>
            )}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Add category
        </Button>
      </div>

      {showAddDialog && (
        <AddCategoryDialog
          departmentId={departmentId}
          parentId={selected2 || selected1 || null}
          onClose={() => setShowAddDialog(false)}
          onCategoryAdded={handleCategoryAdded}
        />
      )}
    </Card>
  )
}
