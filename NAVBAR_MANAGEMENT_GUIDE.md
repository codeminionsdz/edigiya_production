# نظام إدارة الـ Navbar - دليل وثائق شامل

تم تطوير نظام متكامل يسمح للمسؤولين بالتحكم الكامل في الـ navbar وإنشاء صفحات مخصصة.

## ✅ ما تم إنجازه

### 1. قاعدة البيانات (Database)
**ملف**: `supabase/migrations/20260417_add_navbar_management.sql`

تم إنشاء جدولين جديدين:
- **navbar_items**: لتخزين عناصر الـ navbar
  - يدعم multilingual (عربي/فرنسي)
  - يدعم ترتيب مخصص (sort_order)
  - يدعم التفعيل/التعطيل
  - يدعم أنواع مختلفة from رابط عادي إلى صفحة مخصصة

- **custom_pages**: لتخزين الصفحات المخصصة
  - محتوى ثنائي اللغة
  - دعم SEO metadata
  - دعم الصور
  - خيار لإظهار في الـ navbar

### 2. Server Actions
**ملف**: `app/admin/navbar/actions.ts`

تم إنشاء عدة دوال للتعامل مع البيانات:

#### Navbar Items Functions:
- `getNavbarItems()` - جلب العناصر النشطة فقط
- `getAllNavbarItems()` - جلب جميع العناصر
- `createNavbarItem(item)` - إنشاء عنصر جديد
- `updateNavbarItem(id, item)` - تحديث عنصر
- `deleteNavbarItem(id)` - حذف عنصر
- `updateNavbarItemOrder()` - تحديث الترتيب

#### Custom Pages Functions:
- `getCustomPages()` - جلب الصفح النشطة
- `getAllCustomPages()` - جلب جميع الصفح
- `getCustomPageBySlug(slug)` - جلب صفحة بـ slug محدد
- `createCustomPage(page)` - إنشاء صفحة جديدة
- `updateCustomPage(id, page)` - تحديث صفحة
- `deleteCustomPage(id)` - حذف صفحة
- `toggleCustomPageActive()` - تفعيل/تعطيل الصفحة

### 3. واجهة الإدارة (Admin Interface)
**ملف**: `app/admin/navbar/page.tsx`

واجهة شاملة تتضمن:
- **قسم Navbar Items**: 
  - عرض جميع عناصر الـ navbar
  - إنشاء عنصر جديد
  - تعديل عنصر موجود
  - حذف عنصر
  - تفعيل/تعطيل العنصر
  - Dialog منفصل لكل عملية

- **قسم Custom Pages**:
  - عرض جميع الصفح المخصصة
  - إنشاء صفحة جديدة
  - تعديل صفحة
  - حذف صفحة
  - تفعيل/تعطيل الصفحة
  - إظهار/إخفاء من الـ navbar
  - Editor متكامل للمحتوى بالعربية والفرنسية

### 4. تحديثات Frontend
**الملفات المحدّثة**: 
- `components/store/store-navbar.tsx`
- `app/admin/layout.tsx`

#### في store-navbar.tsx:
- إضافة state جديد: `navbarItems` و `navbarItemsLoading`
- إضافة interface جديد: `NavbarItem`
- إضافة import للـ `getNavbarItems` action
- إضافة useEffect لتحميل navbar items
- عرض navbar items في الـ desktop navigation
- عرض navbar items في الـ mobile navigation

#### في admin/layout.tsx:
- إضافة `Navigation` icon من lucide-react
- إضافة navbar link في الـ sidebar: `/admin/navbar`
- يظهر في الـ menu مع الأيقونة المناسبة

### 5. Dynamic Pages Route
**ملف**: `app/(store)/pages/[slug]/page.tsx`

صفحة ديناميكية لعرض الصفح المخصصة:
- URL: `/pages/[slug]`
- تحميل الصفحة من قاعدة البيانات
- عرض الصورة (إن وجدت)
- عرض المحتوى بصيغة HTML
- دعم SEO metadata
- رسالة "Page Not Found" في حالة عدم وجود الصفحة

## 🚀 كيفية الاستخدام

### 1. تطبيق الـ Migration
قبل أي شيء، يجب تطبيق الـ migration على قاعدة البيانات:

**طريقة 1 - Supabase Dashboard**:
1. اذهب إلى Supabase.com
2. حدد المشروع
3. اذهب إلى SQL Editor
4. انسخ محتوى ملف الـ migration
5. شغّل الـ SQL

**طريقة 2 - Supabase CLI** (إذا كان مثبت):
```bash
supabase db push
```

### 2. إضافة عنصر Navbar جديد

