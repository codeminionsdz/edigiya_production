"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/lib/locale-context";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/data";
import { placeOrder } from "./actions";
import { useToast } from "@/components/ui/use-toast";
import {
  DEFAULT_STORE_SETTINGS,
  fetchStoreSettings,
} from "@/lib/store-settings";
import { PaymentExperience } from "@/components/store/payment-experience";
import {
  ContinuationScreenV2,
  PaymentProofExperience,
} from "@/components/store/payment-proof-experience";

const crypto =
  globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto
    : {
        randomUUID: () =>
          "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
            const random = (Math.random() * 16) | 0;
            const value = char === "x" ? random : (random & 0x3) | 0x8;
            return value.toString(16);
          }),
      };

function repairMojibake(value: string) {
  let repaired = value;
  for (let attempt = 0; attempt < 4 && /[ÃÂâ]/.test(repaired); attempt += 1) {
    try {
      const legacyByte = (char: string) => {
        const code = char.charCodeAt(0);
        const windows1252: Record<number, number> = {
          338: 0x8c,
          339: 0x9c,
          352: 0x8a,
          353: 0x9a,
          376: 0x9f,
          402: 0x83,
          8218: 0x82,
          8211: 0x96,
          8217: 0x92,
          8220: 0x93,
          8221: 0x94,
          8222: 0x84,
          8230: 0x85,
          8240: 0x89,
          8364: 0x80,
          8482: 0x99,
        };
        return windows1252[code] ?? code;
      };
      const bytes = Uint8Array.from(
        Array.from(repaired, (char) => legacyByte(char)),
      );
      repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return value;
    }
  }
  return repaired;
}

