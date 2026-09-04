export interface Product {
  id: string
  slug: string
  name: { fr: string; ar: string }
  description: { fr: string; ar: string }
  price: number
  compareAtPrice?: number
  images: string[]
  category: string
  subcategory?: string
  department: string
  brand: string
  rating: number
  reviewCount: number
  inStock: boolean
  stockCount: number
  specs: Record<string, string>
  tags: string[]
  variants?: ProductVariant[]
  specsAr?: Record<string, string>
  isNew?: boolean
  isBestSeller?: boolean
  isDeal?: boolean
}

export interface ProductVariant {
  id: string
  name: string
  value: string
  priceDelta: number
  stock: number | null
}

export interface Subcategory {
  id: string
  slug: string
  name: { fr: string; ar: string }
  featured?: boolean
  visible: boolean
}

export interface Category {
  id: string
  slug: string
  name: { fr: string; ar: string }
  description?: { fr: string; ar: string }
  subcategories: Subcategory[]
  featured?: boolean
  visible: boolean
}

export interface Department {
  id: string
  slug: string
  name: { fr: string; ar: string }
  icon: string
  categories: Category[]
  order: number
  visible: boolean
}

export interface Collection {
  id: string
  slug: string
  name: { fr: string; ar: string }
  description: { fr: string; ar: string }
  productCount: number
  color: string
}

// ========================
// TAXONOMY (moved to Supabase)
// ========================
export const departments: Department[] = []

// ========================
// COLLECTIONS
// ========================
export const collections: Collection[] = [
  {
    id: "c1", slug: "gaming-setup",
    name: { fr: "Pack Gaming Setup", ar: "حزمة اعداد الالعاب" },
    description: { fr: "Tout pour votre setup gaming ultime", ar: "كل ما تحتاجه لاعداد العاب مثالي" },
    productCount: 24, color: "from-purple-600 to-indigo-600",
  },
  {
    id: "c2", slug: "office-starter",
    name: { fr: "Pack Bureau Starter", ar: "حزمة المكتب الاساسية" },
    description: { fr: "L'essentiel pour votre espace de travail", ar: "الاساسيات لمساحة عملك" },
    productCount: 18, color: "from-blue-600 to-cyan-600",
  },
  {
    id: "c3", slug: "surveillance-kit",
    name: { fr: "Kit Surveillance", ar: "حزمة المراقبة" },
    description: { fr: "Securisez votre maison ou commerce", ar: "قم بتامين منزلك او تجارتك" },
    productCount: 12, color: "from-emerald-600 to-teal-600",
  },
  {
    id: "c4", slug: "wifi-upgrade",
    name: { fr: "Wi-Fi Upgrade", ar: "ترقية الواي فاي" },
    description: { fr: "Boostez votre connexion internet", ar: "عزز اتصالك بالانترنت" },
    productCount: 8, color: "from-orange-500 to-amber-500",
  },
  {
    id: "c5", slug: "apple-ecosystem",
    name: { fr: "Ecosysteme Apple", ar: "منظومة ابل" },
    description: { fr: "iPhone, MacBook, iPad et plus", ar: "ايفون، ماك بوك، ايباد والمزيد" },
    productCount: 15, color: "from-slate-600 to-zinc-700",
  },
]

