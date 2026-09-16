'use server'

import * as repo from '@/lib/repositories'
import { isManualPaymentMethod } from './types'

function hasValidImageSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  if (type === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return false
}

export async function createPaymentForOrder(orderId: string, method: string, amountDzd: number) {
  const supported = ['slickpay', 'flexy', 'ccp', 'bank_transfer', 'cod', 'cib', 'edahabia', 'bank']
  if (!supported.includes(method)) throw new Error('Mode de paiement non pris en charge.')
  if (method === 'slickpay') throw new Error('SlickPay nécessite sa documentation officielle avant intégration.')
  const idempotencyKey = `order:${orderId}:payment:${method}`
  try {
    const payment = await repo.createPayment({ order_id: orderId, method, amount_dzd: amountDzd, idempotency_key: idempotencyKey, provider: isManualPaymentMethod(method) ? method : undefined })
    await repo.createPaymentEvent({ payment_id: payment.id, event_type: 'payment_created', actor_type: 'customer', metadata: { method, amount_dzd: amountDzd } })
    return payment
  } catch (error: any) {
    if (String(error?.code) === '23505') {
      const existing = await repo.getPaymentWithOrder((await repo.adminGetOrderById(orderId)).payments?.[0]?.id || '')
      if (existing) return existing
    }
    throw error
  }
}

export async function submitPaymentProof(input: { paymentId: string; orderId: string; sessionId: string; file: File; reference?: string }) {
  const payment: any = await repo.getPaymentWithOrder(input.paymentId, input.orderId)
  if (!payment || payment.orders?.session_id !== input.sessionId) throw new Error('Paiement introuvable.')
  if (!isManualPaymentMethod(payment.method as string)) throw new Error('Une preuve est uniquement requise pour un paiement manuel.')
  if (!['pending', 'rejected', 'verification_required'].includes(payment.status)) throw new Error('Ce paiement ne peut plus être modifié.')
  if (!input.file || input.file.size === 0 || input.file.size > 8 * 1024 * 1024) throw new Error('La preuve doit faire au maximum 8 Mo.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.file.type)) throw new Error('Format accepté : JPG, PNG ou WebP.')
  if (payment.status === 'verification_required' && payment.proof_object_path) throw new Error('Une preuve a déjà été envoyée et est en cours de vérification.')
  const bytes = new Uint8Array(await input.file.arrayBuffer())
  if (!hasValidImageSignature(bytes, input.file.type)) throw new Error('Le contenu du fichier ne correspond pas à une image valide.')
  const file = new File([bytes], 'payment-proof', { type: input.file.type })
  const path = await repo.uploadPaymentProof(input.paymentId, input.orderId, file)
  let updated
  try {
    updated = await repo.submitPaymentProofAtomic(input.paymentId, input.orderId, input.sessionId, path, input.reference?.trim() || null)
  } catch (error) {
    try { await repo.deletePaymentProof(path) } catch (cleanupError) { console.error('Payment proof cleanup failed:', cleanupError) }
    throw error
  }
  return updated
}

export async function verifyManualPayment(paymentId: string, note?: string) {
  const payment: any = await repo.getPaymentWithOrder(paymentId)
  if (!payment || !isManualPaymentMethod(payment.method as string)) throw new Error('Paiement manuel introuvable.')
  if (!['pending', 'verification_required', 'paid'].includes(payment.status)) throw new Error('Transition de paiement invalide.')
  const orderId = payment.orders?.id || payment.order_id
  if (!orderId) throw new Error('Paiement sans commande.')
  return repo.confirmPaymentAndDeliverDigitalOrder(
    orderId,
    paymentId,
    `admin:payment-verification:${paymentId}`,
    note?.trim() || null,
  )
}

export async function rejectManualPayment(paymentId: string, reason: string) {
  const cleanReason = reason.trim()
  if (!cleanReason) throw new Error('Indiquez la raison du rejet.')
  const payment: any = await repo.getPaymentWithOrder(paymentId)
  if (!payment || !isManualPaymentMethod(payment.method as string)) throw new Error('Paiement manuel introuvable.')
  if (!['pending', 'verification_required'].includes(payment.status)) throw new Error('Transition de paiement invalide.')
  return repo.transitionAdminPaymentAtomic(paymentId, 'rejected', cleanReason)
}
