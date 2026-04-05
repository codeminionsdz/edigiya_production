import type { MetadataRoute } from "next"

function getBaseUrl() {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim()
  if (!raw) return "http://localhost:3000"
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