// ========================
// PRODUCTS (updated department slugs)
// ========================
export const products: Product[] = [
  {
    id: "p1", slug: "asus-rog-strix-g16",
    name: { fr: "ASUS ROG Strix G16", ar: "اسوس روج ستريكس G16" },
    description: { fr: "Laptop gaming haute performance avec ecran 165Hz", ar: "حاسوب محمول للالعاب عالي الاداء مع شاشة 165Hz" },
    price: 289000, compareAtPrice: 329000,
    images: ["/placeholder.svg"],
    category: "gaming-laptops", department: "laptops", brand: "ASUS",
    rating: 4.8, reviewCount: 42, inStock: true, stockCount: 15,
    specs: { "CPU": "Intel Core i7-13650HX", "GPU": "NVIDIA RTX 4060", "RAM": "16 Go DDR5", "Stockage": "512 Go NVMe SSD", "Ecran": "16\" FHD+ 165Hz" },
    tags: ["gaming", "laptop", "rtx"], isBestSeller: true, isDeal: true,
  },
  {
    id: "p2", slug: "msi-katana-15",
    name: { fr: "MSI Katana 15", ar: "MSI كاتانا 15" },
    description: { fr: "PC portable gaming avec RTX 4050 et ecran 144Hz", ar: "حاسوب محمول للالعاب مع RTX 4050 وشاشة 144Hz" },
    price: 215000,
    images: ["/placeholder.svg"],
    category: "gaming-laptops", department: "laptops", brand: "MSI",
    rating: 4.5, reviewCount: 28, inStock: true, stockCount: 8,
    specs: { "CPU": "Intel Core i7-13620H", "GPU": "NVIDIA RTX 4050", "RAM": "16 Go DDR5", "Stockage": "512 Go SSD", "Ecran": "15.6\" FHD 144Hz" },
    tags: ["gaming", "laptop", "rtx"], isNew: true,
  },
  {
    id: "p3", slug: "rtx-4070-super",
    name: { fr: "NVIDIA RTX 4070 SUPER", ar: "انفيديا RTX 4070 سوبر" },
    description: { fr: "Carte graphique haut de gamme pour gaming 1440p", ar: "بطاقة رسومية عالية الاداء للالعاب 1440p" },
    price: 142000, compareAtPrice: 155000,
    images: ["/placeholder.svg"],
    category: "graphics-cards", department: "composants", brand: "NVIDIA",
    rating: 4.9, reviewCount: 67, inStock: true, stockCount: 5,
    specs: { "VRAM": "12 Go GDDR6X", "Boost Clock": "2475 MHz", "CUDA Cores": "7168", "TDP": "220W" },
    tags: ["gpu", "gaming", "nvidia"], isBestSeller: true,
  },
  {
    id: "p4", slug: "corsair-vengeance-ddr5",
    name: { fr: "Corsair Vengeance DDR5 32Go", ar: "كورسير فانجانس DDR5 32GB" },
    description: { fr: "Kit memoire DDR5 haute performance", ar: "حزمة ذاكرة DDR5 عالية الاداء" },
    price: 28500,
    images: ["/placeholder.svg"],
    category: "ram", subcategory: "ddr5", department: "composants", brand: "Corsair",
    rating: 4.7, reviewCount: 35, inStock: true, stockCount: 22,
    specs: { "Capacite": "32 Go (2x16Go)", "Vitesse": "5600 MHz", "Latence": "CL36", "Voltage": "1.25V" },
    tags: ["ram", "ddr5", "corsair"], isNew: true,
  },
  {
    id: "p5", slug: "samsung-990-pro-2tb",
    name: { fr: "Samsung 990 PRO 2To", ar: "سامسونج 990 برو 2TB" },
    description: { fr: "SSD NVMe PCIe 4.0 ultra rapide", ar: "قرص SSD NVMe PCIe 4.0 فائق السرعة" },
    price: 45000, compareAtPrice: 52000,
    images: ["/placeholder.svg"],
    category: "comp-storage", subcategory: "nvme", department: "composants", brand: "Samsung",
    rating: 4.9, reviewCount: 89, inStock: true, stockCount: 18,
    specs: { "Capacite": "2 To", "Interface": "PCIe 4.0 NVMe", "Lecture": "7450 Mo/s", "Ecriture": "6900 Mo/s" },
    tags: ["ssd", "storage", "samsung"], isBestSeller: true, isDeal: true,
  },
  {
    id: "p6", slug: "lg-ultragear-27gp850",
    name: { fr: "LG UltraGear 27GP850-B", ar: "LG الترا جير 27GP850-B" },
    description: { fr: "Moniteur gaming 27\" QHD 165Hz IPS", ar: "شاشة العاب 27 انش QHD 165Hz IPS" },
    price: 89000,
    images: ["/placeholder.svg"],
    category: "gaming-monitors", department: "moniteurs", brand: "LG",
    rating: 4.6, reviewCount: 51, inStock: true, stockCount: 10,
    specs: { "Taille": "27\"", "Resolution": "2560x1440", "Refresh Rate": "165Hz", "Panel": "Nano IPS", "Response Time": "1ms" },
    tags: ["monitor", "gaming", "qhd"], isNew: true,
  },
  {
    id: "p7", slug: "tp-link-archer-ax73",
    name: { fr: "TP-Link Archer AX73", ar: "تي بي لينك ارتشر AX73" },
    description: { fr: "Routeur Wi-Fi 6 AX5400 double bande", ar: "راوتر واي فاي 6 AX5400 ثنائي النطاق" },
    price: 18500,
    images: ["/placeholder.svg"],
    category: "routers", subcategory: "wifi6-routers", department: "reseau", brand: "TP-Link",
    rating: 4.4, reviewCount: 23, inStock: true, stockCount: 30,
    specs: { "Standard": "Wi-Fi 6", "Vitesse": "AX5400", "Bandes": "Double bande", "Ports": "4x Gigabit LAN" },
    tags: ["router", "wifi", "networking"],
  },
  {
    id: "p8", slug: "logitech-g502-x-plus",
    name: { fr: "Logitech G502 X PLUS", ar: "لوجيتيك G502 X بلس" },
    description: { fr: "Souris gaming sans fil LIGHTSPEED", ar: "فارة العاب لاسلكية LIGHTSPEED" },
    price: 32000, compareAtPrice: 36000,
    images: ["/placeholder.svg"],
    category: "mice", subcategory: "gaming-mice", department: "peripheriques", brand: "Logitech",
    rating: 4.7, reviewCount: 44, inStock: true, stockCount: 12,
    specs: { "Capteur": "HERO 25K", "DPI": "25600", "Boutons": "13", "Autonomie": "130 heures" },
    tags: ["mouse", "gaming", "wireless"], isDeal: true,
  },
  {
    id: "p9", slug: "intel-core-i9-14900k",
    name: { fr: "Intel Core i9-14900K", ar: "انتل كور i9-14900K" },
    description: { fr: "Processeur desktop haut de gamme, 24 coeurs", ar: "معالج سطح مكتب عالي الاداء، 24 نواة" },
    price: 128000,
    images: ["/placeholder.svg"],
    category: "processors", subcategory: "intel-processors", department: "composants", brand: "Intel",
    rating: 4.8, reviewCount: 38, inStock: true, stockCount: 6,
    specs: { "Coeurs": "24 (8P+16E)", "Threads": "32", "Base Clock": "3.2 GHz", "Boost Clock": "6.0 GHz", "TDP": "125W" },
    tags: ["cpu", "intel", "processor"], isBestSeller: true,
  },
  {
    id: "p10", slug: "hikvision-ds-2cd2143",
    name: { fr: "Hikvision DS-2CD2143G2-I", ar: "هيكفيجن DS-2CD2143G2-I" },
    description: { fr: "Camera IP dome 4MP avec vision nocturne", ar: "كاميرا IP قبة 4 ميغابكسل مع رؤية ليلية" },
    price: 12500,
    images: ["/placeholder.svg"],
    category: "ip-cameras", subcategory: "dome-cameras", department: "cameras", brand: "Hikvision",
    rating: 4.5, reviewCount: 19, inStock: true, stockCount: 45,
    specs: { "Resolution": "4MP", "Vision nocturne": "30m", "Etancheite": "IP67", "Compression": "H.265+" },
    tags: ["camera", "surveillance", "ip"],
  },
  {
    id: "p11", slug: "amd-ryzen-9-7950x",
    name: { fr: "AMD Ryzen 9 7950X", ar: "AMD رايزن 9 7950X" },
    description: { fr: "Processeur 16 coeurs pour les professionnels", ar: "معالج 16 نواة للمحترفين" },
    price: 132000, compareAtPrice: 145000,
    images: ["/placeholder.svg"],
    category: "processors", subcategory: "amd-processors", department: "composants", brand: "AMD",
    rating: 4.9, reviewCount: 55, inStock: true, stockCount: 4,
    specs: { "Coeurs": "16", "Threads": "32", "Base Clock": "4.5 GHz", "Boost Clock": "5.7 GHz", "TDP": "170W" },
    tags: ["cpu", "amd", "processor"], isNew: true, isBestSeller: true,
  },
  {
    id: "p12", slug: "canon-pixma-g3420",
    name: { fr: "Canon PIXMA G3420", ar: "كانون بيكسما G3420" },
    description: { fr: "Imprimante multifonction a reservoir d'encre", ar: "طابعة متعددة الوظائف بخزان حبر" },
    price: 35000,
    images: ["/placeholder.svg"],
    category: "inkjet-printers", department: "imprimantes", brand: "Canon",
    rating: 4.3, reviewCount: 31, inStock: true, stockCount: 20,
    specs: { "Type": "Jet d'encre", "Fonctions": "Impression, copie, scan", "Wi-Fi": "Oui", "Reservoir": "Haute capacite" },
    tags: ["printer", "canon", "multifunction"],
  },
  {
    id: "p13", slug: "iphone-16-pro",
    name: { fr: "iPhone 16 Pro", ar: "ايفون 16 برو" },
    description: { fr: "Le dernier iPhone avec puce A18 Pro", ar: "احدث ايفون مع شريحة A18 Pro" },
    price: 295000,
    images: ["/placeholder.svg"],
    category: "iphone", subcategory: "iphone-16", department: "apple", brand: "Apple",
    rating: 4.9, reviewCount: 120, inStock: true, stockCount: 8,
    specs: { "Puce": "A18 Pro", "Ecran": "6.3\" OLED", "Camera": "48MP", "Stockage": "256 Go" },
    tags: ["iphone", "apple", "smartphone"], isNew: true, isBestSeller: true,
  },
  {
    id: "p14", slug: "macbook-air-m3",
    name: { fr: "MacBook Air M3", ar: "ماك بوك اير M3" },
    description: { fr: "Ultrabook Apple avec puce M3", ar: "حاسوب ابل خفيف مع شريحة M3" },
    price: 265000,
    images: ["/placeholder.svg"],
    category: "macbook", subcategory: "macbook-air", department: "apple", brand: "Apple",
    rating: 4.8, reviewCount: 75, inStock: true, stockCount: 12,
    specs: { "Puce": "Apple M3", "RAM": "8 Go", "SSD": "256 Go", "Ecran": "13.6\" Liquid Retina" },
    tags: ["macbook", "apple", "laptop"], isNew: true,
  },
]

