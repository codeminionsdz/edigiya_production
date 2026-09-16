import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI can provide environment variables directly. */
}

type Combo = { key: string; label: string; price: number };
type ProductSeed = {
  slug: string;
  title: string;
  titleAr: string;
  short: string;
  details: string;
  department: "streaming" | "ai-tools" | "anime";
  image: string;
  prices: Combo[];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !serviceKey)
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
const db = createClient(supabaseUrl, serviceKey);

const images = {
  netflix: "https://cdn.simpleicons.org/netflix/E50914",
  prime:
    "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/primevideo.svg",
  shahid: "https://www.shahid.net/favicon.ico",
  disney: "https://www.disneyplus.com/favicon.ico",
  openai: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/openai.svg",
  crunchyroll: "https://cdn.simpleicons.org/crunchyroll/F47521",
  streaming:
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
  ai: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80",
  anime:
    "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80",
};

const money = (entries: Array<[string, number]>): Combo[] =>
  entries.map(([label, price]) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    price,
  }));
const netflix = (method: string, values: number[]): Combo[] =>
  money(
    ["1 mois", "2 mois", "3 mois", "6 mois", "1 an"].map(
      (duration, i) =>
        [`${method} · ${duration}`, values[i]] as [string, number],
    ),
  );

const products: ProductSeed[] = [
  {
    slug: "netflix-premium",
    title: "Netflix Premium",
    titleAr: "Netflix Premium",
    department: "streaming",
    image: images.netflix,
    short:
      "Compte officiel Netflix Premium en qualité 4K, compatible téléphone, TV, ordinateur et console.",
    details:
      "Compte officiel Netflix Premium. Profitez de la qualité 4K sur téléphone, TV, ordinateur et console. Choisissez le nombre d’écrans, la durée et le mode de paiement pour afficher le prix exact. Catalogue de démonstration : aucun stock de comptes n’est chargé.",
    prices: [1, 2, 3, 4, 5]
      .flatMap((screens) => [
        netflix(
          `BaridiMob · ${screens} écran${screens > 1 ? "s" : ""}`,
          [600, 1100, 1600, 3600, 7200].map((v) => v * screens),
        ),
        netflix(
          `Flexy · ${screens} écran${screens > 1 ? "s" : ""}`,
          screens === 1
            ? [710, 1420, 1860, 4200, 8300]
            : screens === 2
              ? [1420, 2840, 3720, 8400, 16600]
              : screens === 3
                ? [2130, 4260, 5580, 12600, 24900]
                : screens === 4
                  ? [2840, 5680, 7440, 16800, 33200]
                  : [3550, 7100, 9300, 21000, 41500],
        ),
      ])
      .flat(),
  },
  {
    slug: "prime-video",
    title: "Prime Video",
    titleAr: "Prime Video",
    department: "streaming",
    image: images.prime,
    short:
      "Compte officiel Prime Video en qualité 4K pour TV, ordinateur, téléphone et console.",
    details:
      "Compte officiel Prime Video en qualité 4K, compatible TV, ordinateur, téléphone et console. Catalogue de démonstration : aucun stock de comptes n’est chargé.",
    prices: [
      ...money([
        ["BaridiMob · 1 mois", 500],
        ["BaridiMob · 6 mois", 1000],
        ["BaridiMob · 1 an", 1600],
      ]),
      ...money([
        ["Flexy · 1 mois", 600],
        ["Flexy · 6 mois", 1150],
        ["Flexy · 1 an", 1860],
      ]),
    ],
  },
  {
    slug: "shahid",
    title: "Shahid",
    titleAr: "Shahid",
    department: "streaming",
    image: images.shahid,
    short: "اشتراك شاهد بإيميلك الشخصي",
    details:
      "اشتراك شاهد بإيميلك الشخصي. اختر الباقة المناسبة: هاتف + تلفاز أو هاتف فقط. مدة الاشتراك المتاحة: 3 أشهر.",
    prices: money([
      ["Téléphone + TV · 3 mois · BaridiMob", 2500],
      ["Téléphone + TV · 3 mois · Flexy", 3000],
      ["Téléphone uniquement · 3 mois · BaridiMob", 1900],
      ["Téléphone uniquement · 3 mois · Flexy", 2280],
    ]),
  },
  {
    slug: "disney-plus",
    title: "Disney+",
    titleAr: "Disney+",
    department: "streaming",
    image: images.disney,
    short: "Abonnement mensuel Disney+.",
    details:
      "Abonnement mensuel Disney+. Le prix exact est affiché selon le mode de paiement choisi. Catalogue de démonstration : aucun stock de comptes n’est chargé.",
    prices: money([
      ["1 mois · BaridiMob", 700],
      ["1 mois · Flexy", 900],
    ]),
  },
  {
    slug: "chatgpt-plus-shared",
    title: "ChatGPT Plus — Partagé",
    titleAr: "ChatGPT Plus — اشتراك مشترك",
    department: "ai-tools",
    image: images.openai,
    short: "Abonnement partagé ChatGPT Plus pour 1 mois.",
    details:
      "Offre partagée ChatGPT Plus, valable 1 mois. Elle est distincte de l’offre compte personnel avec votre propre adresse e-mail. Catalogue de démonstration : aucun accès n’est chargé.",
    prices: money([
      ["1 mois · BaridiMob", 1000],
      ["1 mois · Flexy", 1150],
    ]),
  },
  {
    slug: "chatgpt-plus-personal",
    title: "ChatGPT Plus — E-mail personnel",
    titleAr: "ChatGPT Plus — بريدك الشخصي",
    department: "ai-tools",
    image: images.openai,
    short:
      "Compte personnel ChatGPT Plus créé avec l’adresse e-mail du client, pour 1 mois.",
    details:
      "Offre personnelle ChatGPT Plus utilisant l’adresse e-mail du client, valable 1 mois. Cette offre est distincte de l’abonnement partagé. Catalogue de démonstration : aucun accès n’est chargé.",
    prices: money([
      ["1 mois · BaridiMob", 6000],
      ["1 mois · Flexy", 6900],
    ]),
  },
  {
    slug: "crunchyroll-premium",
    title: "Crunchyroll Premium",
    titleAr: "Crunchyroll Premium",
    department: "anime",
    image: images.crunchyroll,
    short:
      "Streaming anime haute qualité, sans publicité, activation rapide et support continu.",
    details:
      "Compte Crunchyroll Premium garanti avec haute qualité, sans publicité, activation rapide et support continu. Catalogue de démonstration : aucun stock de comptes n’est chargé.",
    prices: money([
      ["1 mois · BaridiMob", 500],
      ["6 mois · BaridiMob", 2500],
      ["1 an · BaridiMob", 4500],
      ["1 mois · Flexy", 600],
      ["6 mois · Flexy", 2900],
      ["1 an · Flexy", 5200],
    ]),
  },
];

