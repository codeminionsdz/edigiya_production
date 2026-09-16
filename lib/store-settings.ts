export type StoreSettings = {
  storeName: string;
  description: string;
  contactEmail: string;
  phonePrimary: string;
  phoneSecondary: string;
  whatsapp: string;
  address: string;
  mapLink: string;
  mapEmbed: string;
  workingHours: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  flexyNumber: string;
  flexyInstructions: string;
  ccpInstructions: string;
  bankInstructions: string;
  telegramLink: string;
};

export const STORE_SETTINGS_STORAGE_KEY = "admin_store_settings_v1";
export const TELEGRAM_CONTACT_URL = "https://t.me/edigiyadz";

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "Edigiya Store DZ",
  description: "Boutique de produits et services numériques.",
  contactEmail: "nutrition.store.dz@gmail.com",
  phonePrimary: "050545968",
  phoneSecondary: "0661800937",
  whatsapp: "+213 541 38 30 93",
  address: "Boulevard 1er Novembre 1954, Souk Ahras, Algerie",
  mapLink: "https://maps.app.goo.gl/X8eT8GuphJ3fntRY9?g_st=ic",
  mapEmbed:
    '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3216.1353515984856!2d7.9463084!3d36.2847656!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12fa7cc668f1588b%3A0x756fd7b122277fe8!2sAv.%20du%201er%20novembre%201954%2C%20Souk-Ahras!5e0!3m2!1sfr!2sdz!4v1770994575470!5m2!1sfr!2sdz" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>',
  workingHours: "08:00 - 19:00 (Tous les jours)",
  facebook: "",
  instagram: "",
  tiktok: "",
  flexyNumber: "",
  flexyInstructions: "",
  ccpInstructions: "",
  bankInstructions: "",
  telegramLink: TELEGRAM_CONTACT_URL,
};

export async function fetchStoreSettings(): Promise<StoreSettings> {
  try {
    const response = await fetch("/api/store-settings", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load store settings");
    }

    const data = await response.json();
    if (!data || typeof data !== "object") {
      throw new Error("Invalid settings response");
    }

    const settings = {
      ...DEFAULT_STORE_SETTINGS,
      ...data,
      storeName: String(
        data.store_name || data.storeName || DEFAULT_STORE_SETTINGS.storeName,
      ),
      description: String(
        data.description || DEFAULT_STORE_SETTINGS.description,
      ),
      contactEmail: String(
        data.contact_email ||
          data.contactEmail ||
          DEFAULT_STORE_SETTINGS.contactEmail,
      ),
      phonePrimary: String(
        data.phone_primary ||
          data.phonePrimary ||
          DEFAULT_STORE_SETTINGS.phonePrimary,
      ),
      phoneSecondary: String(
        data.phone_secondary ||
          data.phoneSecondary ||
          DEFAULT_STORE_SETTINGS.phoneSecondary,
      ),
      whatsapp: String(data.whatsapp || DEFAULT_STORE_SETTINGS.whatsapp),
      address: String(data.address || DEFAULT_STORE_SETTINGS.address),
      mapLink: String(
        data.map_link || data.mapLink || DEFAULT_STORE_SETTINGS.mapLink,
      ),
      mapEmbed: String(
        data.map_embed || data.mapEmbed || DEFAULT_STORE_SETTINGS.mapEmbed,
      ),
      workingHours: String(
        data.working_hours ||
          data.workingHours ||
          DEFAULT_STORE_SETTINGS.workingHours,
      ),
      facebook: String(data.facebook || DEFAULT_STORE_SETTINGS.facebook),
      instagram: String(data.instagram || DEFAULT_STORE_SETTINGS.instagram),
      tiktok: String(data.tiktok || DEFAULT_STORE_SETTINGS.tiktok),
      flexyNumber: String(data.flexy_number || data.flexyNumber || ""),
      flexyInstructions: String(
        data.flexy_instructions || data.flexyInstructions || "",
      ),
      ccpInstructions: String(
        data.ccp_instructions || data.ccpInstructions || "",
      ),
      bankInstructions: String(
        data.bank_instructions || data.bankInstructions || "",
      ),
      telegramLink: String(
        data.telegram_link || data.telegramLink || TELEGRAM_CONTACT_URL,
      ),
    };

    saveStoreSettings(settings);
    return settings;
  } catch {
    return loadStoreSettings();
  }
}

