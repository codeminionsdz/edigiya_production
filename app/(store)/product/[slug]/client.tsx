"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Link2,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProductCard } from "@/components/store/product-card";
import { useLocale } from "@/lib/locale-context";
import { useCart } from "@/lib/cart-store";
import { getProducts } from "@/app/(store)/actions";
import { formatPrice, type Product } from "@/lib/data";
import {
  DEFAULT_STORE_SETTINGS,
  fetchStoreSettings,
  loadStoreSettings,
  toWhatsAppUrl,
} from "@/lib/store-settings";

function mapDbProductToUiProduct(dbProduct: any): Product {
  const variants: any[] = [];
  /* Legacy variant rows are intentionally not exposed in the product UI. */
  /* const variants = (dbProduct.product_variants || [])
    .map((variant: any) => ({
      id: variant.id,
      name: variant.name || "",
      value: variant.value || "",
      priceDelta: Number(variant.price_delta_dzd || 0),
      price: variant.price_dzd == null ? undefined : Number(variant.price_dzd),
      priceBaridiMob:
        variant.price_baridimob_dzd == null
          ? undefined
          : Number(variant.price_baridimob_dzd),
      priceFlexy:
        variant.price_flexy_dzd == null
          ? undefined
          : Number(variant.price_flexy_dzd),
      optionValues: variant.option_values || {},
      isActive: variant.is_active !== false,
      stock: variant.stock == null ? null : Number(variant.stock),
    }))
    .filter((variant: any) => variant.isActive); */
  const variantStock = 0;
  const stockCount =
    variants.length > 0 ? variantStock : Number(dbProduct.stock || 0);
  return {
    id: dbProduct.id,
    slug: dbProduct.slug,
    name: {
      fr: dbProduct.title_fr || "",
      ar: dbProduct.title_ar || dbProduct.title_fr || "",
    },
    description: {
      fr: dbProduct.description_fr || "",
      ar: dbProduct.description_ar || dbProduct.description_fr || "",
    },
    price: Number(dbProduct.price_dzd || 0),
    priceBaridiMob:
      dbProduct.price_baridimob_dzd == null
        ? null
        : Number(dbProduct.price_baridimob_dzd),
    priceFlexy:
      dbProduct.price_flexy_dzd == null
        ? null
        : Number(dbProduct.price_flexy_dzd),
    priceSlickPay:
      dbProduct.price_slickpay_dzd == null
        ? null
        : Number(dbProduct.price_slickpay_dzd),
    compareAtPrice: dbProduct.compare_at_price_dzd || undefined,
    images: (dbProduct.product_images || [])
      .map((image: any) => String(image?.url || ""))
      .filter(
        (url: string) => url.startsWith("/") || /^https?:\/\//i.test(url),
      ),
    category: dbProduct.categories?.slug || "",
    subcategory: undefined,
    department: dbProduct.departments?.slug || "",
    brand: dbProduct.brands?.name || "",
    rating: 0,
    reviewCount: 0,
    specs: {},
    tags: [],
    isBestSeller: Boolean(dbProduct.is_featured),
    isDeal: Boolean(
      dbProduct.compare_at_price_dzd &&
      dbProduct.compare_at_price_dzd > dbProduct.price_dzd,
    ),
    inStock: dbProduct.inventory_type === "unlimited" || stockCount > 0,
    stockCount,
    variants,
  };
}

