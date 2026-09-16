"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  Facebook,
  Instagram,
  Mail,
  MessageCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/lib/locale-context";
import {
  DEFAULT_STORE_SETTINGS,
  fetchStoreSettings,
  loadStoreSettings,
  toWhatsAppUrl,
} from "@/lib/store-settings";
import { submitContactMessage } from "@/app/(store)/actions";
import { toast } from "sonner";

export default function ContactPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    let active = true;
    fetchStoreSettings()
      .then((next) => active && setSettings(next))
      .catch(() => active && setSettings(loadStoreSettings()));
    return () => {
      active = false;
    };
  }, []);

  const channels = useMemo(
    () =>
      [
        settings.contactEmail && {
          icon: Mail,
          label: ar ? "البريد الإلكتروني" : "Email",
          value: settings.contactEmail,
          href: `mailto:${settings.contactEmail}`,
          detail: ar ? "للطلبات والأسئلة" : "Pour vos questions et commandes",
        },
        settings.whatsapp && {
          icon: MessageCircle,
          label: "WhatsApp",
          value: settings.whatsapp,
          href: toWhatsAppUrl(settings.whatsapp),
          detail: ar ? "رد سريع من فريقنا" : "Réponse rapide de notre équipe",
        },
        settings.telegramLink && {
          icon: Send,
          label: "Telegram",
          value: settings.telegramLink.replace(
            /^https?:\/\/(www\.)?t\.me\//,
            "@",
          ),
          href: settings.telegramLink,
          detail: ar ? "تواصل مباشر" : "Contact direct",
        },
        settings.instagram && {
          icon: Instagram,
          label: "Instagram",
          value: "Instagram Edigiya",
          href: settings.instagram,
          detail: ar ? "تابع آخر العروض" : "Suivez nos nouveautés",
        },
        settings.facebook && {
          icon: Facebook,
          label: "Facebook",
          value: "Facebook Edigiya",
          href: settings.facebook,
          detail: ar ? "الأخبار والتحديثات" : "Actualités et mises à jour",
        },
      ].filter(Boolean) as Array<{
        icon: typeof Mail;
        label: string;
        value: string;
        href: string;
        detail: string;
      }>,
    [ar, settings],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !formData.name ||
      !formData.email ||
      !formData.subject ||
      !formData.message
    ) {
      toast.error(
        ar ? "يرجى ملء جميع الحقول" : "Veuillez remplir tous les champs.",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitContactMessage(formData);
      if (result.error)
        toast.error(
          ar ? "تعذر إرسال الرسالة" : "Le message n’a pas pu être envoyé.",
        );
      else {
        toast.success(
          ar ? "تم إرسال رسالتك" : "Votre message a bien été envoyé.",
        );
        setFormData({ name: "", email: "", subject: "", message: "" });
      }
    } catch {
      toast.error(ar ? "حدث خطأ أثناء الإرسال" : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="bg-[#f8f9f7] text-[#14235d] dark:bg-[#101932] dark:text-white"
    >
      <section className="mx-auto max-w-7xl px-5 pb-14 pt-12 sm:px-8 lg:px-10 lg:pb-20 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <header>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#2daa22]">
              Edigiya / Contact
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-bold leading-[1.02] tracking-[-.05em] sm:text-6xl">
              {ar
                ? "تحدث معنا، نحن هنا لمساعدتك."
                : "Parlons de votre prochain achat digital."}
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-[#536078] dark:text-[#b8c0d0]">
              {ar
                ? "لديك سؤال حول منتج أو طلب؟ اختر قناة التواصل المناسبة أو أرسل لنا رسالة مباشرة."
                : "Une question sur un produit ou une commande ? Choisissez le canal qui vous convient ou écrivez-nous directement."}
            </p>
          </header>
          <div className="border border-[#cfe3cf] bg-[#e7f4e5] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#2daa22]">
              {ar ? "دعم حقيقي" : "Support Edigiya"}
            </p>
            <div className="mt-5 flex items-start gap-4">
              <Clock3 className="mt-1 h-5 w-5 shrink-0 text-[#2daa22]" />
              <div>
                <p className="font-semibold">
                  {ar
                    ? "نحن متاحون لمساعدتك"
                    : "Nous sommes disponibles pour vous aider"}
                </p>
                <p className="mt-1 text-sm text-[#536078]">
                  {settings.workingHours}
                </p>
              </div>
            </div>
          </div>
        </div>
        <section className="mt-14">
          <div className="flex items-end justify-between gap-4 border-b border-[#dfe6e0] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#2daa22]">
                01
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {ar ? "قنوات التواصل الحالية" : "Nos canaux actuels"}
              </h2>
            </div>
            <span className="text-sm text-[#7a8496]">{channels.length}</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map(({ icon: Icon, label, value, href, detail }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="group flex min-h-36 flex-col justify-between border border-[#dfe6e0] bg-white p-5 transition hover:-translate-y-1 hover:border-[#2daa22] hover:shadow-lg dark:border-white/10 dark:bg-white/[.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center bg-[#e7f4e5] text-[#2daa22]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#7a8496] transition group-hover:text-[#2daa22] rtl:rotate-[-90deg]" />
                </div>
                <div className="mt-6 min-w-0">
                  <p className="text-sm font-bold">{label}</p>
                  <p className="mt-1 truncate text-sm text-[#536078] dark:text-[#b8c0d0]">
                    {value}
                  </p>
                  <p className="mt-2 text-xs text-[#7a8496]">{detail}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
        <section className="mt-16 grid gap-10 border-t border-[#dfe6e0] pt-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#2daa22]">
              02
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              {ar ? "أرسل لنا رسالة" : "Envoyez-nous un message"}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[#536078] dark:text-[#b8c0d0]">
              {ar
                ? "سنراجع رسالتك ونتواصل معك عبر البريد الذي تكتبه."
                : "Nous vous répondrons à l’adresse email indiquée dans le formulaire."}
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="border border-[#dfe6e0] bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-white/[.06]"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="contact-name">{ar ? "الاسم" : "Nom"}</Label>
                <Input
                  id="contact-name"
                  className="mt-2"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  className="mt-2"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="mt-5">
              <Label htmlFor="contact-subject">
                {ar ? "الموضوع" : "Sujet"}
              </Label>
              <Input
                id="contact-subject"
                className="mt-2"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder={
                  ar ? "مثلاً: سؤال حول طلب" : "Ex. Question sur une commande"
                }
                required
              />
            </div>
            <div className="mt-5">
              <Label htmlFor="contact-message">
                {ar ? "رسالتك" : "Votre message"}
              </Label>
              <Textarea
                id="contact-message"
                className="mt-2 min-h-36"
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 h-12 gap-2 bg-[#14235d] px-6 hover:bg-[#24366f]"
            >
              <Send className="h-4 w-4" />
              {isSubmitting
                ? ar
                  ? "جار الإرسال..."
                  : "Envoi..."
                : ar
                  ? "إرسال الرسالة"
                  : "Envoyer le message"}
            </Button>
          </form>
        </section>
      </section>
    </main>
  );
}
