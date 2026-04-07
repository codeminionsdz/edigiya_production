'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { adminGetOrderById, adminUpdateOrderStatus } from '@/app/admin/actions';

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  shipped: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En traitement',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
  }).format(price);
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    async function loadOrder() {
      setIsLoading(true);
      try {
        const result = await adminGetOrderById(orderId);
        setOrder(result);
        setStatus(result?.status || '');
        setAdminNote(result?.admin_note || '');
      } catch (error) {
        console.error('Failed to load order:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  const handleSave = async () => {
    if (!order) return;
    
    setIsSaving(true);
    try {
      await adminUpdateOrderStatus(orderId, {
        status,
        admin_note: adminNote,
      });
      alert('Commande mise à jour avec succès');
    } catch (error) {
      alert('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">Commande introuvable</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Link href="/admin/orders">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour aux commandes
        </Button>
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{order.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.created_at 
              ? new Date(order.created_at).toLocaleDateString('fr-DZ', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Date inconnue'}
          </p>
        </div>
        <Badge className={`${statusColors[order.status] || statusColors.pending} text-sm`}>
          {statusLabels[order.status] || order.status}
        </Badge>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Détails de la commande</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Méthode de paiement</p>
                  <p className="text-sm font-semibold">{order.payment_method}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Mode de livraison</p>
                  <p className="text-sm font-semibold capitalize">{order.delivery_method}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Sous-total</p>
                  <p className="text-sm font-semibold">{formatPrice(order.subtotal_dzd || 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Livraison</p>
                  <p className="text-sm font-semibold">{formatPrice(order.shipping_dzd || 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatPrice(order.total_dzd || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between border-b border-border pb-3 last:border-0">
                    <div>
                      <p className="font-medium">{item.title_snapshot}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.qty} x {formatPrice(item.unit_price_dzd)}
                      </p>
                    </div>
                    <p className="font-semibold">{formatPrice(item.line_total_dzd)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Adresse de livraison</CardTitle>
            </CardHeader>
            <CardContent>
              {order.address_snapshot ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">
                    {order.address_snapshot.firstName} {order.address_snapshot.lastName}
                  </p>
                  <p>{order.address_snapshot.address}</p>
                  {order.address_snapshot.stopDeskName && (
                    <p className="text-muted-foreground">
                      Point relais: {order.address_snapshot.stopDeskName}
                    </p>
                  )}
                  <p className="text-muted-foreground">{order.address_snapshot.phone}</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Pas d'adresse disponible</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Update Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mettre à jour le statut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-2">
                <label className="text-sm font-medium">Note admin</label>
                <Textarea
                  placeholder="Ajouter une note..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  'Enregistrer les modifications'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">ID Commande</p>
                <p className="font-mono text-xs break-all">{order.id}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Créée le</p>
                <p className="text-xs">
                  {new Date(order.created_at).toLocaleString('fr-DZ')}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Session</p>
                <p className="font-mono text-xs break-all">{order.session_id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