export function ProductPageClient({ product }: { product: Product }) {
  const { locale, t } = useLocale();
  const { addItem } = useCart();
  const ar = locale === "ar";
  const selectedVariantId = "";
  const setSelectedVariantId = (_value: string) => {};
  const images =
    product.images?.filter(
      (url) => url.startsWith("/") || /^https?:\/\//i.test(url),
    ) || [];
  const [qty, setQty] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<
    "baridimob" | "flexy" | "slickpay"
  >("baridimob");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [related, setRelated] = useState<Product[]>([]);
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS);
  const [added, setAdded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const title = product.name[locale] || product.name.fr;
  const description = product.description[locale] || product.description.fr;
  const specs = Object.entries(product.specs || {});
  const displayPrice =
    paymentMethod === "baridimob"
      ? product.priceBaridiMob
      : paymentMethod === "flexy"
        ? product.priceFlexy
        : product.priceSlickPay;
  const available = displayPrice != null && product.inStock;
  const activeImage = images[selectedImageIndex] || images[0];
  useEffect(() => {
    let active = true;
    void fetchStoreSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {
        if (active) setSettings(loadStoreSettings());
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void getProducts({ limit: 60 })
      .then((result) => {
        if (!active) return;
        const rows = (result?.products || [])
          .map(mapDbProductToUiProduct)
          .filter((item) => item.id !== product.id && item.inStock);
        setRelated(rows.slice(0, 4));
      })
      .catch(() => {
        if (active) setRelated([]);
      });
    return () => {
      active = false;
    };
  }, [product.id]);
  const addToCart = () => {
    if (!available) return;
    addItem(product, qty, undefined, displayPrice ?? undefined, paymentMethod);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  };
  const buyNow = () => {
    if (available)
      addItem(
        product,
        qty,
        undefined,
        displayPrice ?? undefined,
        paymentMethod,
      );
  };
  const moveImage = (direction: number) =>
    setSelectedImageIndex((index) =>
      images.length ? (index + direction + images.length) % images.length : 0,
    );
  const markImageFailed = (src: string) =>
    setFailedImages((current) => ({ ...current, [src]: true }));
  const whatsapp = toWhatsAppUrl(settings.whatsapp);
  const whatsappHref =
    whatsapp === "#" ? "#" : whatsapp + "?text=" + encodeURIComponent(title);
  const imagePlaceholder = (
    <div className="flex h-full items-center justify-center">
      <Image
        src="/brand/edigiya-mark.svg"
        alt=""
        width={72}
        height={72}
        className="opacity-30"
      />
    </div>
  );
  const renderImage = (src: string, alt: string, thumbnail = false) =>
    failedImages[src] ? (
      imagePlaceholder
    ) : (
      <Image
        src={src}
        alt={alt}
        fill={!thumbnail}
        width={thumbnail ? 96 : undefined}
        height={thumbnail ? 96 : undefined}
        priority={!thumbnail}
        unoptimized
        onError={() => markImageFailed(src)}
        className={
          thumbnail
            ? "h-full w-full object-contain p-2"
            : "store-product-image object-contain p-8 sm:p-12"
        }
        sizes={thumbnail ? "96px" : "(max-width: 1024px) 100vw, 58vw"}
      />
    );

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-14"
    >
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Link href="/" className="hover:text-primary">
          {t.nav.home}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        <Link href="/shop" className="hover:text-primary">
          {t.nav.shop}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        <span className="max-w-[220px] truncate text-foreground">{title}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:gap-16">
        <section className="min-w-0">
          <div className="relative aspect-square overflow-hidden border border-border bg-[#f1f4ef] sm:aspect-[1.08/1]">
            {activeImage ? renderImage(activeImage, title) : imagePlaceholder}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => moveImage(-1)}
                  aria-label={ar ? "الصورة السابقة" : "Image précédente"}
                  className="absolute start-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-border bg-white/90"
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(1)}
                  aria-label={ar ? "الصورة التالية" : "Image suivante"}
                  className="absolute end-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-border bg-white/90"
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={image + index}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className="relative aspect-square w-20 shrink-0 overflow-hidden border bg-[#f1f4ef]"
                >
                  {renderImage(image, title, true)}
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="flex min-w-0 flex-col lg:pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {product.brand || product.category || "Edigiya"}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              {description}
            </p>
          )}
          <Separator className="my-7" />
          <p className="font-heading text-3xl font-semibold">
            {displayPrice == null
              ? "Prix indisponible"
              : formatPrice(displayPrice)}
          </p>
          <p
            className={
              available
                ? "mt-4 text-sm font-medium text-primary"
                : "mt-4 text-sm font-medium text-destructive"
            }
          >
            {available ? t.sections.inStock : t.sections.outOfStock}
          </p>
          {false && (product.variants?.length ?? 0) > 0 && (
            <div className="mt-6">
              <label
                htmlFor="product-variant"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                {t.product.chooseVariant}
              </label>
              <select
                id="product-variant"
                value={selectedVariantId}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                className="mt-3 h-12 w-full border border-border bg-card px-3 text-sm"
              >
                {product.variants?.map((variant) => (
                  <option
                    key={variant.id}
                    value={variant.id}
                    disabled={variant.stock !== null && variant.stock <= 0}
                  >
                    {[variant.name, variant.value].filter(Boolean).join(" · ")}
                    {variant.stock !== null && variant.stock <= 0
                      ? " · " + t.sections.outOfStock
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Choisir le mode de paiement
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(["baridimob", "flexy", "slickpay"] as const).map((method) => {
                const price =
                  method === "baridimob"
                    ? product.priceBaridiMob
                    : method === "flexy"
                      ? product.priceFlexy
                      : product.priceSlickPay;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`border px-3 py-3 text-start text-sm ${paymentMethod === method ? "border-primary bg-primary/5" : "border-border"}`}
                    disabled={price == null}
                  >
                    <span className="block font-medium">
                      {method === "baridimob"
                        ? "BaridiMob"
                        : method === "flexy"
                          ? "Flexy"
                          : "Slick Pay"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {price == null ? "Indisponible" : formatPrice(price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-y border-border py-5 sm:grid-cols-3">
            <div className="flex gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <span>
                <strong className="block text-sm">{t.product.digital}</strong>
                <span className="text-xs text-muted-foreground">
                  {t.product.digitalDelivery}
                </span>
              </span>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>
                <strong className="block text-sm">
                  {t.product.securePayment}
                </strong>
                <span className="text-xs text-muted-foreground">
                  {t.product.support}
                </span>
              </span>
            </div>
            <div className="flex gap-3">
              <Check className="h-5 w-5 text-primary" />
              <span>
                <strong className="block text-sm">
                  {t.product.afterPayment}
                </strong>
                <span className="text-xs text-muted-foreground">
                  {t.product.manualDelivery}
                </span>
              </span>
            </div>
          </div>
          <div className="mt-6 flex items-center border border-border w-fit">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="flex h-11 w-11 items-center justify-center"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="flex h-11 w-12 items-center justify-center border-x border-border text-sm font-semibold">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              className="flex h-11 w-11 items-center justify-center"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Link
            href={available ? "/checkout" : "#"}
            onClick={buyNow}
            className="mt-4 w-full"
          >
            <Button
              disabled={!available}
              size="lg"
              className="h-13 w-full gap-2 text-base font-semibold"
            >
              {t.sections.buyNow}
              <ShoppingCart className="h-5 w-5" />
            </Button>
          </Link>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Button
              onClick={addToCart}
              disabled={!available}
              variant="outline"
              size="lg"
              className="h-11 w-full gap-2"
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" />
                  {t.product.addedToCart}
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  {t.sections.addToCart}
                </>
              )}
            </Button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button
                variant="outline"
                size="lg"
                className="h-11 w-full gap-2 border-primary/50 text-primary"
              >
                <MessageCircle className="h-4 w-4" />
                {t.product.askWhatsApp}
              </Button>
            </a>
          </div>
          <div className="mt-6 flex gap-2 border-t border-border pt-5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                void navigator.clipboard
                  .writeText(window.location.href)
                  .then(() => setShareCopied(true))
              }
            >
              <Link2 className="h-4 w-4" />
              {shareCopied ? "Copié" : "Partager"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  "https://www.facebook.com/sharer/sharer.php?u=" +
                    encodeURIComponent(window.location.href),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <Share2 className="h-4 w-4" />
              Facebook
            </Button>
          </div>
        </section>
      </div>
      {(description || specs.length > 0) && (
        <section className="mt-16 grid gap-12 border-t border-border pt-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              Edigiya
            </p>
            <h2 className="mt-3 font-heading text-2xl font-semibold">
              {t.product.details}
            </h2>
          </div>
          <div>
            {description && (
              <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {description}
              </p>
            )}
            {specs.length > 0 && (
              <dl className="mt-6 divide-y divide-border border-y border-border">
                {specs.map(([key, value]) => (
                  <div key={key} className="grid gap-2 py-4 sm:grid-cols-2">
                    <dt className="text-sm text-muted-foreground">{key}</dt>
                    <dd className="text-sm font-medium">
                      {ar ? product.specsAr?.[key] || value : value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      )}
      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-10">
          <h2 className="font-heading text-2xl font-semibold">
            {t.product.recommended}
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
      <div className="h-20 lg:hidden" />
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground">
              {title}
            </p>
            <p className="font-heading text-lg font-semibold">
              {displayPrice == null
                ? "Prix indisponible"
                : formatPrice(displayPrice)}
            </p>
          </div>
          <Link
            href={available ? "/checkout" : "#"}
            onClick={buyNow}
            className="ms-auto shrink-0"
          >
            <Button disabled={!available} className="h-11 gap-2 px-5">
              {t.sections.buyNow}
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
