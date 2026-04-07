'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { adminGetWilayas, adminGetShippingRates, adminUpdateShippingRate } from '@/app/admin/actions';

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
  }).format(price);
}

export default function AdminShippingPage() {
  const [wilayas, setWilayas] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [wilayasData, ratesData] = await Promise.all([
          adminGetWilayas(),
          adminGetShippingRates(),
        ]);
        setWilayas(Array.isArray(wilayasData) ? wilayasData : []);
        setRates(Array.isArray(ratesData) ? ratesData : []);
      } catch (error) {
        console.error('Failed to load shipping data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const filtered = wilayas.filter(
    (w) => !search || w.name_fr?.toLowerCase().includes(search.toLowerCase()) ||
            w.name_ar?.toLowerCase().includes(search.toLowerCase()) ||
            w.code?.includes(search)
  );

  const getRateForWilaya = (wilayaCode: string, method: string) => {
    return rates.find((r) => r.wilaya_code === wilayaCode && r.method === method);
  };

  const handleEditRate = (wilayaCode: string, method: string) => {
    const rate = getRateForWilaya(wilayaCode, method);
    setEditingId(`${wilayaCode}-${method}`);
    setFormData({
      wilayaCode,
      method,
      price_dzd: rate?.price_dzd || 0,
      eta_min_days: rate?.eta_min_days || 2,
      eta_max_days: rate?.eta_max_days || 5,
    });
  };

  const handleSaveRate = async () => {
    if (!editingId) return;

    setIsSaving(true);
    try {
      await adminUpdateShippingRate(formData.wilayaCode, formData.method, {
        price_dzd: parseFloat(formData.price_dzd),
        eta_min_days: parseInt(formData.eta_min_days),
        eta_max_days: parseInt(formData.eta_max_days),
      });

      const updatedRates = rates.map((r) => {
        if (r.wilaya_code === formData.wilayaCode && r.method === formData.method) {
          return { ...r, ...formData };
        }
        return r;
      });
      setRates(updatedRates);
      setEditingId(null);
    } catch (error) {
      alert('Erreur lors de la mise à jour du tarif');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Gestion de livraison</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurez les frais et délais de livraison par wilaya et méthode
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher une wilaya..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Wilayas Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Wilaya
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Méthode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Prix
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Délai
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.flatMap((wilaya) => {
                  const homeRate = getRateForWilaya(wilaya.code, 'home');
                  const stopRate = getRateForWilaya(wilaya.code, 'stopdesk');
                  const methods = [
                    { label: 'À domicile', key: 'home', rate: homeRate },
                    { label: 'Arrêt de bus', key: 'stopdesk', rate: stopRate },
                  ];
                  return methods.map((method, idx) => (
                    <tr
                      key={`${wilaya.code}-${method.key}`}
                      className={`border-b border-border hover:bg-muted/50 ${idx === 0 ? 'bg-muted/20' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {idx === 0 && (
                          <div className="flex flex-col gap-0.5">
                            <p className="font-medium text-foreground">{wilaya.name_fr}</p>
                            <p className="text-xs text-muted-foreground">{wilaya.code}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{method.label}</td>
                      <td className="px-4 py-3 text-sm">
                        {editingId === `${wilaya.code}-${method.key}` ? (
                          <Input
                            type="number"
                            value={formData.price_dzd}
                            onChange={(e) => setFormData({ ...formData, price_dzd: e.target.value })}
                            className="w-24"
                          />
                        ) : (
                          formatPrice(method.rate?.price_dzd || 0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingId === `${wilaya.code}-${method.key}` ? (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={formData.eta_min_days}
                              onChange={(e) => setFormData({ ...formData, eta_min_days: e.target.value })}
                              className="w-12"
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                              type="number"
                              min="1"
                              value={formData.eta_max_days}
                              onChange={(e) => setFormData({ ...formData, eta_max_days: e.target.value })}
                              className="w-12"
                            />
                          </div>
                        ) : (
                          `${method.rate?.eta_min_days || 0} - ${method.rate?.eta_max_days || 0} j`
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === `${wilaya.code}-${method.key}` ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveRate}
                              disabled={isSaving}
                            >
                              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              Annuler
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRate(wilaya.code, method.key)}
                          >
                            Modifier
                          </Button>
                        )}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Total: {filtered.length} wilaya(s) × 2 méthodes = {filtered.length * 2} tarifs
      </p>
    </div>
  );
}
