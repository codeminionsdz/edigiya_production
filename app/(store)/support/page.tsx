"use client"

import { useEffect, useState } from "react"
import { MessageCircle, Phone, Mail, Clock, Truck, RotateCcw, Shield, CreditCard, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useLocale } from "@/lib/locale-context"
import {
  DEFAULT_STORE_SETTINGS,
  fetchStoreSettings,
  loadStoreSettings,
  toTelUrl,
  toWhatsAppUrl,
} from "@/lib/store-settings"

const faqCategories = [
  {
    icon: Truck,
    title: { fr: "Livraison", ar: "التوصيل" },
    faqs: [
      { q: { fr: "Quels sont les delais de livraison ?", ar: "ما هي مدة التوصيل؟" }, a: { fr: "Les delais varient de 1 a 10 jours selon votre wilaya. Alger et ses environs: 1-2 jours. Autres wilayas: 2-5 jours. Sud: 5-10 jours.", ar: "تختلف المدة من يوم الى 10 ايام حسب ولايتك. الجزائر ومحيطها: 1-2 يوم. ولايات اخرى: 2-5 ايام. الجنوب: 5-10 ايام." } },
      { q: { fr: "Combien coute la livraison ?", ar: "كم تكلفة التوصيل؟" }, a: { fr: "Les frais de livraison varient selon votre wilaya et le mode de livraison choisi (domicile ou point relais). Consultez la page de livraison pour les tarifs detailles.", ar: "تختلف تكلفة التوصيل حسب ولايتك ونوع التوصيل (للمنزل او مكتب التوقف). راجع صفحة التوصيل للاسعار المفصلة." } },
      { q: { fr: "Livrez-vous dans toutes les wilayas ?", ar: "هل توصلون لجميع الولايات؟" }, a: { fr: "Oui, nous livrons vers les 58 wilayas d'Algerie.", ar: "نعم، نوصل لجميع الولايات الـ58 في الجزائر." } },
    ],
  },
  {
    icon: RotateCcw,
    title: { fr: "Retours et remboursements", ar: "الارجاع والاسترداد" },
    faqs: [
      { q: { fr: "Puis-je retourner un produit ?", ar: "هل يمكنني ارجاع منتج؟" }, a: { fr: "Oui, vous disposez de 7 jours apres reception pour retourner un produit non ouvert dans son emballage d'origine.", ar: "نعم، لديك 7 ايام بعد الاستلام لارجاع منتج غير مفتوح في عبوته الاصلية." } },
      { q: { fr: "Comment demander un remboursement ?", ar: "كيف اطلب استرداد؟" }, a: { fr: "Contactez-nous via WhatsApp ou email avec votre numero de commande. Nous traiterons votre demande sous 48h.", ar: "تواصل معنا عبر واتساب او البريد مع رقم طلبك. سنعالج طلبك خلال 48 ساعة." } },
    ],
  },
  {
    icon: CreditCard,
    title: { fr: "Paiement", ar: "الدفع" },
    faqs: [
      { q: { fr: "Quels modes de paiement acceptez-vous ?", ar: "ما طرق الدفع المقبولة؟" }, a: { fr: "Nous acceptons: Paiement a la livraison (COD), Carte CIB, Carte Edahabia, et Virement bancaire.", ar: "نقبل: الدفع عند الاستلام، بطاقة CIB، بطاقة الذهبية، والتحويل البنكي." } },
      { q: { fr: "Le paiement a la livraison est-il disponible ?", ar: "هل الدفع عند الاستلام متاح؟" }, a: { fr: "Oui, le paiement a la livraison (COD) est disponible pour toutes les wilayas.", ar: "نعم، الدفع عند الاستلام متاح لجميع الولايات." } },
    ],
  },
  {
    icon: Shield,
    title: { fr: "Garantie", ar: "الضمان" },
    faqs: [
      { q: { fr: "Vos produits sont-ils garantis ?", ar: "هل منتجاتكم مضمونة؟" }, a: { fr: "Oui, tous nos produits beneficient de la garantie officielle du fabricant. La duree varie selon le produit (1 a 3 ans).", ar: "نعم، جميع منتجاتنا تستفيد من الضمان الرسمي للشركة المصنعة. تختلف المدة حسب المنتج (سنة الى 3 سنوات)." } },
    ],
  },
]

export default function SupportPage() {
  const { locale } = useLocale()
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS)

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        const settings = await fetchStoreSettings()
        if (active) setSettings(settings)
      } catch (error) {
        console.error('Failed to load store settings:', error)
        if (active) setSettings(loadStoreSettings())
      }
    }

    void loadSettings()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <HelpCircle className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          {locale === "fr" ? "Centre d'aide" : "مركز المساعدة"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {locale === "fr" ? "Trouvez des reponses a vos questions les plus frequentes" : "ابحث عن اجوبة لاسئلتك الاكثر شيوعا"}
        </p>
      </div>

      {/* Contact CTA */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: MessageCircle, label: { fr: "WhatsApp", ar: "واتساب" }, value: settings.whatsapp, href: toWhatsAppUrl(settings.whatsapp), color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
          { icon: Phone, label: { fr: "Telephone", ar: "الهاتف" }, value: `${settings.phonePrimary} / ${settings.phoneSecondary}`, href: toTelUrl(settings.phonePrimary), color: "text-primary bg-primary/15" },
          { icon: Mail, label: { fr: "Email", ar: "البريد" }, value: settings.contactEmail, href: `mailto:${settings.contactEmail}`, color: "text-primary bg-primary/15" },
        ].map((item) => (
          <a key={item.value} href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30 hover:shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label[locale]}</p>
              <p className="text-xs text-muted-foreground">{item.value}</p>
            </div>
          </a>
        ))}
      </div>

      {/* FAQ Sections */}
      <div className="flex flex-col gap-8">
        {faqCategories.map((category, i) => (
          <section key={i} id={category.title.fr.toLowerCase().replace(/\s/g, "-")}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <category.icon className="h-4.5 w-4.5" />
              </div>
              <h2 className="font-heading text-lg font-bold text-foreground">{category.title[locale]}</h2>
            </div>
            <Accordion type="single" collapsible className="rounded-xl border border-border bg-card">
              {category.faqs.map((faq, j) => (
                <AccordionItem key={j} value={`${i}-${j}`} className="border-border px-5">
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                    {faq.q[locale]}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {faq.a[locale]}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>

      {/* WhatsApp CTA */}
      <div className="mt-12 rounded-2xl bg-green-600 p-8 text-center">
        <MessageCircle className="mx-auto mb-3 h-10 w-10 text-white" />
        <h3 className="font-heading text-xl font-bold text-white">
          {locale === "fr" ? "Vous n'avez pas trouve votre reponse ?" : "لم تجد اجابتك؟"}
        </h3>
        <p className="mt-2 text-sm text-white/80">
          {locale === "fr" ? "Notre equipe est disponible sur WhatsApp pour vous aider" : "فريقنا متاح على واتساب لمساعدتك"}
        </p>
        <a href={toWhatsAppUrl(settings.whatsapp)} target="_blank" rel="noopener noreferrer">
          <Button size="lg" className="mt-4 bg-primary text-primary-foreground hover:bg-[#E5C100]">
            <MessageCircle className="me-2 h-5 w-5" />
            {locale === "fr" ? "Discuter sur WhatsApp" : "تحدث على واتساب"}
          </Button>
        </a>
      </div>
    </div>
  )
}
