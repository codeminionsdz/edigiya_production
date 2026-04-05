# ComputerHouse Ecommerce Platform - Setup & Deployment Guide

A production-ready ecommerce platform for ComputerHouse built with **Next.js 16**, **Supabase PostgreSQL**, **shadcn/ui**, and **TypeScript**.

## Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (or npm/yarn)
- Supabase account (free tier works)
- Vercel account (for deployment)

### 1. Clone & Install

```bash
git clone <your-repo>
cd computerhouse
pnpm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at https://supabase.com
2. In project settings, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY`

3. Create `.env.local`:

```env
# Supabase (public - safe for client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your_anon_key

# Supabase (server-side only - KEEP SECRET)
SUPABASE_SERVICE_ROLE_KEY=eyJ...your_service_role_key

# Admin Panel
ADMIN_PANEL_PASSWORD=YourSecurePassword123!
```

### 3. Run Database Migrations

Execute migrations in Supabase SQL Editor:

**Step 1:** Apply initial schema
```
supabase/migrations/20240213_initial_schema.sql
```

**Step 2:** Seed data (departments, brands, categories, products)
```
scripts/seed-final.sql
```

Or run locally if using Supabase CLI:
```bash
supabase db push
supabase db reset  # includes seed
```

### 4. Start Development Server

```bash
pnpm dev
```

- Store: http://localhost:3000
- Admin: http://localhost:3000/admin (password: `computerh2026`)

## Database Schema

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| **departments** | Top-level categories | slug, name_fr, name_ar, icon |
| **categories** | Hierarchical product categories | department_id, parent_id, slug |
| **brands** | Product manufacturers | name, slug, logo_url |
| **products** | Products in catalog | title, price_dzd, stock, category_id, brand_id |
| **orders** | Customer orders | order_number, total_dzd, status, wilaya_code |
| **carts** | Shopping carts by session | session_id |
| **wilayas** | Algerian provinces (58) | code, name, is_active |
| **shipping_rates** | Shipping costs per wilaya/method | wilaya_code, method, price_dzd |

### Key Features

- **Multi-language** (French & Arabic) support in product titles/descriptions
- **Session-based shopping** using httpOnly cookies
- **Atomic stock management** with inventory protection
- **Wilaya-based shipping** with configurable rates
- **Admin authentication** with password-only access
- **Row Level Security (RLS)** for data protection

## Admin Panel

### Access
- URL: `/admin`
- Password: Configure in `ADMIN_PANEL_PASSWORD` env var
- Default (demo): `computerh2026`

### Admin Features

1. **Dashboard** - KPIs, revenue, recent orders, low stock alerts
2. **Products** - CRUD operations, bulk management
3. **Orders** - View, manage status, shipping details
4. **Shipping** - Configure wilaya rates and methods
5. **Departments & Categories** - Hierarchical taxonomy management

### Server Actions (API)

All admin operations use server actions in `app/admin/actions.ts`:

```typescript
// Example: Create product
await adminCreateProduct({
  slug: 'product-slug',
  title_fr: 'Titre Francais',
  title_ar: 'العنوان بالعربية',
  price_dzd: 50000,
  stock: 10,
  department_id: '...',
  category_id: '...',
})
```

## Store Features

### Public Pages

- **`/`** - Homepage with featured products
- **`/shop`** - Product catalog with filters & sorting
- **`/product/[slug]`** - Product detail page
- **`/cart`** - Shopping cart management
- **`/checkout`** - Multi-step checkout with shipping

### Commerce Flow

1. User adds products to cart (stored in session)
2. Cart updates persist in `carts` table
3. On checkout:
   - Select wilaya & delivery method
   - Shipping cost calculated
   - Order created with snapshot of items
   - Stock decremented atomically
   - Order number generated

## API Routes

### Store APIs

```
POST /api/store/cart/add        - Add product to cart
POST /api/store/cart/update     - Update quantity
POST /api/store/cart/remove     - Remove from cart
POST /api/store/checkout        - Create order
GET  /api/store/products        - List products
GET  /api/store/shipping-rates  - Get shipping costs
```

### Admin APIs (Protected)

```
POST /api/admin/products        - Create/update products
DELETE /api/admin/products/[id] - Delete product
POST /api/admin/orders/[id]     - Update order status
```

## Security

### Authentication
- Admin routes protected by middleware (`middleware.ts`)
- Session-based access with httpOnly cookies
- Service role key used only server-side

### Data Protection
- Row Level Security (RLS) policies on sensitive tables
- Parameterized queries prevent SQL injection
- Password-only admin access (no user accounts)

### Environment Variables
- Public keys safe for client (`NEXT_PUBLIC_*`)
- Service role key never exposed to client
- All secrets managed via Vercel environment

## Deployment to Vercel

### 1. Connect Repository
```bash
vercel link
```

### 2. Set Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
SUPABASE_SERVICE_ROLE_KEY = eyJ...
ADMIN_PANEL_PASSWORD = YourSecurePassword123!
```

### 3. Deploy

```bash
git push origin main  # Auto-deploys on push
# or
vercel deploy --prod
```

## Production Checklist

See `PRODUCTION_CHECKLIST.md` for complete end-to-end testing guide including:

- Database verification
- Admin panel testing
- Store functionality
- Stock management
- Multi-wilaya shipping
- Full purchase flow
- Security validation

## Troubleshooting

### Issue: "Anon key not configured"
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Restart dev server: `pnpm dev`

### Issue: "Service role key missing"
- Check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- Ensure it's the **Service Role Key**, not the anon key
- Never commit this to version control

### Issue: Admin login fails
- Verify `ADMIN_PANEL_PASSWORD` is set correctly
- Check browser console for error messages
- Ensure cookies are enabled

### Issue: Products don't appear in shop
- Run seed script: `scripts/seed-final.sql`
- Check if products are marked `is_active = true`
- Verify categories exist and products are assigned to them

### Issue: Stock not decrementing
- Check order was actually created (look in `orders` table)
- Verify stock trigger is active in database
- Check service role key permissions

## File Structure

```
computerhouse/
├── app/
│   ├── admin/                    # Admin panel
│   │   ├── page.tsx              # Dashboard
│   │   ├── products/             # Product CRUD
│   │   ├── orders/               # Order management
│   │   ├── shipping/             # Shipping config
│   │   └── actions.ts            # Admin server actions
│   ├── (store)/                  # Public store
│   │   ├── page.tsx              # Homepage
│   │   ├── shop/                 # Product catalog
│   │   ├── cart/                 # Shopping cart
│   │   ├── checkout/             # Checkout flow
│   │   └── actions.ts            # Store server actions
│   └── layout.tsx                # Root layout
├── lib/
│   ├── admin-auth.ts             # Admin authentication
│   ├── repositories.ts           # Database access layer
│   └── db.ts                     # Supabase client
├── supabase/
│   └── migrations/               # Database migrations
├── scripts/
│   ├── seed-final.sql            # Initial data seed
│   └── verify-setup.ts           # Verification script
├── SETUP.md                      # This file
└── PRODUCTION_CHECKLIST.md       # Testing guide
```

## Key Technologies

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase PostgreSQL
- **Client**: TanStack Query, Zustand (if used)
- **UI**: shadcn/ui, Tailwind CSS
- **Auth**: Custom password-based for admin
- **Deployment**: Vercel
- **Language**: TypeScript

## Support & Resources

- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)

## License

Proprietary - ComputerHouse

---

Last updated: February 13, 2026
