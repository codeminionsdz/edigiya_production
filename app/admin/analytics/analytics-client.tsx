"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const COLORS = [
  "hsl(var(--primary))",
  "hsl(262 83% 58%)",
  "hsl(221 83% 53%)",
  "hsl(43 96% 56%)",
  "hsl(142 71% 45%)",
  "hsl(0 84% 60%)",
]

type AnalyticsFilters = {
  from?: string
  to?: string
  status?: string
  wilayaCode?: string
  brandId?: string
  categoryId?: string
  departmentId?: string
}

type Kpis = {
  totalRevenue: number
  ordersCount: number
  avgOrderValue: number
  itemsSold: number
}

type SeriesPoint = {
  label: string
  revenue: number
  orders: number
}

type StatusPoint = {
  status: string
  count: number
}

type TopItem = {
  name: string
  qty: number
  revenue: number
}

type RevenueWilaya = {
  name: string
  revenue: number
}

type Option = {
  id: string
  name: string
}

interface AnalyticsClientProps {
  filters: AnalyticsFilters
  kpis: Kpis
  compareKpis?: Kpis | null
  compareLabel?: string | null
  salesSeries: SeriesPoint[]
  statusSeries: StatusPoint[]
  topBrands: TopItem[]
  topProducts: TopItem[]
  revenueByWilaya: RevenueWilaya[]
  brands: Option[]
  categories: Option[]
  departments: Option[]
  wilayas: Option[]
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
  }).format(price)
}

function formatDelta(current: number, previous?: number | null) {
  if (previous === null || previous === undefined) return null
  const delta = current - previous
  if (previous === 0) return `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}`
  const percent = (delta / previous) * 100
  const sign = percent >= 0 ? "+" : ""
  return `${sign}${percent.toFixed(1)}%`
}