export default function CheckoutPage() {
  const { locale, t } = useLocale();
  const { items: cartItems, totalPrice, clearCart } = useCart();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(
    () => cartItems[0]?.paymentMethod || "flexy",
  );
  const [orderNumber, setOrderNumber] = useState("");
  const [orderId, setOrderId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [orderMessage, setOrderMessage] = useState("");
  const [proofOpen, setProofOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS);
  const [checkoutKey] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("edigiya_checkout_key");
      if (saved) return saved;
      const key = crypto.randomUUID();
      sessionStorage.setItem("edigiya_checkout_key", key);
      return key;
    }
    return crypto.randomUUID();
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const items = createdOrder
    ? createdOrder.items.map((item: any) => ({
        product: {
          id: item.id,
          name: { fr: item.title, ar: item.title },
          price: item.unitPrice,
          images: [],
        },
        quantity: item.qty,
      }))
    : cartItems;
  const paymentTotal = items.reduce((total: number, item: any) => {
    const product = item.product || {};
    const price =
      paymentMethod === "baridimob"
        ? product.priceBaridiMob
        : paymentMethod === "flexy"
          ? product.priceFlexy
          : product.priceSlickPay;
    return (
      total +
      Number(price ?? item.unitPrice ?? product.price ?? 0) *
        Number(item.quantity || 0)
    );
  }, 0);
  const steps = [t.checkout.step1, t.checkout.step3, t.checkout.step4];
  useEffect(() => {
    void fetchStoreSettings()
      .then(setSettings)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const repairVisibleText = () => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const nodes: Text[] = [];
      let node: Node | null = walker.nextNode();
      while (node) {
        nodes.push(node as Text);
        node = walker.nextNode();
      }
      nodes.forEach((textNode) => {
        if (textNode.nodeValue && /[ÃÂâ]/.test(textNode.nodeValue)) {
          textNode.nodeValue = repairMojibake(textNode.nodeValue);
        }
      });
    };
    const frame = window.requestAnimationFrame(repairVisibleText);
    return () => window.cancelAnimationFrame(frame);
  }, [error, locale, paymentMethod, step, settings]);
  const update = (field: keyof typeof formData, value: string) =>
    setFormData((current) => ({ ...current, [field]: value }));
  const submitOrder = () => {
    setError("");
    startTransition(async () => {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) =>
        data.append(key, value),
      );
      data.append("paymentMethod", paymentMethod);
      data.append("checkoutKey", checkoutKey);
      data.append("cartItems", JSON.stringify(items));
      const result = await placeOrder(data);
      if (result.error) {
        setError(result.error);
        toast({
          variant: "destructive",
          title:
            locale === "fr"
              ? "VÃ©rifiez vos informations"
              : "ØªØ­Ù‚Ù‚ Ù…Ù† Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙƒ",
          description: result.error,
        });
        return;
      }
      if (result.paymentUrl) {
        window.location.assign(result.paymentUrl);
        return;
      }
      setOrderNumber(result.orderNumber || "");
      setOrderId(result.orderId || "");
      setPaymentId(result.paymentId || "");
      setPaymentStatus(result.paymentStatus || "pending");
      setOrderMessage(result.contactMessage || "");
      setCreatedOrder(result.createdOrder || null);
      sessionStorage.setItem("edigiya_checkout_email", formData.email);
      sessionStorage.removeItem("edigiya_checkout_key");
      clearCart();
      setStep(2);
    });
  };
  const next = () => {
    if (step === 0) {
      if (
        ![
          formData.firstName,
          formData.lastName,
          formData.email,
          formData.phone,
        ].every(Boolean) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
      ) {
        setError(
          locale === "fr"
            ? "Veuillez saisir vos informations avec une adresse e-mail valide."
            : "ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙƒ Ù…Ø¹ Ø¨Ø±ÙŠØ¯ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ ØµØ­ÙŠØ­.",
        );
        return;
      }
      setError("");
      setStep(1);
    } else if (step === 1) submitOrder();
  };
  if (items.length === 0 && step !== 2) return <EmptyCheckout />;
  return (
    <main
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-[#f8f9f7]"
    >
      <header className="border-b border-[#dfe6e0]">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Edigiya" className="relative h-12 w-40">
            <Image
              src="/brand/edigiya-logo-light.svg"
              alt="Edigiya"
              fill
              className="object-contain object-left rtl:object-right"
              sizes="160px"
              priority
            />
          </Link>
          <span className="text-xs font-medium text-muted-foreground">
            {locale === "fr"
              ? "Achat numÃ©rique sÃ©curisÃ©"
              : "Ø´Ø±Ø§Ø¡ Ø±Ù‚Ù…ÙŠ Ø¢Ù…Ù†"}
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
            Edigiya Â· {t.checkout.title}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t.checkout.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {locale === "fr"
              ? "Une expÃ©rience simple pour acheter et suivre votre produit numÃ©rique."
              : "ØªØ¬Ø±Ø¨Ø© Ø¨Ø³ÙŠØ·Ø© Ù„Ø´Ø±Ø§Ø¡ Ù…Ù†ØªØ¬Ùƒ Ø§Ù„Ø±Ù‚Ù…ÙŠ ÙˆÙ…ØªØ§Ø¨Ø¹ØªÙ‡."}
          </p>
        </div>
        <div className="mb-10 grid grid-cols-3 gap-2 border-y border-[#dfe6e0] py-5 sm:max-w-2xl sm:gap-6">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={
                  index < step
                    ? "flex h-8 w-8 shrink-0 items-center justify-center border border-primary bg-primary text-xs font-semibold text-primary-foreground"
                    : index === step
                      ? "flex h-8 w-8 shrink-0 items-center justify-center border border-foreground bg-foreground text-xs font-semibold text-background"
                      : "flex h-8 w-8 shrink-0 items-center justify-center border border-border text-xs font-semibold text-muted-foreground"
                }
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={
                  index <= step
                    ? "hidden text-xs font-medium text-foreground sm:block"
                    : "hidden text-xs font-medium text-muted-foreground sm:block"
                }
              >
                {label}
              </span>
            </div>
          ))}
        </div>
        {error && (
          <div
            role="alert"
            className="mb-6 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-16">
          <section>
            {step === 0 && (
              <InfoStep data={formData} update={update} onNext={next} />
            )}
            {step === 1 && (
              <PaymentExperience
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                isPending={isPending}
                onBack={() => setStep(0)}
                onSubmit={next}
                settings={settings}
                amount={paymentTotal}
                items={items}
              />
            )}
            {step === 2 &&
              (proofOpen ? (
                <PaymentProofExperience
                  orderNumber={orderNumber}
                  orderId={orderId}
                  paymentId={paymentId}
                  paymentStatus={paymentStatus}
                  amount={createdOrder?.total ?? totalPrice}
                  method={paymentMethod}
                  onBack={() => setProofOpen(false)}
                />
              ) : (
                <ContinuationScreenV2
                  orderNumber={orderNumber}
                  orderId={orderId}
                  paymentStatus={paymentStatus}
                  orderMessage={orderMessage}
                  onContinue={() => setProofOpen(true)}
                  messenger={settings.facebook}
                  telegram={settings.telegramLink}
                />
              ))}
          </section>
          <OrderSummary
            items={items}
            locale={locale}
            total={createdOrder?.total ?? paymentTotal}
          />
        </div>
      </div>
    </main>
  );
}

