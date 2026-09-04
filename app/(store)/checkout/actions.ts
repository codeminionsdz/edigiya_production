'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { adminGetOrderById, createOrderPaymentAtomic, getCheckoutProductsByIds, getResumableCheckoutForSession, getStoreSettings } from '@/lib/repositories'
import { submitPaymentProof } from '@/lib/payments/service'
import { buildOrderContactMessage } from '@/lib/order-contact-message'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getResumableCheckoutAction(orderHint?: string) {
  try {
    const sessionId = (await cookies()).get('session_id')?.value
    if (!sessionId || !uuidRegex.test(sessionId)) return null
    return await getResumableCheckoutForSession(sessionId, orderHint && uuidRegex.test(orderHint) ? orderHint : undefined)
  } catch (error) {
    console.error('Failed to resume checkout:', error)
    return null
  }
}

export async function placeOrder(formData: FormData) {
  try {
    const sessionId = (await cookies()).get('session_id')?.value
    if (!sessionId || !uuidRegex.test(sessionId)) return { error: 'Session invalide. Veuillez rafraîchir la page.' }
    const firstName = String(formData.get('firstName') || '').trim(), lastName = String(formData.get('lastName') || '').trim(), email = String(formData.get('email') || '').trim(), phone = String(formData.get('phone') || '').trim()
    const deliveryMethod = 'digital', paymentMethod = String(formData.get('paymentMethod') || 'flexy')
    const checkoutKey = String(formData.get('checkoutKey') || '').trim()
    if (!['flexy', 'ccp', 'bank_transfer'].includes(paymentMethod)) return { error: 'Cette méthode de paiement n’est pas disponible pour un achat numérique.' }
    let paymentSettings: any
    try { paymentSettings = await getStoreSettings() } catch { return { error: 'Les méthodes de paiement sont temporairement indisponibles. Veuillez réessayer plus tard.' } }
    const configured = paymentMethod === 'flexy'
      ? Boolean(String(paymentSettings?.flexy_number || '').trim() && String(paymentSettings?.flexy_instructions || '').trim())
      : paymentMethod === 'ccp'
        ? Boolean(String(paymentSettings?.ccp_instructions || '').trim())
        : Boolean(String(paymentSettings?.bank_instructions || '').trim())
    if (!configured) return { error: 'Cette méthode de paiement est temporairement indisponible. Veuillez choisir une autre méthode.' }
    if (!firstName || !lastName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !uuidRegex.test(checkoutKey)) return { error: 'Veuillez compléter vos informations avec une adresse e-mail valide.' }
    let requestedItems: any[]; try { requestedItems = JSON.parse(String(formData.get('cartItems') || '[]')) } catch { return { error: 'Panier invalide.' } }
    if (!Array.isArray(requestedItems) || requestedItems.length === 0) return { error: 'Votre panier est vide.' }
    const normalized = requestedItems.map((item) => ({ productId: String(item?.product?.id || ''), quantity: Number(item?.quantity || 0), variantId: item?.variantId ? String(item.variantId) : undefined }))
    if (normalized.some((item) => !uuidRegex.test(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) return { error: 'Article de panier invalide.' }
    const products = await getCheckoutProductsByIds(normalized.map((item) => item.productId))
    if (products.length !== normalized.length) return { error: 'Un produit du panier n’est plus disponible.' }
    const productById = new Map(products.map((product: any) => [product.id, product])); let subtotal = 0
    const authoritativeItems = normalized.map((item) => { const product: any = productById.get(item.productId); if (!product?.is_active) throw new Error(`Le produit ${product?.title_fr || ''} n’est plus disponible.`); const variant = item.variantId ? (product.product_variants || []).find((candidate: any) => candidate.id === item.variantId && candidate.product_id === product.id) : null; if (item.variantId && !variant) throw new Error('La variante sélectionnée est invalide.'); const stock = variant ? variant.stock : product.stock; if (stock !== null && stock < item.quantity) throw new Error(`Le produit ${product.title_fr} n’est plus disponible.`); const unitPrice = Number(product.price_dzd) + Number(variant?.price_delta_dzd || 0); const lineTotal = unitPrice * item.quantity; subtotal += lineTotal; return { product, variantId: item.variantId || null, quantity: item.quantity, unitPrice, lineTotal } })
    const shipping = 0, total = subtotal
    const orderNumber = `CH-${Date.now()}`
    const result = await createOrderPaymentAtomic({ orderNumber, checkoutKey, sessionId, paymentMethod, subtotal, shipping, total, wilayaCode: null, deliveryMethod, addressSnapshot: { firstName, lastName, email, phone }, items: authoritativeItems.map((item) => ({ product_id: item.product.id, variant_id: item.variantId, title_snapshot: item.product.title_fr, unit_price_dzd: item.unitPrice, qty: item.quantity, line_total_dzd: item.lineTotal })) }); revalidatePath('/admin/orders')
    const created = await adminGetOrderById(result.order_id)
    const payment = created.payments?.[0]
    const paymentStatus = payment?.status || 'pending'
    const createdOrder = { subtotal: Number(created.subtotal_dzd), total: Number(created.total_dzd), shipping: Number(created.shipping_dzd), items: (created.order_items || []).map((item: any) => ({ id: item.id, title: item.title_snapshot, qty: item.qty, unitPrice: Number(item.unit_price_dzd), lineTotal: Number(item.line_total_dzd) })) }
    const customer = created.address_snapshot || {}
    return { success: true, orderId: result.order_id, orderNumber: result.order_number, paymentId: result.payment_id, paymentStatus, amount: total, createdOrder, contactMessage: buildOrderContactMessage({ orderNumber: created.order_number, items: created.order_items?.map((item: any) => ({ title: item.title_snapshot, qty: Number(item.qty), unitPrice: Number(item.unit_price_dzd) })), total: Number(created.total_dzd), method: payment?.method, status: paymentStatus, customer: { name: [customer.firstName, customer.lastName].filter(Boolean).join(' '), phone: customer.phone, email: customer.email } }) }
  } catch (error: any) { console.error('Order placement failed:', error); return { error: error?.message || 'Erreur lors de la création de la commande.' } }
}

export async function submitPaymentProofAction(formData: FormData) {
  try {
    const sessionId = (await cookies()).get('session_id')?.value, paymentId = String(formData.get('paymentId') || ''), orderId = String(formData.get('orderId') || ''), file = formData.get('proof')
    if (!sessionId || !uuidRegex.test(sessionId) || !uuidRegex.test(paymentId) || !uuidRegex.test(orderId) || !(file instanceof File)) return { error: 'Données de preuve invalides.' }
    const payment = await submitPaymentProof({ paymentId, orderId, sessionId, file, reference: String(formData.get('reference') || '') }); return { success: true, status: payment.status }
  } catch (error: any) {
    const message = String(error?.message || '')
    const safe = ['Paiement introuvable.', 'Une preuve est uniquement requise pour un paiement manuel.', 'Ce paiement ne peut plus être modifié.', 'La preuve doit faire au maximum 8 Mo.', 'Format accepté : JPG, PNG ou WebP.', 'Le contenu du fichier ne correspond pas à une image valide.', 'Une preuve a déjà été envoyée et est en cours de vérification.', 'PAYMENT_STATE_CONFLICT']
    return { error: safe.includes(message) ? (message === 'PAYMENT_STATE_CONFLICT' ? 'Cette preuve a déjà été envoyée ou le paiement a changé d’état.' : message) : 'Impossible d’envoyer la preuve. Veuillez réessayer.' }
  }
}
