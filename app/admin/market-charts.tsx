"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const COLORS = ["hsl(var(--primary))", "hsl(221 83% 53%)", "hsl(142 71% 45%)", "hsl(262 60% 55%)", "hsl(0 70% 55%)"]
type Metric = { name: string; qty: number; revenue: number }
function formatPrice(price: number) { return new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(price) }

export function MarketCharts({ topBrands, topProducts }: { topBrands: Metric[]; topProducts: Metric[] }) {
  return <div className="grid gap-4 lg:grid-cols-2"><Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Top marques</CardTitle></CardHeader><CardContent>{topBrands.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée</p> : <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={topBrands} dataKey="qty" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>{topBrands.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value: number, _name, props) => [`${value} ventes · ${formatPrice(props?.payload?.revenue ?? 0)}`, "Marque"]} /></PieChart></ResponsiveContainer></div>}</CardContent></Card><Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Top produits</CardTitle></CardHeader><CardContent>{topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée</p> : <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} /><Tooltip formatter={(value: number, _name, props) => [`${value} ventes · ${formatPrice(props?.payload?.revenue ?? 0)}`, "Produit"]} /><Bar dataKey="qty" fill="hsl(var(--primary))" radius={[3, 3, 3, 3]} /></BarChart></ResponsiveContainer></div>}</CardContent></Card></div>
}
