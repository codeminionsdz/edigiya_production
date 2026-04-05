/* eslint-disable @next/next/no-img-element */

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getBrands } from "@/app/(store)/actions"

export default async function BrandsPage() {
  const brands = await getBrands()
  const rows = Array.isArray(brands) ? brands : []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">Nos marques</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Decouvrez nos partenaires officiels et explorez leurs produits.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center">
          <p className="text-lg font-semibold text-foreground">Aucune marque disponible</p>
          <p className="mt-2 text-sm text-muted-foreground">Revenez plus tard pour de nouvelles marques.</p>
          <Link href="/shop" className="mt-4">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Explorer la boutique
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((brand) => {
            const linkTarget = brand.slug || String(brand.name || "").toLowerCase().replace(/\s+/g, "-")
            return (
              <div
                key={brand.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{brand.name}</p>
                  <p className="text-xs text-muted-foreground">Marque officielle</p>
                </div>

                <Link
                  href={`/brand/${encodeURIComponent(linkTarget)}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  Voir les produits
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