function escapeCsv(value: string) {
  if (value.includes("\n") || value.includes("\r") || value.includes(",") || value.includes("\"")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmee",
  processing: "En traitement",
  shipped: "Expediee",
  delivered: "Livree",
  cancelled: "Annulee",
}

export function AnalyticsClient({
  filters,
  kpis,
  compareKpis,
  compareLabel,
  salesSeries,
  statusSeries,
  topBrands,
  topProducts,
  revenueByWilaya,
  brands,
  categories,
  departments,
  wilayas,
}: AnalyticsClientProps) {
  const router = useRouter()
  const [form, setForm] = useState<AnalyticsFilters>({
    from: filters.from || "",
    to: filters.to || "",
    status: filters.status || "",
    wilayaCode: filters.wilayaCode || "",
    brandId: filters.brandId || "",
    categoryId: filters.categoryId || "",
    departmentId: filters.departmentId || "",
  })

  const statusOptions = useMemo(
    () => [
      { id: "all", name: "Tous" },
      { id: "pending", name: STATUS_LABELS.pending },
      { id: "confirmed", name: STATUS_LABELS.confirmed },
      { id: "processing", name: STATUS_LABELS.processing },
      { id: "shipped", name: STATUS_LABELS.shipped },
      { id: "delivered", name: STATUS_LABELS.delivered },
      { id: "cancelled", name: STATUS_LABELS.cancelled },
    ],
    []
  )

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (form.from) params.set("from", form.from)
    if (form.to) params.set("to", form.to)
    if (form.status) params.set("status", form.status)
    if (form.wilayaCode) params.set("wilaya", form.wilayaCode)
    if (form.brandId) params.set("brand", form.brandId)
    if (form.categoryId) params.set("category", form.categoryId)
    if (form.departmentId) params.set("department", form.departmentId)
    const query = params.toString()
    router.push(`/admin/analytics${query ? `?${query}` : ""}`)
  }

  const resetFilters = () => {
    setForm({
      from: "",
      to: "",
      status: "",
      wilayaCode: "",
      brandId: "",
      categoryId: "",
      departmentId: "",
    })
    router.push("/admin/analytics")
  }

  const exportCsv = (extension: "csv" | "xls") => {
    const lines: string[] = []
    lines.push("Section,Metric,Value")
    lines.push(`KPI,Total revenue,${kpis.totalRevenue}`)
    lines.push(`KPI,Orders,${kpis.ordersCount}`)
    lines.push(`KPI,Avg order,${kpis.avgOrderValue}`)
    lines.push(`KPI,Items sold,${kpis.itemsSold}`)

    if (compareKpis && compareLabel) {
      lines.push(`Comparison,Label,${escapeCsv(compareLabel)}`)
      lines.push(`Comparison,Total revenue,${compareKpis.totalRevenue}`)
      lines.push(`Comparison,Orders,${compareKpis.ordersCount}`)
      lines.push(`Comparison,Avg order,${compareKpis.avgOrderValue}`)
      lines.push(`Comparison,Items sold,${compareKpis.itemsSold}`)
    }

    lines.push("\nSales series")
    lines.push("Label,Revenue,Orders")
    salesSeries.forEach((row) => {
      lines.push(`${escapeCsv(row.label)},${row.revenue},${row.orders}`)
    })

    lines.push("\nStatus distribution")
    lines.push("Status,Count")
    statusSeries.forEach((row) => {
      lines.push(`${escapeCsv(row.status)},${row.count}`)
    })

    lines.push("\nTop brands")
    lines.push("Brand,Qty,Revenue")
    topBrands.forEach((row) => {
      lines.push(`${escapeCsv(row.name)},${row.qty},${row.revenue}`)
    })

    lines.push("\nTop products")
    lines.push("Product,Qty,Revenue")
    topProducts.forEach((row) => {
      lines.push(`${escapeCsv(row.name)},${row.qty},${row.revenue}`)
    })

    lines.push("\nRevenue by wilaya")
    lines.push("Wilaya,Revenue")
    revenueByWilaya.forEach((row) => {
      lines.push(`${escapeCsv(row.name)},${row.revenue}`)
    })

    downloadFile(`analytics-export.${extension}`, lines.join("\n"))
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold text-foreground">Filtres</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCsv("csv")}>Exporter CSV</Button>
              <Button variant="outline" size="sm" onClick={() => exportCsv("xls")}>Exporter Excel</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Du</label>
            <Input
              type="date"
              value={form.from}
              onChange={(e) => setForm((prev) => ({ ...prev, from: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Au</label>
            <Input
              type="date"
              value={form.to}
              onChange={(e) => setForm((prev) => ({ ...prev, to: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Statut</label>
            <Select
              value={form.status || "all"}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, status: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Wilaya</label>
            <Select
              value={form.wilayaCode || "all"}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, wilayaCode: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {wilayas.map((wilaya) => (
                  <SelectItem key={wilaya.id} value={wilaya.id}>
                    {wilaya.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Marque</label>
            <Select
              value={form.brandId || "all"}
              onValueChange={(value) => setForm((prev) => ({ ...prev, brandId: value === "all" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Departement</label>
            <Select
              value={form.departmentId || "all"}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  departmentId: value === "all" ? "" : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Categorie</label>
            <Select
              value={form.categoryId || "all"}
              onValueChange={(value) => setForm((prev) => ({ ...prev, categoryId: value === "all" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters}>Appliquer</Button>
            <Button variant="outline" onClick={resetFilters}>
              Reinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Revenu total</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatPrice(kpis.totalRevenue)}</p>
            {compareKpis && compareLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDelta(kpis.totalRevenue, compareKpis.totalRevenue)} vs {compareLabel}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Commandes</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{kpis.ordersCount}</p>
            {compareKpis && compareLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDelta(kpis.ordersCount, compareKpis.ordersCount)} vs {compareLabel}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Panier moyen</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatPrice(kpis.avgOrderValue)}</p>
            {compareKpis && compareLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDelta(kpis.avgOrderValue, compareKpis.avgOrderValue)} vs {compareLabel}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Articles vendus</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{kpis.itemsSold}</p>
            {compareKpis && compareLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDelta(kpis.itemsSold, compareKpis.itemsSold)} vs {compareLabel}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">Ventes dans le temps</CardTitle>
          </CardHeader>
          <CardContent>
            {salesSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnee</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesSeries}>
                    <defs>
                      <linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip formatter={(value: number) => [formatPrice(value), "Revenu"]} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#analyticsRevenue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">Repartition des statuts</CardTitle>
          </CardHeader>
          <CardContent>
            {statusSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnee</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusSeries} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {statusSeries.map((entry, index) => (
                        <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, _name, props) => {
                        const label = STATUS_LABELS[props?.payload?.status] || props?.payload?.status
                        return [`${value} commandes`, label]
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                  <BarChart data={topBrands} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      formatter={(value: number, _name, props) => {
                        const revenue = props?.payload?.revenue ?? 0
                        return [`${value} ventes • ${formatPrice(revenue)}`, "Marque"]
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
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
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
    </div>
  )
}
