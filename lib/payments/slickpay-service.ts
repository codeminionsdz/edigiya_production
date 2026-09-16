import 'server-only'
import { getPaymentWithOrder, claimSlickPayInvoiceAttempt, completeSlickPayInvoiceAttempt, failSlickPayInvoiceAttempt, recordSlickPayVerification } from '@/lib/repositories'
import { createSlickPayInvoice, getSlickPayInvoice } from '@/lib/slickpay'

function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!value || !/^https:\/\/[^\s]+$/.test(value)) throw new Error('SLICKPAY_RETURN_URL_NOT_CONFIGURED')
  return value.replace(/\/$/, '')
}

export async function createSlickPayInvoiceForPayment(input: { paymentId: string; orderId: string; sessionId: string; customer: { firstName: string; lastName: string; phone: string; email: string } }) {
  const payment: any = await getPaymentWithOrder(input.paymentId, input.orderId)
  if (!payment || payment.orders?.session_id !== input.sessionId || payment.method !== 'slickpay') throw new Error('PAYMENT_NOT_FOUND')
  if (payment.status !== 'pending') throw new Error('PAYMENT_NOT_ELIGIBLE')
  if (payment.provider_reference && payment.provider_checkout_url) return { paymentUrl: payment.provider_checkout_url }
  const attempt = await claimSlickPayInvoiceAttempt(payment.id, `payment:${payment.id}:slickpay`, Number(payment.amount_dzd))
  if (attempt.status === 'created' && attempt.checkout_url) return { paymentUrl: attempt.checkout_url }
  if (!attempt.lease_token) throw new Error('SLICKPAY_INVOICE_IN_PROGRESS')
  try {
    const invoice = await createSlickPayInvoice({ amount: Number(payment.amount_dzd), returnUrl: `${siteUrl()}/checkout/slickpay-return?order=${encodeURIComponent(input.orderId)}&payment=${encodeURIComponent(input.paymentId)}`, ...input.customer })
    await completeSlickPayInvoiceAttempt(attempt.attempt_id, attempt.lease_token, invoice.id, invoice.url)
    return { paymentUrl: invoice.url }
  } catch (error) {
    await failSlickPayInvoiceAttempt(attempt.attempt_id, attempt.lease_token, 'provider request failed').catch(() => undefined)
    throw error
  }
}

export async function verifySlickPayPaymentForSession(input: { paymentId: string; orderId: string; sessionId: string }) {
  const payment: any = await getPaymentWithOrder(input.paymentId, input.orderId)
  if (!payment || payment.orders?.session_id !== input.sessionId || payment.method !== 'slickpay' || !payment.provider_reference) throw new Error('PAYMENT_NOT_FOUND')
  const invoice = await getSlickPayInvoice(payment.provider_reference)
  return recordSlickPayVerification(payment.id, payment.provider_reference, invoice.completed, invoice.status, Number(payment.amount_dzd))
}
