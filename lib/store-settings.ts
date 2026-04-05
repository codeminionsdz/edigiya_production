export type StoreSettings = {
  storeName: string
  description: string
  contactEmail: string
  phonePrimary: string
  phoneSecondary: string
  whatsapp: string
  address: string
  mapLink: string
  mapEmbed: string
  workingHours: string
  facebook: string
  instagram: string
  tiktok: string
}

export const STORE_SETTINGS_STORAGE_KEY = "admin_store_settings_v1"

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "Nutrition Store",
  description: "Boutique premium de nutrition sportive et supplements de performance.",
  contactEmail: "reffaskhalil@gmail.com",
  phonePrimary: "050545968",
  phoneSecondary: "0661800937",
  whatsapp: "050545968",
  address: "Boulevard 1er Novembre 1954, Souk Ahras, Algerie",
  mapLink: "https://maps.app.goo.gl/X8eT8GuphJ3fntRY9?g_st=ic",
  mapEmbed:
    '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3216.1353515984856!2d7.9463084!3d36.2847656!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12fa7cc668f1588b%3A0x756fd7b122277fe8!2sAv.%20du%201er%20novembre%201954%2C%20Souk-Ahras!5e0!3m2!1sfr!2sdz!4v1770994575470!5m2!1sfr!2sdz" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>',
  workingHours: "08:00 - 19:00 (Tous les jours)",
  facebook: "https://www.facebook.com/share/17EXkJSApU/?mibextid=wwXIfr",
  instagram: "https://www.instagram.com/computer.house.41?igsh=Y2d0MTBndjA1YWM4",
  tiktok: "https://www.tiktok.com/@reffaskhalil?_r=1&_t=ZS-93tDkToF1T2",
}

export function loadStoreSettings(): StoreSettings {
  if (typeof window === "undefined") return DEFAULT_STORE_SETTINGS

  try {
    const raw = localStorage.getItem(STORE_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_STORE_SETTINGS
    const parsed = JSON.parse(raw) as Partial<StoreSettings>
    return { ...DEFAULT_STORE_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_STORE_SETTINGS
  }
}

export function saveStoreSettings(settings: StoreSettings) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORE_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

export function phoneForWhatsApp(phone: string) {
  const digits = onlyDigits(phone)
  if (!digits) return ""
  if (digits.startsWith("213")) return digits
  if (digits.startsWith("0")) return `213${digits.slice(1)}`
  return digits
}

export function toWhatsAppUrl(phone: string) {
  const normalized = phoneForWhatsApp(phone)
  return normalized ? `https://wa.me/${normalized}` : "#"
}

export function toTelUrl(phone: string) {
  const cleaned = phone.replace(/\s+/g, "")
  if (!cleaned) return "#"
  if (cleaned.startsWith("+")) return `tel:${cleaned}`
  return `tel:${cleaned}`
}
