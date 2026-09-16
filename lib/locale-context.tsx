"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { type Locale, translations, type TranslationKey } from "./i18n"

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslationKey
  dir: "ltr" | "rtl"
}

const defaultValue: LocaleContextType = {
  locale: "fr",
  setLocale: () => {},
  t: translations.fr,
  dir: "ltr",
}

const LocaleContext = createContext<LocaleContextType>(defaultValue)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr")
  useEffect(() => {
    const saved = window.localStorage.getItem("edigiya-locale")
    const nextLocale = saved === "ar" || saved === "fr" ? saved : "fr"

    if (saved !== nextLocale) {
      window.localStorage.setItem("edigiya-locale", nextLocale)
    }

    setLocaleState(nextLocale)
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    window.localStorage.setItem("edigiya-locale", newLocale)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar" : "fr"
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"
  }, [locale])

  const t = translations[locale]
  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
