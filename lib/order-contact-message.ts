export type OrderContactMessageInput = {
  orderNumber?: string | null
  items?: Array<{ title?: string | null; variant?: string | null; qty?: number | null; unitPrice?: number | null; lineTotal?: number | null }>
  total?: number | null
  method?: string | null
  status?: string | null
  customer?: { name?: string | null; phone?: string | null; email?: string | null }
}

const paymentLabels: Record<string, string> = {
  flexy: "Flexy",
  ccp: "CCP",
  bank_transfer: "Virement bancaire",
}

const statusLabels: Record<string, string> = {
  pending: "Paiement en attente",
  verification_required: "Vérification requise",
  paid: "Paiement vérifié",
  failed: "Paiement échoué",
  rejected: "Paiement rejeté",
  cancelled: "Paiement annulé",
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function price(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `${new Intl.NumberFormat("fr-DZ").format(amount)} DA` : ""
}

export function buildOrderContactMessage(order: OrderContactMessageInput) {
  const currentStatus = clean(order.status)
  const lines = ["Bonjour Edigiya 👋", "", currentStatus === "pending" ? "Je souhaite finaliser le paiement de ma commande." : "Je viens de terminer le paiement de ma commande.", ""]
  const orderNumber = clean(order.orderNumber)
  if (orderNumber) lines.push("📦 COMMANDE", `Référence : ${orderNumber}`, "")

  const items = (order.items || []).filter((item) => clean(item.title) && Number(item.qty) > 0)
  if (items.length) {
    lines.push("🛍️ PRODUITS")
    for (const item of items) {
      const title = clean(item.title)
      const quantity = Number(item.qty)
      const unitPrice = price(item.unitPrice)
      lines.push(`• ${title} × ${quantity}${unitPrice ? `\n  ${unitPrice}` : ""}`)
    }
    lines.push("")
  }

  const total = price(order.total)
  const method = paymentLabels[clean(order.method)] || clean(order.method)
  const status = statusLabels[currentStatus] || currentStatus
  if (total || method || status) {
    lines.push("💰 PAIEMENT")
    if (total) lines.push(`Montant : ${total}`)
    if (method) lines.push(`Méthode : ${method}`)
    if (status) lines.push(`Statut : ${status}`)
    lines.push("")
  }

  const customer = order.customer || {}
  const name = clean(customer.name)
  const phone = clean(customer.phone)
  const email = clean(customer.email)
  if (name || phone || email) {
    lines.push("👤 CLIENT")
    if (name) lines.push(`Nom : ${name}`)
    if (phone) lines.push(`Téléphone : ${phone}`)
    if (email) lines.push(`Email : ${email}`)
    lines.push("")
  }

  switch (currentStatus) {
    case "verification_required":
      lines.push("J’ai effectué le paiement et envoyé mon justificatif via Edigiya.", "", "Merci de vérifier mon paiement et de traiter ma commande.")
      break
    case "paid":
      lines.push("Mon paiement a été effectué et vérifié. Je souhaite suivre ma commande.")
      break
    case "failed":
    case "rejected":
      lines.push("J’ai besoin d’aide concernant le paiement de ma commande.")
      break
    case "cancelled":
      lines.push("Je souhaite obtenir de l’aide concernant ma commande annulée.")
      break
    default:
      lines.push("Je souhaite finaliser ma commande et obtenir de l’aide concernant le paiement.", "", "Merci de m’aider à finaliser ma commande.")
  }

  return lines.join("\n").trim()
}
