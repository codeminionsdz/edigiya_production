import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI can provide environment variables directly. */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key)
  throw new Error("Supabase environment variables are required");
const db = createClient(url, key);
const expected: Record<string, number[]> = {
  "netflix-premium": [
    600, 1100, 1600, 3600, 7200, 710, 1420, 1860, 4200, 8300, 1200, 2200, 3200,
    7200, 14400, 1420, 2840, 3720, 8400, 16600, 1800, 3300, 4800, 10800, 21600,
    2130, 4260, 5580, 12600, 24900, 2400, 4400, 6400, 14400, 28800, 2840, 5680,
    7440, 16800, 33200, 3000, 5500, 8000, 18000, 36000, 3550, 7100, 9300, 21000,
    41500,
  ],
  "prime-video": [500, 1000, 1600, 600, 1150, 1860],
  shahid: [2500, 3000, 1900, 2280],
  "disney-plus": [700, 900],
  "chatgpt-plus-shared": [1000, 1150],
  "chatgpt-plus-personal": [6000, 6900],
  "crunchyroll-premium": [500, 2500, 4500, 600, 2900, 5200],
};

async function validate() {
  let { data, error } = await db
    .from("products")
    .select(
      "slug, price_dzd, stock, inventory_type, product_variants(id, option_values, price_baridimob_dzd, price_flexy_dzd, stock, is_active)",
    )
    .in("slug", Object.keys(expected));
  if (error) throw error;
  const rows = data || [];
  const issues: string[] = [];
  for (const slug of Object.keys(expected)) {
    const row = rows.find((item) => item.slug === slug);
    const variants = row?.product_variants || [];
    if (!row) issues.push(`${slug}: missing product`);
    const combinations = variants.flatMap(
      (variant: { price_baridimob_dzd?: number; price_flexy_dzd?: number }) =>
        [variant.price_baridimob_dzd, variant.price_flexy_dzd]
          .filter((price): price is number => price != null)
          .map(Number),
    );
    const expectedFormulaCount = expected[slug].length / 2;
    if (variants.length !== expectedFormulaCount)
      issues.push(
        `${slug}: expected ${expectedFormulaCount} formulas, found ${variants.length}`,
      );
    const prices = combinations.sort((a: number, b: number) => a - b);
    const expectedPrices = [...expected[slug]].sort((a, b) => a - b);
    if (
      prices.length === expectedPrices.length &&
      prices.some((price, index) => price !== expectedPrices[index])
    )
      issues.push(`${slug}: exact prices do not match client source`);
    if (
      row?.stock !== 0 ||
      row?.inventory_type !== "finite" ||
      variants.some(
        (variant: { stock: number; is_active?: boolean }) =>
          variant.stock !== 0 || variant.is_active === false,
      )
    )
      issues.push(`${slug}: non-empty inventory state or disabled seed option`);
  }
  const total = rows.reduce(
    (sum, row) =>
      sum +
      (row.product_variants || []).reduce(
        (
          subtotal: number,
          variant: { price_baridimob_dzd?: number; price_flexy_dzd?: number },
        ) =>
          subtotal +
          (variant.price_baridimob_dzd != null ? 1 : 0) +
          (variant.price_flexy_dzd != null ? 1 : 0),
        0,
      ),
    0,
  );
  if (total !== 72)
    issues.push(`total: expected 72 pricing combinations, found ${total}`);
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(
    JSON.stringify(
      {
        products: rows.length,
        pricingCombinations: total,
        noStockCreated: true,
        valid: true,
      },
      null,
      2,
    ),
  );
}
validate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
