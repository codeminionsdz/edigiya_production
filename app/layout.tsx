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
  title: "Edigiya — Digital, made simple",
  icons: {
    icon: "/brand/edigiya-mark.svg",
    shortcut: "/brand/edigiya-mark.svg",
    apple: "/brand/edigiya-mark.svg",
  },
  description:
    "Edigiya simplifie la découverte et l’achat de produits et services numériques.",
  keywords: [
    "Edigiya",
    "produits numériques",
    "services numériques",
  ],
  openGraph: {
    title: "Edigiya — Digital, made simple",
    description: "Edigiya simplifie la découverte et l’achat de produits et services numériques.",
    url: siteUrl,
    siteName: "Edigiya",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Edigiya — Digital, made simple",
    description: "Edigiya simplifie la découverte et l’achat de produits et services numériques.",
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
