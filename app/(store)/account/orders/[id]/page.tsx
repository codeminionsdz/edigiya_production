"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Package,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/lib/locale-context";
import { formatPrice } from "@/lib/data";
import {
  getDeliveredFulfillmentItems,
  getOrderById,
} from "@/app/(store)/actions";

const deliveryLabels: Record<string, string> = {
  pending: "À préparer",
  processing: "Préparation en cours",
  delivered: "Produit livré",
  failed: "Livraison impossible",
  cancelled: "Livraison annulée",
};
export default function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await getOrderById(id);
        if (!active) return;
        setOrder(next);
        if (
          next?.payments?.[0]?.status === "paid" &&
          next?.order_fulfillments?.[0]?.status === "delivered"
        )
          setItems(await getDeliveredFulfillmentItems(id));
        else setItems([]);
      } catch {
        if (active) setOrder(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id]);
  if (loading)
    return (
      <main className="mx-auto max-w-[900px] px-5 py-12">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-8 h-64 w-full" />
      </main>
    );
  if (!order)
    return (
      <main className="mx-auto flex min-h-[60vh] flex-col items-center justify-center">
        <Package className="h-10 w-10 text-primary" />
        <p className="mt-4">
          {ar ? "الطلب غير موجود" : "Commande introuvable"}
        </p>
        <Link href="/account">
          <Button className="mt-5">{ar ? "العودة" : "Retour"}</Button>
        </Link>
      </main>
    );
  const payment = order.payments?.[0];
  const fulfillment = order.order_fulfillments?.[0];
  const deliveryLabel =
    payment?.status === "paid"
      ? deliveryLabels[fulfillment?.status || "pending"] || "À préparer"
      : "En attente du paiement";
  const paymentLabels: Record<string, string> = {
    flexy: "Flexy",
    ccp: "CCP",
    bank_transfer: "Virement bancaire",
  };
  return (
    <main dir={ar ? "rtl" : "ltr"} className="mx-auto max-w-[900px] px-5 py-10">
      <Link
        href="/account"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {ar ? "العودة إلى الحساب" : "Retour au compte"}
      </Link>
      <header className="mt-8 border-b border-border pb-6">
        <p className="text-xs uppercase tracking-widest text-primary">
          Edigiya / {ar ? "طلب" : "Commande"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{order.order_number}</h1>
      </header>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
        <section>
          <h2 className="flex items-center gap-2 border-b border-border pb-4 text-xl font-semibold">
            <Package className="h-5 w-5 text-primary" />
            {ar ? "العناصر" : "Articles"}
          </h2>
          <div className="divide-y divide-border">
            {order.order_items?.map((item: any) => (
              <div key={item.id} className="flex justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium">{item.title_snapshot}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.qty} × {formatPrice(Number(item.unit_price_dzd) || 0)}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatPrice(Number(item.line_total_dzd) || 0)}
                </span>
              </div>
            ))}
          </div>
          {items.length > 0 && <DeliveryContent items={items} />}
          <div className="mt-8 grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
            <Info
              icon={CreditCard}
              label={ar ? "طريقة الدفع" : "Paiement"}
              value={
                paymentLabels[payment?.method] ||
                payment?.method ||
                order.payment_method ||
                "—"
              }
            />
            <Info
              icon={Truck}
              label={ar ? "التسليم الرقمي" : "Livraison digitale"}
              value={deliveryLabel}
            />
          </div>
        </section>
        <aside className="h-fit border border-border bg-card p-6">
          <h2 className="font-semibold">{ar ? "ملخص" : "Résumé"}</h2>
          <div className="mt-6 flex justify-between text-sm">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{formatPrice(Number(order.subtotal_dzd) || 0)}</span>
          </div>
          <div className="mt-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Livraison digitale</span>
            <span>{formatPrice(0)}</span>
          </div>
          <div className="mt-5 flex justify-between border-t border-border pt-5 font-semibold">
            <span>Total</span>
            <span>{formatPrice(Number(order.total_dzd) || 0)}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
function DeliveryContent({ items }: { items: any[] }) {
  return (
    <div className="mt-8 border-t border-border pt-6">
      <h2 className="text-xl font-semibold">Votre produit est prêt</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-md border p-4">
            <p className="font-medium">{item.title}</p>
            {item.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </p>
            )}
            {item.type === "file" && (
              <a
                className="mt-3 inline-flex items-center gap-2 text-sm text-primary"
                href={item.download_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </a>
            )}
            {item.type === "link" && (
              <a
                className="mt-3 inline-flex items-center gap-2 text-sm text-primary"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Accéder au produit
              </a>
            )}
            {(item.type === "code" || item.type === "credential") && (
              <div className="mt-3 flex items-start justify-between gap-3 rounded bg-muted p-3">
                <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-sm">
                  {item.type === "code" ? item.code : item.message}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      item.type === "code" ? item.code : item.message,
                    )
                  }
                  aria-label="Copier"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}
            {item.type === "manual" && (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                {item.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
