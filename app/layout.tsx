import type { Metadata, Viewport } from "next"
import { Inter, Space_Grotesk } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
})

function getSiteUrl() {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim()
  if (!raw) return "http://localhost:3000"

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol
}

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Nutrition Store - Premium Supplements",
  description:
    "Nutrition Store, supplements premium pour force, performance et recuperation. Livraison nationale rapide.",
  keywords: [
    "Nutrition Store",
    "supplements",
    "whey protein",
    "pre workout",
    "creatine",
    "fitness",
  ],
  openGraph: {
    title: "Nutrition Store - Premium Supplements",
    description:
      "Supplements premium pour force, performance et recuperation. Livraison nationale rapide.",
    url: siteUrl,
    siteName: "Nutrition Store",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nutrition Store - Premium Supplements",
    description:
      "Supplements premium pour force, performance et recuperation. Livraison nationale rapide.",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0B" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
