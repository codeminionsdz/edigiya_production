'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Grid3X3, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ProductCard } from '@/components/store/product-card';
import { useLocale } from '@/lib/locale-context';
import { getProducts, getDepartments, getBrands } from '@/app/(store)/actions';

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(price);
}

function ShopPageContent() {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
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
    id: product.id, slug: product.slug,
    name: { fr: product.title_fr || '', ar: product.title_ar || product.title_fr || '' },
    description: { fr: product.description_fr || '', ar: product.description_ar || product.description_fr || '' },
    price: product.price_dzd || 0, compareAtPrice: product.compare_at_price_dzd || undefined,
    images: (product.product_images || []).map((image: any) => image.url),
    category: product.categories?.slug || '', department: product.departments?.slug || '', brand: product.brands?.name || '',
    rating: 5, reviewCount: 0, inStock: (product.stock || 0) > 0, stockCount: product.stock || 0,
    specs: {}, tags: [], isNew: false, isBestSeller: Boolean(product.is_featured),
    isDeal: Boolean(product.compare_at_price_dzd && product.compare_at_price_dzd > product.price_dzd),
    department_id: product.department_id, category_id: product.category_id, brand_id: product.brand_id, price_dzd: product.price_dzd || 0,
  });

  useEffect(() => {
    setQuery(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [productsData, deptsData, brandsData] = await Promise.all([getProducts(), getDepartments(), getBrands()]);
        setProducts((productsData?.products || []).map(toUiProduct));
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
    const match = departments.find((department) => department.id === departmentParam) || departments.find((department) => department.slug === departmentParam);
    if (match) setSelectedDept(match.id);
  }, [departments, searchParams]);

  useEffect(() => {
    if (brands.length === 0) return;
    const brandParam = searchParams.get('brand');
    if (!brandParam) return;
    const tokens = brandParam.split(',').map((value) => value.trim()).filter(Boolean);
    const matchedIds = tokens.map((token) => brands.find((brand) => brand.id === token || brand.slug === token)?.id).filter(Boolean) as string[];
    if (matchedIds.length > 0) setSelectedBrands(Array.from(new Set(matchedIds)));
  }, [brands, searchParams]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    let result = products.filter((p) => {
      const searchable = [p.name?.[locale] || p.name?.fr, p.description?.[locale] || p.description?.fr, p.brand, p.category].join(' ').toLocaleLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && (!selectedDept || p.department_id === selectedDept) && (selectedBrands.length === 0 || selectedBrands.includes(p.brand_id)) && p.price_dzd >= priceRange[0] && p.price_dzd <= priceRange[1];
    });
    if (sortBy === 'priceLow') result.sort((a, b) => a.price_dzd - b.price_dzd);
    if (sortBy === 'priceHigh') result.sort((a, b) => b.price_dzd - a.price_dzd);
    if (sortBy === 'rating') result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return result;
  }, [locale, priceRange, products, query, selectedBrands, selectedDept, sortBy]);

  const toggleBrand = (brandId: string) => setSelectedBrands((prev) => prev.includes(brandId) ? prev.filter((b) => b !== brandId) : [...prev, brandId]);
  const clearAll = () => { setQuery(''); setSelectedBrands([]); setSelectedDept(null); setPriceRange([0, 400000]); };
  const activeFilters = selectedBrands.length + (selectedDept ? 1 : 0) + (query ? 1 : 0);

  const FilterSidebar = () => (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
        <h2 className="font-heading text-base font-semibold text-foreground">Filtrer</h2>
        {activeFilters > 0 && <button onClick={clearAll} className="text-xs font-medium text-primary hover:underline">Réinitialiser</button>}
      </div>
      <Accordion type="multiple" defaultValue={['dept', 'brand', 'price']} className="w-full">
        <AccordionItem value="dept"><AccordionTrigger className="text-sm font-semibold">Département</AccordionTrigger><AccordionContent><div className="flex flex-col gap-1">
          {departments.map((dept) => <button key={dept.id} onClick={() => setSelectedDept(selectedDept === dept.id ? null : dept.id)} className={`px-2 py-2 text-start text-sm transition-colors ${selectedDept === dept.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{dept.name_fr}</button>)}
        </div></AccordionContent></AccordionItem>
        <AccordionItem value="brand"><AccordionTrigger className="text-sm font-semibold">Marque</AccordionTrigger><AccordionContent><div className="flex flex-col gap-2">
          {brands.slice(0, 10).map((brand) => <label key={brand.id} className="flex cursor-pointer items-center gap-2.5"><Checkbox checked={selectedBrands.includes(brand.id)} onCheckedChange={() => toggleBrand(brand.id)} /><span className="text-sm">{brand.name}</span></label>)}
        </div></AccordionContent></AccordionItem>
        <AccordionItem value="price"><AccordionTrigger className="text-sm font-semibold">Gamme de prix</AccordionTrigger><AccordionContent><Slider min={0} max={400000} step={5000} value={priceRange} onValueChange={setPriceRange} className="mt-2" /><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{formatPrice(priceRange[0])}</span><span>{formatPrice(priceRange[1])}</span></div></AccordionContent></AccordionItem>
      </Accordion>
    </div>
  );

  if (isLoading) return <ShopSkeleton />;

  return (
    <main dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
      <header className="max-w-3xl">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">Edigiya</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{ar ? 'المتجر.' : 'La boutique.'}</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">Découvrez nos offres et trouvez simplement ce qui vous correspond.</p>
      </header>

      <div className="mt-9 max-w-2xl">
        <label htmlFor="shop-search" className="sr-only">{ar ? 'البحث عن منتج' : 'Rechercher une offre'}</label>
        <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input id="shop-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une offre, une marque..." className="h-14 w-full border border-[hsl(var(--border))] bg-card pl-11 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" />{query && <button aria-label="Effacer la recherche" onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}</div>
      </div>

      <nav aria-label="Catégories" className="mt-9 overflow-x-auto border-y border-[hsl(var(--border))] scrollbar-hide"><div className="flex min-w-max gap-7 py-4">
        <button onClick={() => setSelectedDept(null)} className={`text-sm ${!selectedDept ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Toutes les offres</button>
        {departments.map((dept) => <button key={dept.id} onClick={() => setSelectedDept(selectedDept === dept.id ? null : dept.id)} className={`text-sm ${selectedDept === dept.id ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{dept.name_fr}</button>)}
      </div></nav>

      <div className="mt-7 flex flex-col gap-4 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><Sheet open={filtersOpen} onOpenChange={setFiltersOpen}><SheetTrigger asChild><Button variant="outline" className="gap-2 lg:hidden"><SlidersHorizontal className="h-4 w-4" />Filtrer{activeFilters > 0 && <Badge className="h-5 min-w-5 rounded-full px-1 text-[10px]">{activeFilters}</Badge>}</Button></SheetTrigger><SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto bg-card"><SheetTitle className="sr-only">Filtres de la boutique</SheetTitle><div className="mt-4"><FilterSidebar /></div></SheetContent></Sheet><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{filtered.length}</span> offre{filtered.length === 1 ? '' : 's'}</p></div>
        <div className="flex items-center gap-2"><Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="h-9 w-40 border-0 bg-transparent text-xs shadow-none"><SelectValue placeholder="Trier par" /></SelectTrigger><SelectContent><SelectItem value="popular">Pertinence</SelectItem><SelectItem value="priceLow">Prix croissant</SelectItem><SelectItem value="priceHigh">Prix décroissant</SelectItem><SelectItem value="rating">Mieux notées</SelectItem></SelectContent></Select><div className="hidden items-center border-l border-[hsl(var(--border))] pl-2 sm:flex"><Button variant="ghost" size="icon" className={`h-8 w-8 ${viewMode === 'grid' ? 'text-primary' : 'text-muted-foreground'}`} onClick={() => setViewMode('grid')} aria-label="Vue grille"><Grid3X3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className={`h-8 w-8 ${viewMode === 'list' ? 'text-primary' : 'text-muted-foreground'}`} onClick={() => setViewMode('list')} aria-label="Vue liste"><List className="h-4 w-4" /></Button></div></div>
      </div>

      {activeFilters > 0 && <div className="flex flex-wrap items-center gap-2 py-5">{query && <Badge variant="secondary" className="gap-1">Recherche : {query}<button onClick={() => setQuery('')} aria-label="Retirer la recherche"><X className="h-3 w-3" /></button></Badge>}{selectedDept && <Badge variant="secondary" className="gap-1">{departments.find((d) => d.id === selectedDept)?.name_fr}<button onClick={() => setSelectedDept(null)} aria-label="Retirer le département"><X className="h-3 w-3" /></button></Badge>}{selectedBrands.map((brandId) => <Badge key={brandId} variant="secondary" className="gap-1">{brands.find((b) => b.id === brandId)?.name || brandId}<button onClick={() => toggleBrand(brandId)} aria-label="Retirer la marque"><X className="h-3 w-3" /></button></Badge>)}<button onClick={clearAll} className="ml-1 text-xs font-medium text-primary hover:underline">Tout effacer</button></div>}

      <div className="mt-7 flex gap-12"><aside className="hidden w-56 shrink-0 lg:block"><FilterSidebar /></aside><section aria-label="Résultats de la boutique" className="min-w-0 flex-1">{filtered.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center border-y border-[hsl(var(--border))] py-16 text-center"><img src="/brand/edigiya-mark.svg" alt="" className="mb-5 h-12 w-12 opacity-80" /><h2 className="font-heading text-xl font-semibold text-foreground">Aucune offre ne correspond.</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Essayez une autre recherche ou élargissez vos filtres pour découvrir nos offres.</p><Button variant="outline" className="mt-6" onClick={clearAll}>Voir toutes les offres</Button></div> : <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-5'}>{filtered.map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}</div>}</section></div>
    </main>
  );
}

function ShopSkeleton() {
  return <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16"><div className="max-w-3xl space-y-4"><Skeleton className="h-3 w-20 bg-primary/10" /><Skeleton className="h-12 w-64 bg-primary/10" /><Skeleton className="h-5 w-full max-w-xl bg-primary/10" /></div><Skeleton className="mt-9 h-14 w-full max-w-2xl bg-primary/10" /><div className="mt-9 border-y py-5"><Skeleton className="h-4 w-full max-w-xl bg-primary/10" /></div><div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="space-y-4"><Skeleton className="aspect-[4/5] w-full bg-primary/10" /><Skeleton className="h-3 w-20 bg-primary/10" /><Skeleton className="h-5 w-3/4 bg-primary/10" /><Skeleton className="h-4 w-1/3 bg-primary/10" /></div>)}</div></main>;
}

export default function ShopPage() { return <Suspense fallback={<ShopSkeleton />}><ShopPageContent /></Suspense>; }
