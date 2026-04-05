'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  SlidersHorizontal, Grid3X3, List, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ProductCard } from '@/components/store/product-card';
import { useLocale } from '@/lib/locale-context';
import { getProducts, getDepartments, getBrands } from '@/app/(store)/actions';

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
  }).format(price);
}

function ShopPageContent() {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const [sortBy, setSortBy] = useState('popular');
  const [priceRange, setPriceRange] = useState([0, 400000]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const toUiProduct = (product: any) => ({
    id: product.id,
    slug: product.slug,
    name: {
      fr: product.title_fr || '',
      ar: product.title_ar || product.title_fr || '',
    },
    description: {
      fr: product.description_fr || '',
      ar: product.description_ar || product.description_fr || '',
    },
    price: product.price_dzd || 0,
    compareAtPrice: product.compare_at_price_dzd || undefined,
    images: (product.product_images || []).map((image: any) => image.url),
    category: product.categories?.slug || '',
    department: product.departments?.slug || '',
    brand: product.brands?.name || '',
    rating: 5,
    reviewCount: 0,
    inStock: (product.stock || 0) > 0,
    stockCount: product.stock || 0,
    specs: {},
    tags: [],
    isNew: false,
    isBestSeller: Boolean(product.is_featured),
    isDeal: Boolean(product.compare_at_price_dzd && product.compare_at_price_dzd > product.price_dzd),
    department_id: product.department_id,
    category_id: product.category_id,
    brand_id: product.brand_id,
    price_dzd: product.price_dzd || 0,
  });

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [productsData, deptsData, brandsData] = await Promise.all([
          getProducts(),
          getDepartments(),
          getBrands(),
        ]);
        const normalizedProducts = (productsData?.products || []).map(toUiProduct);
        setProducts(normalizedProducts);
        setDepartments(deptsData || []);
        setBrands(brandsData || []);
      } catch (error) {
        console.error('Failed to load shop data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (departments.length === 0) return;

    const departmentParam = searchParams.get('department');
    if (!departmentParam) return;

    const match =
      departments.find((department) => department.id === departmentParam) ||
      departments.find((department) => department.slug === departmentParam);

    if (match) {
      setSelectedDept(match.id);
    }
  }, [departments, searchParams]);

  useEffect(() => {
    if (brands.length === 0) return;

    const brandParam = searchParams.get('brand');
    if (!brandParam) return;

    const tokens = brandParam
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const matchedIds = tokens
      .map((token) => brands.find((brand) => brand.id === token || brand.slug === token)?.id)
      .filter(Boolean) as string[];

    if (matchedIds.length > 0) {
      setSelectedBrands(Array.from(new Set(matchedIds)));
    }
  }, [brands, searchParams]);

  const filtered = useMemo(() => {
    let result = [...products];
    if (selectedDept) {
      result = result.filter((p) => p.department_id === selectedDept);
    }
    if (selectedBrands.length > 0) {
      result = result.filter((p) => selectedBrands.includes(p.brand_id));
    }
    result = result.filter(
      (p) => p.price_dzd >= priceRange[0] && p.price_dzd <= priceRange[1]
    );
    switch (sortBy) {
      case 'priceLow':
        result.sort((a, b) => a.price_dzd - b.price_dzd);
        break;
      case 'priceHigh':
        result.sort((a, b) => b.price_dzd - a.price_dzd);
        break;
      case 'rating':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }
    return result;
  }, [sortBy, priceRange, selectedBrands, selectedDept, products]);

  const toggleBrand = (brandId: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandId) ? prev.filter((b) => b !== brandId) : [...prev, brandId]
    );
  };

  const clearAll = () => {
    setSelectedBrands([]);
    setSelectedDept(null);
    setPriceRange([0, 400000]);
  };

  const activeFilters = selectedBrands.length + (selectedDept ? 1 : 0);

  const FilterSidebar = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-bold text-foreground">Filtres</h3>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-primary">
            Réinitialiser
          </Button>
        )}
      </div>

      <Accordion type="multiple" defaultValue={['dept', 'brand', 'price']} className="w-full">
        <AccordionItem value="dept">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            Département
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-2">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() =>
                    setSelectedDept(selectedDept === dept.id ? null : dept.id)
                  }
                  className={`rounded-md px-2.5 py-1.5 text-start text-sm transition-colors ${
                    selectedDept === dept.id
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {dept.name_fr}
                </button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="brand">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            Marque
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-2">
              {brands.slice(0, 10).map((brand) => (
                <label key={brand.id} className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={selectedBrands.includes(brand.id)}
                    onCheckedChange={() => toggleBrand(brand.id)}
                  />
                  <span className="text-sm text-foreground">{brand.name}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            Gamme de prix
          </AccordionTrigger>
          <AccordionContent>
            <Slider
              min={0}
              max={400000}
              step={5000}
              value={priceRange}
              onValueChange={setPriceRange}
              className="mt-2"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatPrice(priceRange[0])}</span>
              <span>{formatPrice(priceRange[1])}</span>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            Boutique
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} produit(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile Filters */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-4 w-4" />
                Filtres
                {activeFilters > 0 && (
                  <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-[10px]">
                    {activeFilters}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto bg-card">
              <SheetTitle className="sr-only">Filtres</SheetTitle>
              <div className="mt-6">
                <FilterSidebar />
              </div>
            </SheetContent>
          </Sheet>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Populaire</SelectItem>
              <SelectItem value="priceLow">Prix croissant</SelectItem>
              <SelectItem value="priceHigh">Prix décroissant</SelectItem>
              <SelectItem value="rating">Mieux notés</SelectItem>
            </SelectContent>
          </Select>

          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => setViewMode('grid')}
              aria-label="Grille"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => setViewMode('list')}
              aria-label="Liste"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {activeFilters > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {selectedDept && (
            <Badge variant="secondary" className="gap-1">
              {departments.find((d) => d.id === selectedDept)?.name_fr}
              <button onClick={() => setSelectedDept(null)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedBrands.map((brandId) => (
            <Badge key={brandId} variant="secondary" className="gap-1">
              {brands.find((b) => b.id === brandId)?.name || brandId}
              <button onClick={() => toggleBrand(brandId)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-destructive">
            Réinitialiser
          </Button>
        </div>
      )}

      {/* Layout */}
      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <FilterSidebar />
        </aside>

        {/* Products */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
              <p className="text-lg font-semibold text-foreground">
                Aucun produit trouvé
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Essayez de modifier vos filtres
              </p>
              <Button variant="outline" className="mt-4" onClick={clearAll}>
                Réinitialiser
              </Button>
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
                  : 'flex flex-col gap-4'
              }
            >
              {filtered.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShopSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopSkeleton />}>
      <ShopPageContent />
    </Suspense>
  );
}
