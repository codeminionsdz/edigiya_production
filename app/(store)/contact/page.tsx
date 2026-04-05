"use client"

import { useEffect, useState } from "react"
import { MapPin, Phone, Mail, Clock, MessageCircle, Send, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLocale } from "@/lib/locale-context"
import { DEFAULT_STORE_SETTINGS, loadStoreSettings, toWhatsAppUrl } from "@/lib/store-settings"
import { submitContactMessage } from "@/app/(store)/actions"
import { toast } from "sonner"

export default function ContactPage() {
  const { locale } = useLocale()
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })

  useEffect(() => {
    setSettings(loadStoreSettings())
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error(locale === "fr" ? "Veuillez remplir tous les champs" : "الرجاء ملء جميع الحقول")
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await submitContactMessage(formData)
      
      if (result.error) {
        toast.error(locale === "fr" ? "Échec de l'envoi du message" : "فشل إرسال الرسالة")
      } else {
        toast.success(locale === "fr" ? "Message envoyé avec succès!" : "تم إرسال الرسالة بنجاح!")
        // Reset form
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: '',
        })
      }
    } catch (error) {
      console.error('Contact form error:', error)
      toast.error(locale === "fr" ? "Une erreur s'est produite" : "حدث خطأ")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-10 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          {locale === "fr" ? "Contactez-nous" : "اتصل بنا"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {locale === "fr" ? "Nous sommes la pour vous aider" : "نحن هنا لمساعدتك"}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Contact Info */}
        <div className="flex flex-col gap-4">
          {[
            { icon: MapPin, label: { fr: "Adresse", ar: "العنوان" }, value: { fr: settings.address, ar: settings.address } },
            { icon: Phone, label: { fr: "Telephone", ar: "الهاتف" }, value: { fr: `${settings.phonePrimary} / ${settings.phoneSecondary}`, ar: `${settings.phonePrimary} / ${settings.phoneSecondary}` } },
            { icon: Mail, label: { fr: "Email", ar: "البريد" }, value: { fr: settings.contactEmail, ar: settings.contactEmail } },
            { icon: Clock, label: { fr: "Horaires", ar: "اوقات العمل" }, value: { fr: settings.workingHours, ar: settings.workingHours } },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{item.label[locale]}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.value[locale]}</p>
              </div>
            </div>
          ))}

          {/* WhatsApp CTA */}
          <a href={settings.mapLink} target="_blank" rel="noopener noreferrer" className="block">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Google Maps</p>
                  <p className="text-xs text-muted-foreground">
                    {locale === "fr" ? "Ouvrir la localisation" : "افتح الموقع"}
                  </p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          </a>

          <a href={toWhatsAppUrl(settings.whatsapp)} target="_blank" rel="noopener noreferrer" className="block">
            <div className="flex items-center gap-4 rounded-xl bg-green-600 p-5 transition-colors hover:bg-green-700">
              <MessageCircle className="h-6 w-6 text-white" />
              <div>
                <p className="text-sm font-bold text-white">WhatsApp</p>
                <p className="text-xs text-white/80">
                  {locale === "fr" ? "Reponse rapide garantie" : "رد سريع مضمون"}
                </p>
              </div>
            </div>
          </a>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="mb-6 font-heading text-lg font-bold text-foreground">
              {locale === "fr" ? "Envoyez-nous un message" : "ارسل لنا رسالة"}
            </h2>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{locale === "fr" ? "Nom complet" : "الاسم الكامل"}</Label>
                  <Input 
                    className="mt-1.5" 
                    placeholder={locale === "fr" ? "Votre nom" : "اسمك"} 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>{locale === "fr" ? "Email" : "البريد الالكتروني"}</Label>
                  <Input 
                    className="mt-1.5" 
                    type="email" 
                    placeholder="email@example.com" 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>{locale === "fr" ? "Sujet" : "الموضوع"}</Label>
                <Select value={formData.subject} onValueChange={(value) => setFormData({ ...formData, subject: value })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={locale === "fr" ? "Selectionnez un sujet" : "اختر موضوعا"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order">{locale === "fr" ? "Question sur une commande" : "سؤال حول طلب"}</SelectItem>
                    <SelectItem value="product">{locale === "fr" ? "Information produit" : "معلومات عن منتج"}</SelectItem>
                    <SelectItem value="return">{locale === "fr" ? "Retour / Remboursement" : "ارجاع / استرداد"}</SelectItem>
                    <SelectItem value="partnership">{locale === "fr" ? "Partenariat" : "شراكة"}</SelectItem>
                    <SelectItem value="other">{locale === "fr" ? "Autre" : "اخرى"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{locale === "fr" ? "Message" : "الرسالة"}</Label>
                <Textarea 
                  className="mt-1.5" 
                  rows={5} 
                  placeholder={locale === "fr" ? "Ecrivez votre message..." : "اكتب رسالتك..."} 
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                />
              </div>
              <Button className="w-fit gap-2" size="lg" type="submit" disabled={isSubmitting}>
                <Send className="h-4 w-4" />
                {isSubmitting 
                  ? (locale === "fr" ? "Envoi..." : "جاري الإرسال...") 
                  : (locale === "fr" ? "Envoyer" : "ارسال")
                }
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
