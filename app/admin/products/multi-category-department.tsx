"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Grid3x3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { toast } from "sonner"
import {
  getProductCategories,
  addProductCategory,
  removeProductCategory,
  getProductDepartments,
  addProductDepartment,
  removeProductDepartment,
  getAllCategories,
  getAllDepartments,
} from "@/app/admin/products/actions"

interface Category {
  id: string
  slug: string
  name_fr: string
  name_ar: string
}

interface Department {
  id: string
  slug: string
  name_fr: string
  name_ar: string
}

interface ProductCategoryLink {
  id: string
  product_id: string
  category_id: string
  sort_order: number
  categories: Category
}

interface ProductDepartmentLink {
  id: string
  product_id: string
  department_id: string
  sort_order: number
  departments: Department
}

interface Props {
  productId: string
  productName: string
}

export default function ProductMultiCategoryDepartmentManager({ productId, productName }: Props) {
  const [categories, setCategories] = useState<ProductCategoryLink[]>([])
  const [departments, setDepartments] = useState<ProductDepartmentLink[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [allDepartments, setAllDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("")
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    loadData()
  }, [productId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [catResult, deptResult, allCatResult, allDeptResult] = await Promise.all([
        getProductCategories(productId),
        getProductDepartments(productId),
        getAllCategories(),
        getAllDepartments(),
      ])

      if (catResult.data) setCategories(catResult.data as ProductCategoryLink[])
      if (deptResult.data) setDepartments(deptResult.data as ProductDepartmentLink[])
      if (allCatResult.data) setAllCategories(allCatResult.data as Category[])
      if (allDeptResult.data) setAllDepartments(allDeptResult.data as Department[])
    } catch (error) {
      toast.error("Failed to load data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // ============ CATEGORY HANDLERS ============

  const handleAddCategory = async () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category")
      return
    }

    if (categories.some((c) => c.category_id === selectedCategoryId)) {
      toast.error("Category already added")
      return
    }

    setIsAdding(true)
    try {
      const result = await addProductCategory(productId, selectedCategoryId, categories.length)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Category added")
      await loadData()
      setSelectedCategoryId("")
      setIsCategoryDialogOpen(false)
    } catch (error) {
      toast.error("Failed to add category")
      console.error(error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveCategory = async (categoryId: string) => {
    if (!confirm("Remove this category?")) return

    try {
      const result = await removeProductCategory(productId, categoryId)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Category removed")
      await loadData()
    } catch (error) {
      toast.error("Failed to remove category")
      console.error(error)
    }
  }

  // ============ DEPARTMENT HANDLERS ============

  const handleAddDepartment = async () => {
    if (!selectedDepartmentId) {
      toast.error("Please select a department")
      return
    }

    if (departments.some((d) => d.department_id === selectedDepartmentId)) {
      toast.error("Department already added")
      return
    }

    setIsAdding(true)
    try {
      const result = await addProductDepartment(productId, selectedDepartmentId, departments.length)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Department added")
      await loadData()
      setSelectedDepartmentId("")
      setIsDepartmentDialogOpen(false)
    } catch (error) {
      toast.error("Failed to add department")
      console.error(error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveDepartment = async (departmentId: string) => {
    if (!confirm("Remove this department?")) return

    try {
      const result = await removeProductDepartment(productId, departmentId)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Department removed")
      await loadData()
    } catch (error) {
      toast.error("Failed to remove department")
      console.error(error)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  const availableCategories = allCategories.filter(
    (c) => !categories.some((pc) => pc.category_id === c.id)
  )

  const availableDepartments = allDepartments.filter(
    (d) => !departments.some((pd) => pd.department_id === d.id)
  )

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Product Categories & Departments</CardTitle>
          <CardDescription>Add {productName} to multiple categories and departments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CATEGORIES SECTION */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <Label className="text-lg font-semibold">Categories ({categories.length})</Label>
              <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Category to Product</DialogTitle>
                    <DialogDescription>Select a category to add</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name_fr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {availableCategories.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        All categories already added
                      </p>
                    )}

                    <div className="flex gap-3">
                      <Button
                        onClick={handleAddCategory}
                        disabled={isAdding || !selectedCategoryId}
                        className="flex-1"
                      >
                        {isAdding ? "Adding..." : "Add"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsCategoryDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {categories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No categories added yet</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge key={cat.id} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                    {cat.categories.name_fr}
                    <button
                      onClick={() => handleRemoveCategory(cat.category_id)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* DEPARTMENTS SECTION */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <Label className="text-lg font-semibold">Departments ({departments.length})</Label>
              <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Department
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Department to Product</DialogTitle>
                    <DialogDescription>Select a department to add</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a department" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDepartments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name_fr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {availableDepartments.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        All departments already added
                      </p>
                    )}

                    <div className="flex gap-3">
                      <Button
                        onClick={handleAddDepartment}
                        disabled={isAdding || !selectedDepartmentId}
                        className="flex-1"
                      >
                        {isAdding ? "Adding..." : "Add"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsDepartmentDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {departments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No departments added yet</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <Badge key={dept.id} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                    {dept.departments.name_fr}
                    <button
                      onClick={() => handleRemoveDepartment(dept.department_id)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ℹ️ How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            <li>A product can appear in multiple categories</li>
            <li>A product can appear in multiple departments</li>
            <li>The product will be searchable and filterable by all added categories and departments</li>
            <li>Remove items by clicking the × on the badge</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
