export const PAYMENT_STATUSES = ['pending', 'verification_required', 'paid', 'failed', 'rejected', 'cancelled'] as const
export type PaymentStatus = typeof PAYMENT_STATUSES[number]
export type PaymentMethod = 'slickpay' | 'flexy' | 'ccp' | 'bank_transfer' | 'cod' | 'cib' | 'edahabia' | 'bank'
export type ManualPaymentMethod = 'flexy' | 'ccp' | 'bank_transfer'

export function isManualPaymentMethod(value: string): value is ManualPaymentMethod {
  return value === 'flexy' || value === 'ccp' || value === 'bank_transfer'
}
