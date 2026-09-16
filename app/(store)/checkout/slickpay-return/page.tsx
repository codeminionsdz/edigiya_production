import Link from 'next/link'
import { verifySlickPayReturnAction } from '../actions'

export default async function SlickPayReturnPage({ searchParams }: { searchParams: Promise<{ order?: string; payment?: string }> }) {
  const params = await searchParams
  const result = params.order && params.payment ? await verifySlickPayReturnAction(params.order, params.payment) : { error: 'Réponse de paiement invalide.' }
  const paid = result.success && result.status === 'paid'
  return <main className="flex min-h-[70vh] items-center justify-center bg-[#f8f9f7] px-5"><section className="w-full max-w-lg border border-border bg-card p-8 text-center"><div className={`mx-auto flex h-14 w-14 items-center justify-center ${paid ? 'bg-primary text-primary-foreground' : 'bg-amber-500/10 text-amber-700'}`}>{paid ? '✓' : '…'}</div><p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">SlickPay · Edigiya</p><h1 className="mt-3 font-heading text-3xl font-semibold">{paid ? 'Paiement confirmé' : 'Vérification en cours'}</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">{paid ? 'Votre paiement a été confirmé. La livraison numérique suivra le processus habituel.' : 'Nous vérifions le paiement auprès de SlickPay. Aucun paiement n’est marqué comme confirmé sans cette vérification.'}</p><Link href={params.order ? `/account/orders/${params.order}` : '/account'} className="mt-7 inline-flex h-11 items-center justify-center bg-primary px-5 text-sm font-semibold text-primary-foreground">Voir ma commande</Link></section></main>
}
