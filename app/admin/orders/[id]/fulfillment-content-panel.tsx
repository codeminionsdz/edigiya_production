'use client';

import { useEffect, useState } from 'react';
import { FilePlus2, Link as LinkIcon, Loader2, MessageSquare, Trash2, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { adminAddFulfillmentItem, adminDeleteFulfillmentItem, adminDeliverOrder, adminGetFulfillmentItems, adminPrepareFulfillment } from '@/app/admin/actions';

const labels: Record<string, string> = { file: 'Fichier', link: 'Lien', code: 'Code', manual: 'Message' };

export function FulfillmentContentPanel({ order, onFulfillmentReady }: { order: any; onFulfillmentReady?: (fulfillment: any, itemCount: number) => void }) {
  const [fulfillment, setFulfillment] = useState<any>(order.order_fulfillments?.[0] || null);
  const [items, setItems] = useState<any[]>([]); const [preparing, setPreparing] = useState(false); const [delivering, setDelivering] = useState(false); const [prepareError, setPrepareError] = useState(''); const [type, setType] = useState<'file' | 'link' | 'code' | 'manual'>('manual');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [value, setValue] = useState(''); const [file, setFile] = useState<File | undefined>(); const [busy, setBusy] = useState(false);
  const eligible = order.delivery_method === 'digital' && order.payments?.[0]?.status === 'paid';
  async function refresh(id: string) { const result = await adminGetFulfillmentItems(id); if (result.success) { const nextItems = result.items || []; setItems(nextItems); return nextItems; } return []; }
  useEffect(() => { if (!eligible) return; let active = true; setPreparing(true); setPrepareError(''); (async () => { try { const prepared = fulfillment || (await adminPrepareFulfillment(order.id)).fulfillment; if (prepared && active) { setFulfillment(prepared); const nextItems = await refresh(prepared.id); if (active) onFulfillmentReady?.(prepared, nextItems.length); } } catch { if (active) setPrepareError('Impossible de préparer la livraison.'); } finally { if (active) setPreparing(false); } })(); return () => { active = false }; }, [eligible, order.id]);
  async function add() { if (!fulfillment || !title.trim() || busy) return; setBusy(true); const result = await adminAddFulfillmentItem({ fulfillmentId: fulfillment.id, type, title, description, file: type === 'file' ? file : undefined, url: type === 'link' ? value : undefined, code: type === 'code' ? value : undefined, message: type === 'manual' ? value : undefined }); setBusy(false); if (!result.success) return alert(result.error); setTitle(''); setDescription(''); setValue(''); setFile(undefined); await refresh(fulfillment.id); }
  async function remove(id: string) { if (!confirm('Supprimer ce contenu ?')) return; const result = await adminDeleteFulfillmentItem(id); if (!result.success) alert('error' in result ? result.error : 'Impossible de supprimer ce contenu.'); else setItems(items.filter((item) => item.id !== id)); }
  async function deliver() { if (!fulfillment || !items.length || delivering) return; setDelivering(true); const result = await adminDeliverOrder(order.id); setDelivering(false); if (!result.success) alert(result.error); else window.location.reload(); }
  return <Card><CardHeader><CardTitle>Contenu de la livraison</CardTitle></CardHeader><CardContent className="space-y-5">
    {!eligible ? <p className="text-sm text-muted-foreground">Le contenu est disponible uniquement pour une commande digitale dont le paiement est vérifié.</p> : <>
      {items.length > 0 && <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-md border p-3"><div className="min-w-0"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{labels[item.type]}{item.original_filename ? ` · ${item.original_filename}` : ''}{item.file_size_bytes ? ` · ${Math.ceil(Number(item.file_size_bytes) / 1024)} Ko` : ''}</p></div><Button variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
      <div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Titre du contenu" value={title} onChange={(e) => setTitle(e.target.value)} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}><option value="manual">Message</option><option value="file">Fichier</option><option value="link">Lien</option><option value="code">Code</option></select></div>
      <Textarea placeholder="Description (optionnelle)" value={description} onChange={(e) => setDescription(e.target.value)} />
      {type === 'file' ? <Input type="file" onChange={(e) => setFile(e.target.files?.[0])} /> : <Textarea placeholder={type === 'link' ? 'https://...' : type === 'code' ? 'Code à remettre au client' : 'Message de livraison'} value={value} onChange={(e) => setValue(e.target.value)} />}
      {prepareError && <p className="text-sm text-destructive">{prepareError}</p>}
      <Button onClick={add} disabled={preparing || busy || !fulfillment || !title.trim() || (type === 'file' ? !file : !value.trim())}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}Ajouter un contenu</Button>
      {items.length > 0 && fulfillment?.status !== 'delivered' && <div className="border-t pt-5"><Button onClick={deliver} disabled={delivering} className="bg-primary">{delivering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Marquer comme livrée</Button><p className="mt-2 text-xs text-muted-foreground">Le client verra ce contenu après la livraison.</p></div>}
    </>}
  </CardContent></Card>;
}