function InfoStep({ data, update, onNext }: any) {
  const { locale, t } = useLocale();
  return (
    <div className="border-t-2 border-foreground pt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
        {t.checkout.step1}
      </p>
      <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
        {locale === "fr" ? "Vos informations" : "Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙƒ"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {locale === "fr"
          ? "UtilisÃ©es pour votre commande et son suivi."
          : "ØªØ³ØªØ®Ø¯Ù… Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ø·Ù„Ø¨Ùƒ."}
      </p>
      <div className="mt-5 border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6 text-foreground">
        <strong className="font-semibold">Important :</strong> vérifiez votre
        adresse e-mail et votre numéro de téléphone. Après validation du
        paiement, le produit numérique et les informations de livraison seront
        envoyés à cette adresse e-mail.
      </div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field
          id="firstName"
          label={t.checkout.firstName}
          value={data.firstName}
          autoComplete="given-name"
          onChange={(v: string) => update("firstName", v)}
        />
        <Field
          id="lastName"
          label={t.checkout.lastName}
          value={data.lastName}
          autoComplete="family-name"
          onChange={(v: string) => update("lastName", v)}
        />
        <Field
          id="email"
          label={t.checkout.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={data.email}
          onChange={(v: string) => update("email", v)}
          className="sm:col-span-2"
        />
        <Field
          id="phone"
          label={t.checkout.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={data.phone}
          onChange={(v: string) => update("phone", v)}
          className="sm:col-span-2"
        />
      </div>
      <Button onClick={onNext} className="mt-8 h-12 gap-2 px-6">
        {locale === "fr" ? "Continuer" : "Ù…ØªØ§Ø¨Ø¹Ø©"}
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}
function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  className = "",
}: any) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12"
      />
    </div>
  );
}
function OrderSummary({ items, locale, total }: any) {
  const { t } = useLocale();
  return (
    <aside className="border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">
          {locale === "fr" ? "Votre commande" : "Ø·Ù„Ø¨Ùƒ"}
        </h2>
        <Package className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-6 space-y-5">
        {items.map((item: any) => (
          <div
            key={item.product.id + "-" + (item.variantId || "base")}
            className="flex gap-3"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-[#f1f4ef]">
              {item.product.images?.[0] ? (
                <Image
                  src={item.product.images[0]}
                  alt=""
                  fill
                  unoptimized
                  className="object-contain p-2"
                  sizes="64px"
                />
              ) : (
                <Package className="m-5 h-6 w-6 text-primary/50" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">
                {item.product.name[locale] || item.product.name.fr}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.quantity} Ã—{" "}
                {formatPrice(item.unitPrice ?? item.product.price ?? 0)}
              </p>
            </div>
            <p className="text-sm font-semibold">
              {formatPrice(
                (item.unitPrice ?? item.product.price ?? 0) * item.quantity,
              )}
            </p>
          </div>
        ))}
      </div>
      <Separator className="my-6" />
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t.cart.subtotal}</span>
        <span>{formatPrice(total)}</span>
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <span className="text-muted-foreground">
          {locale === "fr"
            ? "Livraison digitale"
            : "Ø§Ù„ØªÙˆØµÙŠÙ„ Ø§Ù„Ø±Ù‚Ù…ÙŠ"}
        </span>
        <span>0 DA</span>
      </div>
      <Separator className="my-5" />
      <div className="flex items-end justify-between">
        <span className="font-heading text-base font-semibold">
          {t.cart.total}
        </span>
        <span className="font-heading text-2xl font-semibold">
          {formatPrice(total)}
        </span>
      </div>
    </aside>
  );
}
function EmptyCheckout() {
  const { locale, t } = useLocale();
  return (
    <main
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="flex min-h-[70vh] items-center justify-center px-5"
    >
      <div className="max-w-md text-center">
        <Package className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-5 font-heading text-2xl font-semibold">
          {t.cart.empty}
        </h1>
        <Link href="/shop">
          <Button className="mt-6">{t.cart.continueShopping}</Button>
        </Link>
      </div>
    </main>
  );
}