const departments = [
  {
    slug: "streaming",
    name_fr: "Streaming",
    name_ar: "البث الرقمي",
    icon: "play",
    sort_order: 1,
    image_url: images.streaming,
  },
  {
    slug: "ai-tools",
    name_fr: "AI & Tools",
    name_ar: "الذكاء الاصطناعي والأدوات",
    icon: "sparkles",
    sort_order: 2,
    image_url: images.ai,
  },
  {
    slug: "anime",
    name_fr: "Anime",
    name_ar: "أنمي",
    icon: "tv",
    sort_order: 3,
    image_url: images.anime,
  },
];

async function upsertCatalog() {
  const { data: deptRows, error: deptError } = await db
    .from("departments")
    .upsert(departments, { onConflict: "slug" })
    .select("id, slug");
  if (deptError) throw deptError;
  const deptBySlug = new Map((deptRows || []).map((row) => [row.slug, row.id]));

  const categoryRows = departments.map((department) => ({
    department_id: deptBySlug.get(department.slug),
    parent_id: null,
    slug: department.slug,
    name_fr: department.name_fr,
    name_ar: department.name_ar,
    sort_order: 1,
    is_active: true,
  }));
  const { data: categories, error: categoryError } = await db
    .from("categories")
    .upsert(categoryRows, { onConflict: "department_id,parent_id,slug" })
    .select("id, slug, department_id");
  if (categoryError) throw categoryError;
  const categoryByDept = new Map(
    (categories || []).map((row) => [row.department_id, row.id]),
  );

  for (const item of products) {
    const departmentId = deptBySlug.get(item.department);
    const categoryId = categoryByDept.get(departmentId);
    if (!departmentId || !categoryId)
      throw new Error(`Taxonomy missing for ${item.slug}`);
    const basePrice = Math.min(...item.prices.map((entry) => entry.price));
    const { data: product, error: productError } = await db
      .from("products")
      .upsert(
        {
          slug: item.slug,
          title_fr: item.title,
          title_ar: item.titleAr,
          description_fr: `${item.short}\n\n${item.details}`,
          description_ar: item.details,
          department_id: departmentId,
          category_id: categoryId,
          price_dzd: basePrice,
          sku: `DEMO-${item.slug.toUpperCase()}`,
          stock: 0,
          inventory_type: "finite",
          fulfillment_type: "manual",
          is_featured: true,
          is_active: true,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (productError) throw productError;
    await db.from("product_images").delete().eq("product_id", product.id);
    const { error: imageError } = await db.from("product_images").insert({
      product_id: product.id,
      url: item.image,
      alt_fr: item.title,
      alt_ar: item.titleAr,
      sort_order: 0,
    });
    if (imageError) throw imageError;
    await db.from("product_variants").delete().eq("product_id", product.id);
    const variantRows = groupCommercialVariants(item.prices).map((variant) => ({
      product_id: product.id,
      external_key: variant.key,
      option_values: variant.optionValues,
      name: "Formule",
      value: variant.label,
      price_dzd: variant.baridimob,
      price_baridimob_dzd: variant.baridimob,
      price_flexy_dzd: variant.flexy,
      price_delta_dzd: variant.baridimob - basePrice,
      stock: 0,
      is_active: true,
    }));
    const { error: variantError } = await db
      .from("product_variants")
      .insert(variantRows);
    if (variantError) throw variantError;
  }
  console.log(
    JSON.stringify(
      {
        categories: departments.length,
        products: products.length,
        pricingCombinations: products.reduce(
          (sum, product) => sum + product.prices.length,
          0,
        ),
        idempotent: true,
      },
      null,
      2,
    ),
  );
}

function parseOptionValues(label: string) {
  const parts = label.split(" · ");
  const values: Record<string, string> = {};
  const payment = parts.find(
    (part) => part === "BaridiMob" || part === "Flexy",
  );
  const duration = parts.find((part) => /^\d+ mois$|^1 an$/.test(part));
  const screens = parts.find((part) => /^\d+ écran/.test(part));
  const packageValue = parts.find((part) => part.includes("Téléphone"));
  if (payment) values.payment = payment;
  if (duration) values.duration = duration;
  if (screens) values.screens = screens;
  if (packageValue) values.package = packageValue;
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator > 0)
      values[part.slice(0, separator)] = part.slice(separator + 1);
  }
  if (Object.keys(values).length) return values;
  return { formule: label };
}

function groupCommercialVariants(prices: Combo[]) {
  const grouped = new Map<
    string,
    {
      key: string;
      label: string;
      optionValues: Record<string, string>;
      baridimob: number;
      flexy: number;
    }
  >();
  for (const entry of prices) {
    const options = parseOptionValues(entry.label);
    const payment = options.payment;
    delete options.payment;
    const key = JSON.stringify(options);
    const current = grouped.get(key) || {
      key: entry.key.replace(/^(baridimob|flexy)-/i, ""),
      label: entry.label.replace(/^(BaridiMob|Flexy) Â· /, ""),
      optionValues: options,
      baridimob: 0,
      flexy: 0,
    };
    if (payment === "BaridiMob") current.baridimob = entry.price;
    if (payment === "Flexy") current.flexy = entry.price;
    grouped.set(key, current);
  }
  return [...grouped.values()].filter(
    (variant) => variant.baridimob > 0 && variant.flexy > 0,
  );
}

upsertCatalog().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
