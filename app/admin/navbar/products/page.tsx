"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X, Search, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getAllCustomPages,
  getPageProducts,
  addProductToPage,
  removeProductFromPage,
} from "@/app/admin/navbar/actions";
import { getProducts } from "@/app/(store)/actions";

interface CustomPage {
  id: string;
  slug: string;
  title_ar: string;
  title_fr: string;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  image_url?: string;
}

interface PageProduct {
  id: string;
  page_id: string;
  product_id: string;
  sort_order: number;
  products: Product;
}

export default function AdminPageProductsPage() {
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [pageProducts, setPageProducts] = useState<PageProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Load pages and products
  useEffect(() => {
    loadData();
  }, []);

  // Debug logging
  useEffect(() => {
    if (allProducts.length > 0) {
      console.log("✅ Products loaded:", allProducts.length, allProducts);
    }
  }, [allProducts]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pagesResult, productsResult] = await Promise.all([
        getAllCustomPages(),
        getProducts(),
      ]);

      if (pagesResult.data) {
        setPages(pagesResult.data as CustomPage[]);
        if (pagesResult.data.length > 0) {
          setSelectedPageId(pagesResult.data[0].id);
        }
      }

      if (productsResult) {
        // Handle different response formats
        let products = [];
        if (Array.isArray(productsResult)) {
          products = productsResult;
        } else if (
          productsResult.products &&
          Array.isArray(productsResult.products)
        ) {
          products = productsResult.products;
        }

        const productList = products.map((p: any) => ({
          id: p.id,
          name: p.title_fr || p.title_ar || "Unknown",
          sku: p.sku,
          image_url: p.image_url,
        }));
        setAllProducts(productList);
        console.log("Loaded products:", productList.length);
      }
    } catch (error) {
      toast.error("Failed to load data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Load page products when selected page changes
  useEffect(() => {
    if (selectedPageId) {
      loadPageProducts();
    }
  }, [selectedPageId]);

  const loadPageProducts = async () => {
    if (!selectedPageId) return;

    try {
      const result = await getPageProducts(selectedPageId);
      if (result.data) {
        setPageProducts(result.data as PageProduct[]);
      }
    } catch (error) {
      toast.error("Failed to load page products");
      console.error(error);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedPageId || !selectedProductId) {
      toast.error("Please select a product");
      return;
    }

    // Check if product already exists in page
    if (pageProducts.some((pp) => pp.product_id === selectedProductId)) {
      toast.error("Product already added to this page");
      return;
    }

    setIsAddingProduct(true);
    try {
      const result = await addProductToPage(
        selectedPageId,
        selectedProductId,
        pageProducts.length,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Product added to page");
      await loadPageProducts();
      setSelectedProductId("");
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to add product");
      console.error(error);
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleRemoveProduct = async (pageId: string, productId: string) => {
    if (!confirm("Are you sure you want to remove this product?")) return;

    try {
      const result = await removeProductFromPage(pageId, productId);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Product removed");
      await loadPageProducts();
    } catch (error) {
      toast.error("Failed to remove product");
      console.error(error);
    }
  };

  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const filteredProducts = allProducts.filter((p) => {
    const notAdded = !pageProducts.some((pp) => pp.product_id === p.id);
    const productName = (p.name || "").toLowerCase();
    const productSku = (p.sku || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      productName.includes(query) || productSku.includes(query);
    return notAdded && matchesSearch;
  });

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Page Products</CardTitle>
          <CardDescription>
            Add and manage products for your custom pages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Page Selection */}
          <div>
            <Label htmlFor="page-select">Select Page *</Label>
            <Select value={selectedPageId} onValueChange={setSelectedPageId}>
              <SelectTrigger id="page-select">
                <SelectValue placeholder="Choose a page" />
              </SelectTrigger>
              <SelectContent>
                {pages.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.title_fr} ({page.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page Info */}
          {selectedPage && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedPage.title_fr}</p>
                  <p className="text-sm text-muted-foreground">
                    /{selectedPage.slug}
                  </p>
                </div>
                <Badge
                  variant={selectedPage.is_active ? "default" : "secondary"}
                >
                  {selectedPage.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          )}

          {/* Products in Page */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <Label>Products in Page ({pageProducts.length})</Label>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Product to Page</DialogTitle>
                    <DialogDescription>
                      Select a product to add to {selectedPage?.title_fr}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* Search */}
                    <div>
                      <Label htmlFor="search">Search Products</Label>
                      <Input
                        id="search"
                        placeholder="Search by name or SKU..."
                        value={searchQuery}
                        onChange={(e) => {
                          const query = e.target.value;
                          setSearchQuery(query);
                          console.log("Search query:", query);
                          console.log("Available products:", allProducts);
                        }}
                      />
                    </div>

                    {/* Products List */}
                    <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-border p-4">
                      {filteredProducts.length === 0 ? (
                        <div className="space-y-2 text-center text-sm text-muted-foreground">
                          {searchQuery ? (
                            <>
                              <p>No products found matching "{searchQuery}"</p>
                              <p className="text-xs">
                                Try a different search term
                              </p>
                            </>
                          ) : allProducts.length === 0 ? (
                            <>
                              <p>No products available</p>
                              <p className="text-xs">
                                Create some products first
                              </p>
                            </>
                          ) : (
                            <>
                              <p>All products already added to this page</p>
                              <p className="text-xs">
                                Or remove some to add different ones
                              </p>
                            </>
                          )}
                        </div>
                      ) : (
                        filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2 hover:bg-muted"
                            onClick={() => setSelectedProductId(product.id)}
                          >
                            <input
                              type="radio"
                              name="product"
                              checked={selectedProductId === product.id}
                              onChange={() => setSelectedProductId(product.id)}
                              className="h-4 w-4"
                            />
                            <div className="flex-1">
                              {product.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="mr-2 inline-block h-8 w-8 rounded object-cover"
                                />
                              )}
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {product.sku}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        onClick={handleAddProduct}
                        disabled={isAddingProduct || !selectedProductId}
                        className="flex-1"
                      >
                        {isAddingProduct ? "Adding..." : "Add Product"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {pageProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No products added to this page yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pageProducts.map((pageProduct, index) => (
                  <div
                    key={pageProduct.id}
                    className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      #{index + 1}
                    </span>
                    {pageProduct.products?.image_url && (
                      <img
                        src={pageProduct.products.image_url}
                        alt={pageProduct.products.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {pageProduct.products?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pageProduct.products?.sku}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        handleRemoveProduct(
                          pageProduct.page_id,
                          pageProduct.product_id,
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
            <li>Select a custom page from the dropdown above</li>
            <li>Click "Add Product" to select products for this page</li>
            <li>Products will appear on the page in the order you add them</li>
            <li>A product can be added to multiple pages</li>
            <li>Remove a product by clicking the delete button</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