export async function saveStoreSettingsToServer(settings: StoreSettings) {
  const response = await fetch("/api/store-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to save store settings");
  }

  const data = await response.json();
  const serverSettings = {
    ...DEFAULT_STORE_SETTINGS,
    ...data,
    storeName: String(
      data.store_name || data.storeName || DEFAULT_STORE_SETTINGS.storeName,
    ),
    description: String(data.description || DEFAULT_STORE_SETTINGS.description),
    contactEmail: String(
      data.contact_email ||
        data.contactEmail ||
        DEFAULT_STORE_SETTINGS.contactEmail,
    ),
    phonePrimary: String(
      data.phone_primary ||
        data.phonePrimary ||
        DEFAULT_STORE_SETTINGS.phonePrimary,
    ),
    phoneSecondary: String(
      data.phone_secondary ||
        data.phoneSecondary ||
        DEFAULT_STORE_SETTINGS.phoneSecondary,
    ),
    whatsapp: String(data.whatsapp || DEFAULT_STORE_SETTINGS.whatsapp),
    address: String(data.address || DEFAULT_STORE_SETTINGS.address),
    mapLink: String(
      data.map_link || data.mapLink || DEFAULT_STORE_SETTINGS.mapLink,
    ),
    mapEmbed: String(
      data.map_embed || data.mapEmbed || DEFAULT_STORE_SETTINGS.mapEmbed,
    ),
    workingHours: String(
      data.working_hours ||
        data.workingHours ||
        DEFAULT_STORE_SETTINGS.workingHours,
    ),
    facebook: String(data.facebook || DEFAULT_STORE_SETTINGS.facebook),
    instagram: String(data.instagram || DEFAULT_STORE_SETTINGS.instagram),
    tiktok: String(data.tiktok || DEFAULT_STORE_SETTINGS.tiktok),
    flexyNumber: String(data.flexy_number || data.flexyNumber || ""),
    flexyInstructions: String(
      data.flexy_instructions || data.flexyInstructions || "",
    ),
    ccpInstructions: String(
      data.ccp_instructions || data.ccpInstructions || "",
    ),
    bankInstructions: String(
      data.bank_instructions || data.bankInstructions || "",
    ),
    telegramLink: String(
      data.telegram_link || data.telegramLink || TELEGRAM_CONTACT_URL,
    ),
  };

  saveStoreSettings(serverSettings);
  return serverSettings;
}

export function loadStoreSettings(): StoreSettings {
  if (typeof window === "undefined") return DEFAULT_STORE_SETTINGS;

  try {
    const raw = localStorage.getItem(STORE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_STORE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StoreSettings>;
    return { ...DEFAULT_STORE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

export function saveStoreSettings(settings: StoreSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function phoneForWhatsApp(phone: string) {
  const digits = onlyDigits(phone);
  if (!digits) return "";
  if (digits.startsWith("213")) return digits;
  if (digits.startsWith("0")) return `213${digits.slice(1)}`;
  return digits;
}

export function toWhatsAppUrl(phone: string) {
  const normalized = phoneForWhatsApp(phone);
  return normalized ? `https://wa.me/${normalized}` : "#";
}

export function toTelUrl(phone: string) {
  const cleaned = phone.replace(/\s+/g, "");
  if (!cleaned) return "#";
  if (cleaned.startsWith("+")) return `tel:${cleaned}`;
  return `tel:${cleaned}`;
}