export const brands = [
  "NVIDIA", "AMD", "Intel", "ASUS", "MSI", "Corsair", "Logitech", "Samsung", "Canon", "TP-Link",
  "LG", "Hikvision", "HP", "Dell", "Lenovo", "Gigabyte", "Apple", "Razer", "HyperX",
]

export const wilayas = [
  { code: "01", name: "Adrar", homeDeliveryFee: 1200, stopDeskFee: 800, minDays: 5, maxDays: 7, enabled: true },
  { code: "02", name: "Chlef", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "03", name: "Laghouat", homeDeliveryFee: 800, stopDeskFee: 500, minDays: 3, maxDays: 5, enabled: true },
  { code: "04", name: "Oum El Bouaghi", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "05", name: "Batna", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "06", name: "Bejaia", homeDeliveryFee: 500, stopDeskFee: 350, minDays: 2, maxDays: 3, enabled: true },
  { code: "07", name: "Biskra", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "08", name: "Bechar", homeDeliveryFee: 1100, stopDeskFee: 750, minDays: 5, maxDays: 7, enabled: true },
  { code: "09", name: "Blida", homeDeliveryFee: 400, stopDeskFee: 250, minDays: 1, maxDays: 2, enabled: true },
  { code: "10", name: "Bouira", homeDeliveryFee: 500, stopDeskFee: 350, minDays: 2, maxDays: 3, enabled: true },
  { code: "11", name: "Tamanrasset", homeDeliveryFee: 1500, stopDeskFee: 1000, minDays: 6, maxDays: 8, enabled: true },
  { code: "12", name: "Tebessa", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "13", name: "Tlemcen", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "14", name: "Tiaret", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "15", name: "Tizi Ouzou", homeDeliveryFee: 500, stopDeskFee: 350, minDays: 2, maxDays: 3, enabled: true },
  { code: "16", name: "Alger", homeDeliveryFee: 400, stopDeskFee: 0, minDays: 1, maxDays: 2, enabled: true },
  { code: "17", name: "Djelfa", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "18", name: "Jijel", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "19", name: "Setif", homeDeliveryFee: 500, stopDeskFee: 350, minDays: 2, maxDays: 3, enabled: true },
  { code: "20", name: "Saida", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "21", name: "Skikda", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "22", name: "Sidi Bel Abbes", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "23", name: "Annaba", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "24", name: "Guelma", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "25", name: "Constantine", homeDeliveryFee: 500, stopDeskFee: 350, minDays: 2, maxDays: 3, enabled: true },
  { code: "26", name: "Medea", homeDeliveryFee: 500, stopDeskFee: 350, minDays: 2, maxDays: 3, enabled: true },
  { code: "27", name: "Mostaganem", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "28", name: "M'Sila", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "29", name: "Mascara", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "30", name: "Ouargla", homeDeliveryFee: 900, stopDeskFee: 600, minDays: 4, maxDays: 6, enabled: true },
  { code: "31", name: "Oran", homeDeliveryFee: 500, stopDeskFee: 350, minDays: 2, maxDays: 3, enabled: true },
  { code: "32", name: "El Bayadh", homeDeliveryFee: 900, stopDeskFee: 600, minDays: 4, maxDays: 6, enabled: true },
  { code: "33", name: "Illizi", homeDeliveryFee: 1500, stopDeskFee: 1000, minDays: 6, maxDays: 8, enabled: true },
  { code: "34", name: "Bordj Bou Arreridj", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "35", name: "Boumerdes", homeDeliveryFee: 400, stopDeskFee: 250, minDays: 1, maxDays: 2, enabled: true },
  { code: "36", name: "El Tarf", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "37", name: "Tindouf", homeDeliveryFee: 1500, stopDeskFee: 1000, minDays: 6, maxDays: 8, enabled: true },
  { code: "38", name: "Tissemsilt", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "39", name: "El Oued", homeDeliveryFee: 800, stopDeskFee: 550, minDays: 3, maxDays: 5, enabled: true },
  { code: "40", name: "Khenchela", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "41", name: "Souk Ahras", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "42", name: "Tipaza", homeDeliveryFee: 400, stopDeskFee: 250, minDays: 1, maxDays: 2, enabled: true },
  { code: "43", name: "Mila", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "44", name: "Ain Defla", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "45", name: "Naama", homeDeliveryFee: 900, stopDeskFee: 600, minDays: 4, maxDays: 6, enabled: true },
  { code: "46", name: "Ain Temouchent", homeDeliveryFee: 700, stopDeskFee: 450, minDays: 3, maxDays: 5, enabled: true },
  { code: "47", name: "Ghardaia", homeDeliveryFee: 800, stopDeskFee: 550, minDays: 3, maxDays: 5, enabled: true },
  { code: "48", name: "Relizane", homeDeliveryFee: 600, stopDeskFee: 400, minDays: 2, maxDays: 4, enabled: true },
  { code: "49", name: "El M'Ghair", homeDeliveryFee: 900, stopDeskFee: 600, minDays: 4, maxDays: 6, enabled: true },
  { code: "50", name: "El Meniaa", homeDeliveryFee: 1000, stopDeskFee: 700, minDays: 4, maxDays: 6, enabled: true },
  { code: "51", name: "Ouled Djellal", homeDeliveryFee: 800, stopDeskFee: 550, minDays: 3, maxDays: 5, enabled: true },
  { code: "52", name: "Bordj Badji Mokhtar", homeDeliveryFee: 1500, stopDeskFee: 1000, minDays: 6, maxDays: 8, enabled: true },
  { code: "53", name: "Beni Abbes", homeDeliveryFee: 1200, stopDeskFee: 800, minDays: 5, maxDays: 7, enabled: true },
  { code: "54", name: "Timimoun", homeDeliveryFee: 1200, stopDeskFee: 800, minDays: 5, maxDays: 7, enabled: true },
  { code: "55", name: "Touggourt", homeDeliveryFee: 800, stopDeskFee: 550, minDays: 3, maxDays: 5, enabled: true },
  { code: "56", name: "Djanet", homeDeliveryFee: 1500, stopDeskFee: 1000, minDays: 6, maxDays: 8, enabled: true },
  { code: "57", name: "In Salah", homeDeliveryFee: 1300, stopDeskFee: 900, minDays: 5, maxDays: 7, enabled: true },
  { code: "58", name: "In Guezzam", homeDeliveryFee: 1500, stopDeskFee: 1000, minDays: 7, maxDays: 10, enabled: true },
]

