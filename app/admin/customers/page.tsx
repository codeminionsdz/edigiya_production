"use client"

import { useEffect, useState } from "react"
import { Search, Users, Mail, Phone, MapPin, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPrice } from "@/lib/data"
import { adminGetCustomers } from "@/app/admin/actions"

type AdminCustomer = {
  id: string
  name: string
  email: string
  phone: string
  wilaya_name_fr: string
  orders_count: number
  total_spent_dzd: number
  join_date: string | null
  last_order_at: string | null
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("fr-DZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function exportToExcel(customers: AdminCustomer[]) {
  // Create a more professional Excel format with headers
  const now = new Date();
  const reportDate = now.toLocaleDateString("fr-DZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Prepare the data with formatting
  const headers = {
    ar: ["الاسم الكامل", "البريد الإلكتروني", "رقم الهاتف", "الولاية", "عدد الطلبيات", "إجمالي المشتريات (DZD)", "تاريخ آخر طلبية", "تاريخ التسجيل"],
    en: ["Full Name", "Email", "Phone", "Wilaya", "Orders", "Total Spent", "Last Order", "Join Date"]
  };

  // Build the sheet content
  let csvContent = "\uFEFF"; // UTF-8 BOM
  
  // Add title
  csvContent += "تقرير العملاء - Edigiya\n";
  csvContent += `تاريخ التقرير: ${reportDate}\n`;
  csvContent += `عدد العملاء: ${customers.length}\n`;
  csvContent += "\n";
  
  // Add headers in Arabic
  csvContent += headers.ar.join(",") + "\n";
  
  // Add data rows
  customers.forEach(c => {
    const row = [
      c.name,
      c.email || "-",
      c.phone || "-",
      c.wilaya_name_fr || "-",
      c.orders_count,
      c.total_spent_dzd || 0,
      formatDate(c.last_order_at),
      formatDate(c.join_date)
    ];
    csvContent += row.map(cell => {
      const str = String(cell);
      return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",") + "\n";
  });
  
  // Add summary
  csvContent += "\n";
  csvContent += "---,---,---,---\n";
  const totalSpent = customers.reduce((sum, c) => sum + (c.total_spent_dzd || 0), 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.orders_count, 0);
  csvContent += `الإجمالي,,${totalOrders},${totalSpent}\n`;

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `Nutrition_Clients_${reportDate}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("")
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadCustomers() {
      setIsLoading(true)
      try {
        const result = await adminGetCustomers()
        if (!active) return
        if ("error" in result) {
          console.error("Failed to load customers:", result.error)
          setCustomers([])
          return
        }
        setCustomers((result.customers || []) as AdminCustomer[])
      } catch (error) {
        if (active) {
          console.error("Failed to load customers:", error)
          setCustomers([])
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadCustomers()

    return () => {
      active = false
    }
  }, [])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.wilaya_name_fr.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">{customers.length} clients enregistres</p>
        </div>
        <Button onClick={() => exportToExcel(filtered)} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Télécharger Excel
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telephone</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wilaya</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commandes</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total depense</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Derniere commande</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="px-4 py-4" colSpan={6}>
                        <Skeleton className="h-10 w-full" />
                      </td>
                    </tr>
                  ))
                : filtered.map((customer) => (
                    <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {getInitials(customer.name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.email || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{customer.phone || "-"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{customer.wilaya_name_fr || "-"}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-primary/10 text-primary">{customer.orders_count}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">
                        {formatPrice(customer.total_spent_dzd || 0)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(customer.last_order_at)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
                              <Users className="h-3.5 w-3.5" />
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="font-heading">{customer.name}</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col gap-4 pt-2">
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <Mail className="h-4 w-4 text-primary" /> {customer.email || "-"}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4 text-primary" /> {customer.phone || "-"}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4 text-primary" /> {customer.wilaya_name_fr || "-"}
                              </div>
                              <Separator />
                              <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="rounded-lg bg-muted p-3">
                                  <p className="text-lg font-bold text-foreground">{customer.orders_count}</p>
                                  <p className="text-xs text-muted-foreground">Commandes</p>
                                </div>
                                <div className="rounded-lg bg-muted p-3">
                                  <p className="text-lg font-bold text-foreground">
                                    {formatPrice(customer.total_spent_dzd || 0)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Total</p>
                                </div>
                                <div className="rounded-lg bg-muted p-3">
                                  <p className="text-sm font-bold text-foreground">
                                    {formatDate(customer.join_date)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Inscrit</p>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
