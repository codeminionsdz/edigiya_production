import 'server-only'

const API_URL = 'https://prodapi.slick-pay.com/api/v2/users/invoices'

function key() {
  const value = process.env.SLICKPAY_API_KEY?.trim()
  if (!value) throw new Error('SLICKPAY_NOT_CONFIGURED')
  return value
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${key()}`, ...(init?.headers || {}) }, cache: 'no-store' })
  const body = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || body?.success === 0) throw new Error('SLICKPAY_PROVIDER_ERROR')
  return body || {}
}

export async function createSlickPayInvoice(input: { amount: number; returnUrl: string; firstName: string; lastName: string; phone: string; email: string }) {
  const body = await request('', { method: 'POST', body: JSON.stringify({ amount: input.amount, url: input.returnUrl, firstname: input.firstName, lastname: input.lastName, phone: input.phone, email: input.email, address: 'Digital delivery' }) })
  const id = body.id
  const url = body.url
  if ((typeof id !== 'number' && typeof id !== 'string') || typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url)) throw new Error('SLICKPAY_INVALID_RESPONSE')
  return { id: String(id), url }
}

export async function getSlickPayInvoice(id: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('SLICKPAY_INVALID_INVOICE')
  const body = await request(`/${encodeURIComponent(id)}`, { method: 'GET' })
  const completed = body.completed === 1 || body.completed === true
  const data = body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : null
  return { completed, status: typeof body.payment_status === 'string' ? body.payment_status.slice(0, 100) : completed ? 'completed' : 'pending', amount: typeof body.amount === 'number' ? body.amount : data && typeof data.amount === 'number' ? data.amount : null }
}