export const testimonials = [
  { id: "t1", name: "Mohamed B.", city: "Alger", rating: 5, text: { fr: "Service excellent et livraison rapide ! Mon nouveau laptop est parfait.", ar: "خدمة ممتازة وتوصيل سريع! حاسوبي الجديد مثالي." } },
  { id: "t2", name: "Amina K.", city: "Oran", rating: 5, text: { fr: "Tres satisfaite de mon achat. L'equipe est tres professionnelle.", ar: "راضية جدا عن شرائي. الفريق محترف جدا." } },
  { id: "t3", name: "Yacine D.", city: "Constantine", rating: 4, text: { fr: "Bon rapport qualite-prix. Je recommande vivement.", ar: "جودة سعر ممتازة. انصح بشدة." } },
  { id: "t4", name: "Sarah M.", city: "Setif", rating: 5, text: { fr: "Le support client via WhatsApp est vraiment pratique !", ar: "دعم العملاء عبر واتساب عملي حقا!" } },
  { id: "t5", name: "Karim L.", city: "Blida", rating: 5, text: { fr: "Meilleur magasin tech en Algerie. Prix competitifs.", ar: "افضل متجر تقني في الجزائر. اسعار تنافسية." } },
]

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-DZ", { style: "decimal" }).format(price) + " DA"
}
