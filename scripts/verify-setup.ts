import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function countRows(table: string, countColumn = "*") {
  const { count, error } = await supabase
    .from(table)
    .select(countColumn, { count: "exact", head: true })

  if (error) {
    return { ok: false, error: error.message, count: 0 }
  }

  return { ok: true, count: count || 0 }
}

async function checkReadable(table: string) {
  const { error } = await supabase.from(table).select("*").limit(1)
  if (error && error.code !== "PGRST116") {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

async function verifySetup() {
  console.log("Verifying store setup...\n")

  const tables = [
    "departments",
    "categories",
    "brands",
    "products",
    "product_images",
    "product_specs",
    "product_variants",
    "carts",
    "cart_items",
    "addresses",
    "orders",
    "order_items",
    "shipping_wilayas",
    "shipping_rates",
    "shipping_rules",
    "homepage_banners",
    "marquee_brands",
  ]

  console.log("Checking table accessibility...")
  for (const table of tables) {
    const readable = await checkReadable(table)
    if (!readable.ok) {
      console.log(`  x ${table}: ${readable.error}`)
      continue
    }
    console.log(`  ok ${table}`)
  }

  console.log("\nChecking key counts...")
  const checks = [
    { table: "shipping_wilayas", label: "wilayas", countColumn: "code" },
    { table: "shipping_rates", label: "shipping rates" },
    { table: "departments", label: "departments" },
    { table: "categories", label: "categories" },
    { table: "brands", label: "brands" },
    { table: "products", label: "products" },
  ]

  for (const check of checks) {
    const result = await countRows(check.table, check.countColumn)
    if (!result.ok) {
      console.log(`  x ${check.label}: ${result.error}`)
    } else {
      console.log(`  ok ${check.label}: ${result.count}`)
    }
  }

  console.log("\nSetup verification complete.")
  console.log("Suggested next checks:")
  console.log("1. Visit /admin/login and validate CRUD in admin")
  console.log("2. Open /shop and verify filters + search")
  console.log("3. Place one test checkout end-to-end")
}

void verifySetup().catch((error) => {
  console.error("Setup verification failed:", error)
  process.exit(1)
})
