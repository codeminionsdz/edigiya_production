"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import {
  DEFAULT_STORE_SETTINGS,
  fetchStoreSettings,
  loadStoreSettings,
  toWhatsAppUrl,
} from "@/lib/store-settings";

export default function SupportPage() {
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS);

  useEffect(() => {
    let active = true;

    fetchStoreSettings()
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch(() => {
        if (active) setSettings(loadStoreSettings());
      });

    return () => {
      active = false;
    };
  }, []);

  const whatsappHref = toWhatsAppUrl(settings.whatsapp);

  return (
    <main className="bg-[#f8f9f7] text-[#14235d] dark:bg-[#101932] dark:text-white">
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:px-10 lg:py-20">
        <div className="mb-10 flex items-center gap-3 text-[#2daa22]">
          <Headphones className="h-6 w-6" />
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Support</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.06em] sm:text-5xl">
              Besoin d’aide ?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#536078] dark:text-[#b8c0d0]">
              Notre équipe est à votre disposition pour vous aider avant, pendant et
              après votre achat. Choisissez le canal de contact qui vous convient le
              mieux.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#14235d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#24366f]"
              >
                <MessageCircle className="h-4 w-4" />
                Parler avec nous
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6e0] bg-white px-5 py-3 text-sm font-semibold text-[#14235d] transition hover:border-[#2daa22] hover:text-[#2daa22] dark:border-white/10 dark:bg-white/5"
              >
                Envoyer un message
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfe6e0] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <h2 className="text-xl font-bold">Contact rapide</h2>
            <div className="mt-6 space-y-4">
              {settings.whatsapp && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-[#eaf0ea] p-3 transition hover:border-[#2daa22]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7f4e5] text-[#2daa22]">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2daa22]">
                      WhatsApp
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#14235d] dark:text-white">
                      {settings.whatsapp}
                    </p>
                  </div>
                </a>
              )}

              {settings.contactEmail && (
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="flex items-center gap-3 rounded-xl border border-[#eaf0ea] p-3 transition hover:border-[#2daa22]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7f4e5] text-[#2daa22]">
                    <Mail className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2daa22]">
                      Email
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#14235d] dark:text-white">
                      {settings.contactEmail}
                    </p>
                  </div>
                </a>
              )}

              {settings.phonePrimary && (
                <a
                  href={`tel:${settings.phonePrimary}`}
                  className="flex items-center gap-3 rounded-xl border border-[#eaf0ea] p-3 transition hover:border-[#2daa22]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7f4e5] text-[#2daa22]">
                    <Phone className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2daa22]">
                      Téléphone
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#14235d] dark:text-white">
                      {settings.phonePrimary}
                    </p>
                  </div>
                </a>
              )}

              <div className="flex items-center gap-3 rounded-xl border border-[#eaf0ea] p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7f4e5] text-[#2daa22]">
                  <Clock3 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2daa22]">
                    Horaires
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#14235d] dark:text-white">
                    {settings.workingHours}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
