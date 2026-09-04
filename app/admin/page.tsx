import Link from "next/link"
import {
  DollarSign, ShoppingCart, AlertTriangle, ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardCharts } from "./dashboard-charts"
import { MarketCharts } from "./market-charts"
import { RealtimeVisitors } from "@/components/admin/realtime-visitors"
import { adminGetOrders, adminGetProducts, adminGetOrderItemsAnalytics } from "@/app/admin/actions"

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
  }).format(price)
}

function getOrderTotalDzd(order: any): number {
  const rawTotal = order?.total_dzd ?? order?.total ?? 0
  const parsedTotal = Number.parseFloat(String(rawTotal))
  return Number.isFinite(parsedTotal) ? parsedTotal : 0
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

type DashboardOrder = {
  id: string
  order_number?: string
  created_at?: string
  status?: string
  total_dzd?: number | string | null
  total?: number | string | null
}

type DashboardProduct = {
  id: string
  stock: number
  title_fr?: string
  sku?: string | null
}

type OrderItemRow = {
  qty: number
  line_total_dzd: number
  products?:
    | {
        title_fr?: string | null
        title_ar?: string | null
        brands?: { name?: string | null } | { name?: string | null }[] | null
      }
    | Array<{
        title_fr?: string | null
        title_ar?: string | null
        brands?: { name?: string | null } | { name?: string | null }[] | null
      }>
    | null
}

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
}

const statusLabels: Record<string, string> = {
  confirmed: "Confirmee",
  processing: "En traitement",
  shipped: "Expediee",
  delivered: "Livree",
  cancelled: "Annulee",
  pending: "En attente",
}

export default async function AdminDashboard() {
  try {
    const [ordersData, productsData, orderItemsData] = await Promise.all([
      adminGetOrders({ limit: 1000 }),
      adminGetProducts({ limit: 1000 }),
      adminGetOrderItemsAnalytics(5000),
    ])

    const orders: DashboardOrder[] = "error" in ordersData ? [] : (ordersData.orders || [])
    const allProducts: DashboardProduct[] = "error" in productsData ? [] : (productsData.products || [])
    const orderItems: OrderItemRow[] = "error" in orderItemsData ? [] : ((orderItemsData.items || []) as OrderItemRow[])
    const lowStockProducts = allProducts.filter((p) => p.stock <= 10).sort((a, b) => a.stock - b.stock)
    
    const totalRevenue = orders.reduce((sum, order) => sum + getOrderTotalDzd(order), 0)
    const ordersCount = orders.length

    const kpis = [
      {
        title: "Revenu total",
        value: formatPrice(totalRevenue),
        icon: DollarSign,
      },
      {
        title: "Commandes",
        value: ordersCount.toString(),
        icon: ShoppingCart,
      },
      {
        title: "Produits",
        value: allProducts.length.toString(),
        icon: ShoppingCart,
      },
      {
        title: "Stock faible",
        value: lowStockProducts.length.toString(),
        icon: AlertTriangle,
      },
    ]

    const monthlyData = new Map<string, { revenue: number; orders: number }>()
    for (const order of orders) {
      const createdAt = order?.created_at ? new Date(order.created_at) : null
      if (!createdAt || Number.isNaN(createdAt.getTime())) continue

      const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`
      const existing = monthlyData.get(monthKey) || { revenue: 0, orders: 0 }

      monthlyData.set(monthKey, {
        revenue: existing.revenue + getOrderTotalDzd(order),
        orders: existing.orders + 1,
      })
    }

    const now = new Date()
    const salesData = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`
      const values = monthlyData.get(monthKey) || { revenue: 0, orders: 0 }

      return {
        month: monthDate.toLocaleDateString("fr-DZ", { month: "short" }),
        revenue: values.revenue,
        orders: values.orders,
      }
    })

    const recentOrders = orders.slice(0, 6)

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
      .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6)

    const topProducts = Array.from(productAgg.entries())
      .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6)

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue opérationnelle de votre activité Edigiya
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{kpi.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <kpi.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <DashboardCharts salesData={salesData} />

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Activite recente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total des commandes</span>
                <span className="font-semibold">{ordersCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Produits en stock</span>
                <span className="font-semibold">{allProducts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stock faible (&lt;10)</span>
                <span className="font-semibold text-amber-600">{lowStockProducts.length}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Revenu moyen/commande</span>
                <span className="font-semibold">{formatPrice(ordersCount > 0 ? totalRevenue / ordersCount : 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market insights */}
        <MarketCharts
          topBrands={topBrands}
          topProducts={topProducts}
        />

        {/* Recent Orders + Low Stock */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Recent Orders */}
          <Card className="border-border lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Commandes recentes</CardTitle>
              <Link href="/admin/orders">
                <Button variant="ghost" size="sm" className="gap-1 text-primary">
                  Voir tout
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune commande pour le moment</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Commande
                        </th>
                        <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Date
                        </th>
                        <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Total
                        </th>
                        <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => {
                        const orderStatus = order.status || "pending"

                        return (
                          <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                            <td className="px-3 py-3">
                              <Link href={`/admin/orders/${order.id}`}>
                                <span className="font-mono text-xs font-medium text-primary hover:underline">{order.order_number}</span>
                              </Link>
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString("fr-DZ") : "-"}
                            </td>
                            <td className="px-3 py-3 text-sm font-semibold text-foreground">
                              {formatPrice(getOrderTotalDzd(order))}
                            </td>
                            <td className="px-3 py-3">
                              <Badge className={`${statusColors[orderStatus] || statusColors.pending} text-xs`}>
                                {statusLabels[orderStatus] || orderStatus}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Stock faible</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tous les produits sont bien stockes</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {lowStockProducts.slice(0, 6).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-foreground line-clamp-1">
                          {product.title_fr}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{product.sku}</p>
                      </div>
                      <Badge
                        className={`${
                          product.stock <= 5
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {product.stock}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Real-time Visitors */}
        <RealtimeVisitors />
      </div>
    )
  } catch (error) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue opérationnelle de votre activité Edigiya
          </p>
        </div>
        <Card className="border-border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10">
          <CardContent className="p-5">
            <p className="text-sm text-red-700 dark:text-red-400">
              Erreur lors du chargement des donnees du tableau de bord. Veuillez verifier votre connexion a la base de donnees.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
}
