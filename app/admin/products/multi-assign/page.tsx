"use client"

import { useState, useEffect } from "react"
import { getProducts } from "@/app/(store)/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import ProductMultiCategoryDepartmentManager from "../multi-category-department"
import { toast } from "sonner"

interface Product {
  id: string
  title_fr: string
  slug: string
  sku: string
}

export default function AdminProductMultiAssignPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const result = await getProducts({ limit: 1000 })
      const productList = result.products || []
      setProducts(
        productList.map((p: any) => ({
          id: p.id,
          title_fr: p.title_fr || "Unknown",
          slug: p.slug,
          sku: p.sku,
        }))
      )
    } catch (error) {
      toast.error("Failed to load products")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      (p.title_fr || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Product to Multiple Categories & Departments</CardTitle>
          <CardDescription>
            Select a product to manage its categories and departments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product Selection */}
          <div className="space-y-4">
            <Label htmlFor="product-search">Select Product *</Label>
            <Input
              id="product-search"
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />

            {/* Product List */}
            {searchQuery && filteredProducts.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProductId(product.id)
                      setSearchQuery("")
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedProductId === product.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium">{product.title_fr}</div>
                    <div className="text-xs text-muted-foreground">{product.sku}</div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && filteredProducts.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No products found
              </div>
            )}

            {/* Selected Product Info */}
            {selectedProduct && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="space-y-1">
                  <p className="font-semibold">{selectedProduct.title_fr}</p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.sku}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Manager */}
      {selectedProduct && (
        <ProductMultiCategoryDepartmentManager
          productId={selectedProduct.id}
          productName={selectedProduct.title_fr}
        />
      )}
    </div>
  )
}
