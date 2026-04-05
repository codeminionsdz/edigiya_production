import { AnalyticsClient } from "./analytics-client"
import {
  adminGetAnalyticsData,
  adminGetBrands,
  adminGetCategories,
  adminGetDepartments,
  adminGetWilayas,
} from "@/app/admin/actions"

function formatPriceNumber(value: number) {
  return Number.isFinite(value) ? value : 0
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function getOrderTotalDzd(order: any): number {
  const rawTotal = order?.total_dzd ?? order?.total ?? 0
  const parsedTotal = Number.parseFloat(String(rawTotal))
  return Number.isFinite(parsedTotal) ? parsedTotal : 0
}

function getDateRange(filters: { from?: string; to?: string }, orders: any[]) {
  const fromDate = filters.from ? new Date(filters.from) : null
  const toDate = filters.to ? new Date(filters.to) : null
  if (fromDate && toDate) return { from: fromDate, to: toDate }
  if (orders.length === 0) return { from: null, to: null }
  const dates = orders
    .map((order) => (order.created_at ? new Date(order.created_at) : null))
    .filter(Boolean) as Date[]
  if (dates.length === 0) return { from: null, to: null }
  const sorted = dates.sort((a, b) => a.getTime() - b.getTime())
  return { from: sorted[0], to: sorted[sorted.length - 1] }
}

function buildSalesSeries(orders: any[], fromDate: Date | null, toDate: Date | null) {
  if (orders.length === 0) return []

  const start = fromDate || new Date(orders[orders.length - 1].created_at)
  const end = toDate || new Date(orders[0].created_at)
  const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const useMonthly = diffDays > 120

  const buckets = new Map<string, { label: string; revenue: number; orders: number; date: Date }>()

  for (const order of orders) {
    if (!order.created_at) continue
    const date = new Date(order.created_at)
    const key = useMonthly
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : date.toISOString().slice(0, 10)

    const label = useMonthly
      ? date.toLocaleDateString("fr-DZ", { month: "short", year: "numeric" })
      : date.toLocaleDateString("fr-DZ", { day: "2-digit", month: "short" })

    const bucket = buckets.get(key) || { label, revenue: 0, orders: 0, date }
    bucket.revenue += getOrderTotalDzd(order)
    bucket.orders += 1
    buckets.set(key, bucket)
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ label, revenue, orders }) => ({ label, revenue, orders }))
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function buildCompareRange(filters: { from?: string; to?: string }) {
  if (!filters.from || !filters.to) return null
  const fromDate = new Date(filters.from)
  const toDate = new Date(filters.to)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null

  const diffMs = toDate.getTime() - fromDate.getTime()
  const previousTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000)
  const previousFrom = new Date(previousTo.getTime() - diffMs)

  return {
    from: formatIsoDate(previousFrom),
    to: formatIsoDate(previousTo),
    label: `${formatIsoDate(previousFrom)} -> ${formatIsoDate(previousTo)}`,
  }
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: {
    from?: string
    to?: string
    status?: string
    wilaya?: string
    brand?: string
    category?: string
    department?: string
  }
}) {
  const filters = {
    from: searchParams?.from,
    to: searchParams?.to,
    status: searchParams?.status,
    wilayaCode: searchParams?.wilaya,
    brandId: searchParams?.brand,
    categoryId: searchParams?.category,
    departmentId: searchParams?.department,
  }

  const compareRange = buildCompareRange(filters)

  const [analyticsData, compareData, brandsData, categoriesData, departmentsData, wilayasData] = await Promise.all([
    adminGetAnalyticsData(filters),
    compareRange
      ? adminGetAnalyticsData({
          ...filters,
          from: compareRange.from,
          to: compareRange.to,
        })
      : Promise.resolve({ orders: [], orderItems: [] }),
    adminGetBrands(),
    adminGetCategories(),
    adminGetDepartments(),
    adminGetWilayas(),
  ])

  const orders = "error" in analyticsData ? [] : (analyticsData.orders || [])
  const orderItems = "error" in analyticsData ? [] : (analyticsData.orderItems || [])

  const compareOrders = "error" in compareData ? [] : (compareData.orders || [])
  const compareItems = "error" in compareData ? [] : (compareData.orderItems || [])

  const totalRevenue = orders.reduce((sum: number, order: any) => sum + getOrderTotalDzd(order), 0)
  const ordersCount = orders.length
  const avgOrderValue = ordersCount > 0 ? totalRevenue / ordersCount : 0
  const itemsSold = orderItems.reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0)

  const compareRevenue = compareOrders.reduce((sum: number, order: any) => sum + getOrderTotalDzd(order), 0)
  const compareOrdersCount = compareOrders.length
  const compareAvgOrderValue = compareOrdersCount > 0 ? compareRevenue / compareOrdersCount : 0
  const compareItemsSold = compareItems.reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0)

  const { from, to } = getDateRange(filters, orders)
  const salesSeries = buildSalesSeries(orders, from, to)

  const statusMap = new Map<string, number>()
  orders.forEach((order: any) => {
    const status = order.status || "pending"
    statusMap.set(status, (statusMap.get(status) || 0) + 1)
  })
  const statusSeries = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))

  const brandAgg = new Map<string, { qty: number; revenue: number }>()
  const productAgg = new Map<string, { qty: number; revenue: number }>()

  for (const item of orderItems) {
    const qty = Number(item.qty || 0)
    const revenue = Number.parseFloat(String(item.line_total_dzd || 0)) || 0
    const product = relationOne<any>(item.products)
    const brand = relationOne<any>(product?.brands)
    const productName = product?.title_fr || product?.title_ar || "Produit"
    const brandName = brand?.name || "Sans marque"

    const brandEntry = brandAgg.get(brandName) || { qty: 0, revenue: 0 }
    brandEntry.qty += qty
    brandEntry.revenue += revenue
    brandAgg.set(brandName, brandEntry)

    const productEntry = productAgg.get(productName) || { qty: 0, revenue: 0 }
    productEntry.qty += qty
    productEntry.revenue += revenue
    productAgg.set(productName, productEntry)
  }

  const topBrands = Array.from(brandAgg.entries())
    .map(([name, stats]) => ({ name, qty: stats.qty, revenue: formatPriceNumber(stats.revenue) }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6)

  const topProducts = Array.from(productAgg.entries())
    .map(([name, stats]) => ({ name, qty: stats.qty, revenue: formatPriceNumber(stats.revenue) }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6)

  const wilayaMap = new Map<string, string>()
  if (!("error" in wilayasData)) {
    wilayasData.forEach((wilaya: any) => {
      wilayaMap.set(String(wilaya.code), wilaya.name_fr || "")
    })
  }

  const revenueByWilayaMap = new Map<string, number>()
  orders.forEach((order: any) => {
    const code = order.wilaya_code ? String(order.wilaya_code) : ""
    const name = wilayaMap.get(code) || "Inconnu"
    revenueByWilayaMap.set(name, (revenueByWilayaMap.get(name) || 0) + getOrderTotalDzd(order))
  })

  const revenueByWilaya = Array.from(revenueByWilayaMap.entries())
    .map(([name, revenue]) => ({ name, revenue: formatPriceNumber(revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  const brands = "error" in brandsData ? [] : (brandsData || [])
  const categories = "error" in categoriesData ? [] : (categoriesData || [])
  const departments = "error" in departmentsData ? [] : (departmentsData || [])
  const wilayas = "error" in wilayasData ? [] : (wilayasData || [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Analyses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analysez les ventes, produits et performances du marche.
        </p>
      </div>

      <AnalyticsClient
        filters={filters}
        kpis={{
          totalRevenue,
          ordersCount,
          avgOrderValue,
          itemsSold,
        }}
        compareKpis={compareRange ? {
          totalRevenue: compareRevenue,
          ordersCount: compareOrdersCount,
          avgOrderValue: compareAvgOrderValue,
          itemsSold: compareItemsSold,
        } : null}
        compareLabel={compareRange?.label || null}
        salesSeries={salesSeries}
        statusSeries={statusSeries}
        topBrands={topBrands}
        topProducts={topProducts}
        revenueByWilaya={revenueByWilaya}
        brands={brands.map((brand: any) => ({ id: brand.id, name: brand.name }))}
        categories={categories.map((category: any) => ({ id: category.id, name: category.name_fr || category.name_ar || "" }))}
        departments={departments.map((department: any) => ({ id: department.id, name: department.name_fr || department.name_ar || "" }))}
        wilayas={wilayas.map((wilaya: any) => ({ id: String(wilaya.code), name: wilaya.name_fr }))}
      />
    </div>
  )
}
