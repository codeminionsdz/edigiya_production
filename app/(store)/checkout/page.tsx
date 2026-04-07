"use client"

import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronRight, Truck, CreditCard, User, Package, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useLocale } from "@/lib/locale-context"
import { useCart } from "@/lib/cart-store"
import { wilayas, formatPrice } from "@/lib/data"
import { placeOrder } from "./actions"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

const steps = ["info", "shipping", "payment", "confirmation"] as const

export default function CheckoutPage() {
  const { locale, t } = useLocale()
  const { items, totalPrice, clearCart } = useCart()
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [selectedWilaya, setSelectedWilaya] = useState("")
  const [deliveryType, setDeliveryType] = useState("home")
  const [paymentMethod, setPaymentMethod] = useState("cod")
  const [orderNumber, setOrderNumber] = useState("")
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    shipping: 0,
    total: 0,
  })
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    stopDeskName: "",
  })

  const wilaya = wilayas.find((w) => w.code === selectedWilaya)
  const shippingFee = wilaya
    ? deliveryType === "home"
      ? wilaya.homeDeliveryFee
      : wilaya.stopDeskFee
    : 0
  const total = totalPrice + shippingFee

  const stepIcons = [User, Truck, CreditCard, Package]
  const stepLabels = [t.checkout.step1, t.checkout.step2, t.checkout.step3, t.checkout.step4]

  // Check and fix session_id on mount
  useEffect(() => {
    const checkSession = async () => {
      // Get all cookies
      const cookies = document.cookie.split(';').map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith('session_id='));
      
      if (sessionCookie) {
        const sessionValue = sessionCookie.split('=')[1];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (!uuidRegex.test(sessionValue)) {
          console.log('⚠️ Invalid session detected, deleting...');
          // Delete invalid session
          document.cookie = 'session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          // Reload to get new session from middleware
          window.location.reload();
        }
      }
    };
    
    checkSession();
  }, []);

  const nextStep = () => {
    if (step === 3) return
    
    // Validation for step 0
    if (step === 0) {
      if (!formData.firstName || !formData.lastName || !formData.phone || !formData.address) {
        toast({
          variant: "destructive",
          title: locale === "fr" ? "Erreur" : "خطأ",
          description: locale === "fr" ? "Veuillez remplir tous les champs" : "الرجاء ملء جميع الحقول",
        })
        return
      }
      setStep(1)
      return
    }
    
    // Validation for step 1
    if (step === 1) {
      if (!selectedWilaya) {
        toast({
          variant: "destructive",
          title: locale === "fr" ? "Erreur" : "خطأ",
          description: locale === "fr" ? "Veuillez sélectionner une wilaya" : "الرجاء اختيار ولاية",
        })
        return
      }
      if (deliveryType === "desk" && !formData.stopDeskName) {
        toast({
          variant: "destructive",
          title: locale === "fr" ? "Erreur" : "خطأ",
          description: locale === "fr" ? "Veuillez indiquer le nom du point relais" : "الرجاء كتابة اسم مكتب التوصيل",
        })
        return
      }
      setStep(2)
      return
    }
    
    if (step === 2) {
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    // Check if cart is empty
    if (items.length === 0) {
      toast({
        variant: "destructive",
        title: locale === "fr" ? "Erreur" : "خطأ",
        description: locale === "fr" ? "Votre panier est vide" : "سلة التسوق فارغة",
      })
      return
    }

    startTransition(async () => {
      console.log('🛒 Starting order placement...');
      const data = new FormData()
      data.append('firstName', formData.firstName)
      data.append('lastName', formData.lastName)
      data.append('phone', formData.phone)
      data.append('address', formData.address)
      data.append('stopDeskName', formData.stopDeskName)
      data.append('wilayaCode', selectedWilaya)
      data.append('deliveryMethod', deliveryType)
      data.append('paymentMethod', paymentMethod)
      data.append('cartItems', JSON.stringify(items))
      data.append('subtotal', totalPrice.toString())
      data.append('shipping', shippingFee.toString())
      data.append('total', total.toString())

      console.log('🛒 Calling placeOrder...');
      const result = await placeOrder(data)
      console.log('🛒 Result:', result);
      
      if (result.error) {
        console.error('❌ Order error:', result.error);
        
        // If session error, reload page to get new session
        if (result.error.includes('Session') || result.error.includes('uuid')) {
          toast({
            variant: "destructive",
            title: locale === "fr" ? "Erreur de session" : "خطأ في الجلسة",
            description: locale === "fr" ? "Rechargement de la page..." : "إعادة تحميل الصفحة...",
          });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
        }
        
        toast({
          variant: "destructive",
          title: locale === "fr" ? "Erreur" : "خطأ",
          description: result.error,
        })
        return
      }

      if (result.orderNumber) {
        console.log('✅ Order placed successfully:', result.orderNumber);
        setOrderNumber(result.orderNumber)
      }
      
      // Save order summary before clearing cart
      setOrderSummary({
        subtotal: totalPrice,
        shipping: shippingFee,
        total: total,
      })
      
      clearCart()
      setStep(3)
    })
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 font-heading text-2xl font-bold text-foreground sm:text-3xl">{t.checkout.title}</h1>

      {/* Steps */}
      <div className="mb-10 flex items-center justify-between">
        {stepLabels.map((label, i) => {
          const Icon = stepIcons[i]
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                i < step ? "bg-green-600 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={`hidden text-sm font-medium sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < 3 && <ChevronRight className="mx-2 hidden h-4 w-4 text-muted-foreground sm:inline" />}
            </div>
          )
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-6 font-heading text-lg font-bold text-foreground">{t.checkout.step1}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t.checkout.firstName}</Label>
                    <Input
                      className="mt-1.5"
                      placeholder="Mohamed"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{t.checkout.lastName}</Label>
                    <Input
                      className="mt-1.5"
                      placeholder="Benali"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{t.checkout.phone}</Label>
                    <Input
                      className="mt-1.5"
                      type="tel"
                      placeholder="0550 000 000"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{t.checkout.address}</Label>
                    <Input
                      className="mt-1.5"
                      placeholder={locale === "fr" ? "Adresse complete" : "العنوان الكامل"}
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={nextStep} className="mt-6 gap-1.5">
                  {locale === "fr" ? "Continuer" : "متابعة"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="shipping" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-6 font-heading text-lg font-bold text-foreground">{t.checkout.step2}</h2>
                <div className="flex flex-col gap-4">
                  <div>
                    <Label>{t.checkout.wilaya}</Label>
                    <Select value={selectedWilaya} onValueChange={setSelectedWilaya}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder={locale === "fr" ? "Selectionnez votre wilaya" : "اختر ولايتك"} />
                      </SelectTrigger>
                      <SelectContent>
                        {wilayas.filter((w) => w.enabled).map((w) => (
                          <SelectItem key={w.code} value={w.code}>
                            {w.code} - {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {wilaya && (
                    <>
                      <RadioGroup value={deliveryType} onValueChange={setDeliveryType} className="flex flex-col gap-3">
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted">
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="home" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{t.checkout.homeDelivery}</p>
                              <p className="text-xs text-muted-foreground">
                                {wilaya.minDays}-{wilaya.maxDays} {locale === "fr" ? "jours" : "ايام"}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-foreground">{formatPrice(wilaya.homeDeliveryFee)}</span>
                        </label>
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted">
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="desk" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{t.checkout.stopDesk}</p>
                              <p className="text-xs text-muted-foreground">
                                {wilaya.minDays}-{wilaya.maxDays} {locale === "fr" ? "jours" : "ايام"}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-foreground">
                            {wilaya.stopDeskFee === 0 ? t.sections.free : formatPrice(wilaya.stopDeskFee)}
                          </span>
                        </label>
                      </RadioGroup>
                      {deliveryType === "desk" && (
                        <div className="mt-2">
                          <Label>{locale === "fr" ? "Nom du point relais" : "اسم مكتب التوصيل"}</Label>
                          <Input
                            className="mt-1.5"
                            placeholder={locale === "fr" ? "Nom du bureau de poste ou point relais" : "اسم مكتب البريد أو محطة التسليم"}
                            value={formData.stopDeskName}
                            onChange={(e) => setFormData(prev => ({ ...prev, stopDeskName: e.target.value }))}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-6 flex gap-2">
                  <Button variant="outline" onClick={() => setStep(0)}>{locale === "fr" ? "Retour" : "رجوع"}</Button>
                  <Button onClick={nextStep} disabled={!selectedWilaya} className="gap-1.5">
                    {locale === "fr" ? "Continuer" : "متابعة"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-6 font-heading text-lg font-bold text-foreground">{t.checkout.step3}</h2>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex flex-col gap-3">
                  {[
                    { value: "cod", label: t.checkout.cod, desc: locale === "fr" ? "Payez en especes a la livraison" : "ادفع نقدا عند الاستلام" },
                    { value: "cib", label: t.checkout.cib, desc: locale === "fr" ? "Paiement par carte bancaire CIB" : "الدفع ببطاقة CIB" },
                    { value: "edahabia", label: t.checkout.edahabia, desc: locale === "fr" ? "Paiement par carte Edahabia" : "الدفع ببطاقة الذهبية" },
                    { value: "bank", label: t.checkout.bankTransfer, desc: locale === "fr" ? "Virement bancaire" : "تحويل بنكي" },
                  ].map((method) => (
                    <label key={method.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted">
                      <RadioGroupItem value={method.value} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
                <div className="mt-6 flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>{locale === "fr" ? "Retour" : "رجوع"}</Button>
                  <Button onClick={nextStep} disabled={isPending} className="gap-1.5">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t.checkout.placeOrder}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-border bg-card p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-foreground">{t.checkout.orderConfirmed}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.checkout.orderNumber}: <span className="font-mono font-bold text-foreground">{orderNumber || "N/A"}</span>
                </p>
                {wilaya && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.checkout.estimatedDelivery}: {wilaya.minDays}-{wilaya.maxDays} {locale === "fr" ? "jours" : "ايام"}
                  </p>
                )}
                <div className="mt-6 flex justify-center gap-3">
                  <Link href="/">
                    <Button variant="outline">{t.nav.home}</Button>
                  </Link>
                  <Link href="/shop">
                    <Button>{t.cart.continueShopping}</Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 font-heading text-base font-bold text-foreground">{t.cart.summary}</h3>
            {step < 3 && items.length > 0 && (
              <div className="mb-4 flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground line-clamp-1 flex-1">
                      {item.product.name[locale]} x{item.quantity}
                    </span>
                    <span className="shrink-0 font-medium text-foreground">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
            <Separator />
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.cart.subtotal}</span>
                <span className="text-foreground">{formatPrice(step === 3 ? orderSummary.subtotal : totalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.cart.shipping}</span>
                <span className="text-foreground">
                  {step === 3 
                    ? (orderSummary.shipping > 0 ? formatPrice(orderSummary.shipping) : "---")
                    : (shippingFee > 0 ? formatPrice(shippingFee) : "---")
                  }
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between">
                <span className="font-heading font-bold text-foreground">{t.cart.total}</span>
                <span className="font-heading text-lg font-bold text-foreground">{formatPrice(step === 3 ? orderSummary.total : total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
