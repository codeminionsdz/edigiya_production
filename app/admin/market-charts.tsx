"use client"

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const COLORS = [
  "hsl(var(--primary))",
  "hsl(262 83% 58%)",
  "hsl(221 83% 53%)",
  "hsl(43 96% 56%)",
  "hsl(142 71% 45%)",
  "hsl(0 84% 60%)",
]

type BrandMetric = {
  name: string
  qty: number
  revenue: number
}

type ProductMetric = {
  name: string
  qty: number
  revenue: number
}

type WilayaMetric = {
  name: string
  revenue: number
}

interface MarketChartsProps {
  topBrands: BrandMetric[]
  topProducts: ProductMetric[]
  revenueByWilaya: WilayaMetric[]
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
  }).format(price)
}

export function MarketCharts({ topBrands, topProducts, revenueByWilaya }: MarketChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Top marques</CardTitle>
        </CardHeader>
        <CardContent>
          {topBrands.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnee</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topBrands} dataKey="qty" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {topBrands.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, props) => {
                      const revenue = props?.payload?.revenue ?? 0
                      return [`${value} ventes • ${formatPrice(revenue)}`, "Marque"]
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Top produits</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnee</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    formatter={(value: number, _name, props) => {
                      const revenue = props?.payload?.revenue ?? 0
                      return [`${value} ventes • ${formatPrice(revenue)}`, "Produit"]
                    }}
                  />
                  <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Revenu par wilaya</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByWilaya.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnee</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByWilaya}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(value: number) => [formatPrice(value), "Revenu"]} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
