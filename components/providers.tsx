"use client"

// Fresh providers
import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"
import { LocaleProvider } from "@/lib/locale-context"
import { CartProvider } from "@/lib/cart-store"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="nutrition-store-theme"
      disableTransitionOnChange={false}
    >
      <LocaleProvider>
        <CartProvider>
          {children}
          <Toaster />
        </CartProvider>
      </LocaleProvider>
    </NextThemesProvider>
  )
}