1. **اذهب إلى لوحة الإدارة**: `http://yourdomain.com/admin/navbar`
2. **اضغط "Add Item"** (الزر الأخضر في القسم العلوي)
3. **ملأ النموذج**:
   - **Label (Arabic)**: اسم العنصر بالعربية (مثلاً: "الصحة والتغذية")
   - **Label (French)**: اسم العنصر بالفرنسية (مثلاً: "Santé et Nutrition")
   - **URL**: الرابط (مثلاً: `/products/health` أو `/pages/about`)
   - **Type**: اختر "Link" للرابط عادي أو "Custom Page" إذا كانت صفحة مخصصة
   - **Target**: اختر "Same Tab" لفتح في نفس النافذة أو "New Tab" لفتح في نافذة جديدة
4. **اضغط Save**

### 3. إنشاء صفحة مخصصة

1. **اذهب إلى لوحة الإدارة**: `http://yourdomain.com/admin/navbar`
2. **انزل إلى قسم Custom Pages**
3. **اضغط "Create Page"**
4. **ملأ النموذج**:
   - **Slug**: معرّف فريد للصفحة بدون مسافات (مثلاً: `about-us`)
   - **Title (Arabic)**: عنوان الصفحة بالعربية
   - **Title (French)**: عنوان الصفحة بالفرنسية
   - **Content (Arabic)**: محتوى الصفحة بالعربية
   - **Content (French)**: محتوى الصفحة بالفرنسية
   - **Meta Description**: وصف قصير للـ SEO
   - **Show in Navbar**: فعّل هذا إذا أردت إظهار الصفحة في الـ navbar
5. **اضغط Save**
6. **الصفحة ستكون متاحة على**: `http://yourdomain.com/pages/about-us`

### 4. إدارة العناصر الموجودة

في صفحة الـ admin، يمكنك:
- **تعديل**: اضغط الزر الأزرق (Edit)
- **حذف**: اضغط الزر الأحمر (Delete)
- **تفعيل/تعطيل**: اضغط "Activate" أو "Deactivate"
- **إظهار/إخفاء من Navbar**: (للصفح المخصصة) اضغط زر العين

## 📋 مثال عملي

### السيناريو: إضافة صفحة "عن المتجر" إلى الـ navbar

**الخطوة 1**: إنشاء الصفحة المخصصة
```
Slug: about-store
Title (AR): عن المتجر
Title (FR): À propos du magasin
Content (AR): نحن متجر متخصص في المكملات الغذائية...
Content (FR): Nous sommes un magasin spécialisé dans les suppléments nutritionnels...
Show in Navbar: ✓ (مفعّل)
```

**الخطوة 2**: إضافة عنصر navbar يشير للصفحة
```
Label (AR): عن المتجر
Label (FR): À propos
URL: /pages/about-store
Type: Custom Page
Target: Same Tab
```

**النتيجة**: سيظهر "عن المتجر" في الـ navbar (على الـ desktop والـ mobile)

## 🔧 الهيكل التقني

```
Database Layer
    ↓
Server Actions (app/admin/navbar/actions.ts)
    ↓
Admin Panel (app/admin/navbar/page.tsx)
    ↓
Frontend (components/store/store-navbar.tsx)
    ↓
User See Navbar Items
```

## 🎨 كيفية عمل الـ Navbar

### Desktop View
```
[Departments] [Shop] [Brands] [Deals] [Custom Item 1] [Custom Item 2] ...
```

### Mobile View
- زر Hamburger Menu
- عند الضغط يظهر:
  - Navigation Section (Shop, Brands, Deals, + Custom Items)
  - Categories Section (تابع من أي فئات نشطة)

## ⚙️ الخصائص المتقدمة

### Multilingual Support
كل العناصر تدعم عربي/فرنسي:
- عنوان العنصر: `label_ar`, `label_fr`
- محتوى الصفحة: `content_ar`, `content_fr`
- وصف SEO: `meta_description_ar`, `meta_description_fr`

### Sort Order
عنصر `sort_order` يتحكم في ترتيب العناصر في الـ navbar:
- 0 = أول عنصر
- 1 = ثاني عنصر
- إلخ...

### Active/Inactive
كل عنصر له حالة `is_active`:
- عندما تكون `true`: يظهر في الـ navbar
- عندما تكون `false`: لا يظهر للمستخدمين

## 🆘 استكشاف الأخطاء

### الـ navbar items لا تظهر
- تأكد من تطبيق الـ migration على قاعدة البيانات
- تأكد من أن العناصر لديها `is_active = true`
- افحص في developer console (F12) هل هناك أخطاء

### الصفح المخصصة لا تحميل
- تأكد من أن الـ slug فريد
- تأكد من أن `is_active = true`
- تحقق من الـ URL: `/pages/[slug]`

## 📚 الملفات المتعلقة

- Migration: `supabase/migrations/20260417_add_navbar_management.sql`
- Actions: `app/admin/navbar/actions.ts`
- Admin Page: `app/admin/navbar/page.tsx`
- Store Navbar: `components/store/store-navbar.tsx`
- Pages Route: `app/(store)/pages/[slug]/page.tsx`
- Admin Layout: `app/admin/layout.tsx`

---

**تم إنشاء هذا النظام بتاريخ**: 17 أبريل 2026
**الإصدار**: 1.0
**الح**: جاهز للاستخدام الفوري

