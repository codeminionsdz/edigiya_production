# 🔧 Debugging Guide - مشاكل المنتجات والصفح

## المشكلة 1: لا تظهر المنتجات عند البحث ❌

### الأسباب المحتملة:

#### 1️⃣ **البيانات لا تحمّل من البداية**
```
✓ افحص console (F12)
✓ ابحث عن: "Loaded products: X"
✓ إذا ما ظهرت = البيانات ما تحمّلت
```

#### 2️⃣ **Database فارغة**
```
✓ اذهب إلى Supabase
✓ تحقق من جدول products
✓ يجب يكون فيه منتجات
```

#### 3️⃣ **الـ getProducts() ما تعود البيانات**
```
✓ افحص Network tab في DevTools (F12)
✓ شوف الـ request للـ /admin/navbar/products
✓ شوف الـ response
```

### الحل:

**الخطوة 1**: افتح DevTools (F12)
```
F12 → Console
```

**الخطوة 2**: لخص المعلومات
```
عند تحميل الصفحة ستشوف:
✅ Loaded products: 15
[{id: "1", name: "Whey Protein", ...}, ...] 
```

**الخطوة 3**: إذا ما ظهر شي
```
❌ لا توجد رسالة = البيانات ما تحمّلت
→ تحقق من Database
→ تحقق من الـ getProducts() function
```

---

## المشكلة 2: الـ Search ما يشتغل ❌

### الحل المضاف:

عند الكتابة في Search فستشوف في Console:
```
Search query: "whey"
Available products: [...]
```

**إذا:**
- ✅ Products موجودة = البحث يشتغل
- ❌ Products فارغة = Database ما فيه بيانات

---

## المشكلة 3: الصفح المخصصة ما تظهر (404) ❌

### الأسباب المحتملة:

#### 1️⃣ **لم تطبّق الـ Migration**
```sql
الـ custom_pages جدول ما موجود
→ لا توجد صفح في Database
```

#### 2️⃣ **الـ Slug غير صحيح**
```
أنشأت صفحة: slug = "about-us"
لكن تحاول: /pages/about
❌ ما يصير
```

#### 3️⃣ **الصفحة غير مفعّلة**
```
في الإدارة، الصفحة قد تكون:
is_active = false
→ لا تظهر
```

### الحل:

**الخطوة 1**: افحص Console (F12)
```
عند الدخول للصفحة ستشوف:
🔍 Looking for page with slug: test-page
📊 Result: {...}
```

**الخطوة 2**: إذا ظهر "❌ Page not found"
```
السبب:
1. الـ migration ما طُبّقت
2. الـ slug ما يطابق
3. الصفحة معطّلة (is_active = false)
```

**الخطوة 3**: الحل:
```
1. طبّق الـ migration
2. تأكد من صحة الـ slug
3. تفعّل الصفحة في الإدارة
4. تحديث الصفحة (Ctrl+F5)
```

---

## 🔍 Debugging Checklist

### قبل إضافة منتجات:
- [ ] Migration طُبّقت؟
- [ ] Database فيه منتجات؟
- [ ] Products تحمّل من البداية؟

### عند البحث:
- [ ] افحص Console (F12)
- [ ] ابحث عن "Loaded products: X"
- [ ] شوف عدد المنتجات

### عند إضافة صفحة:
- [ ] Migration طُبّقت؟
- [ ] الـ slug بدون مسافات؟
- [ ] is_active = true؟
- [ ] URL يطابق الـ slug؟

---

## 📍 Console Messages (ما تقلق منها)

### عند تحميل المنتجات:
```
✅ Products loaded: 15
[{...}, {...}, ...]
```

### عند البحث:
```
Search query: "whey"
Available products: [{...}, ...]
```

### عند تحميل صفحة:
```
🔍 Looking for page with slug: test-page
📊 Result: {...}
✅ Page found: {title_fr: "Test", ...}
```

### إذا حدث خطأ:
```
❌ Query error: {code: "XXXX", message: "..."}
❌ Page not found with slug: test-page
```

---

## 💡 نصائح سريعة

### لتصحيح المشاكل:
1. ✅ افحص Console (F12)
2. ✅ اقرأ الـ error messages
3. ✅ تحقق من Database في Supabase
4. ✅ تحديث الصفحة (Ctrl+F5)
5. ✅ امسح الـ cookies

### الأوامر المفيدة في Console:
```javascript
// شوف جميع المنتجات المحمّلة
console.log(document.body)
```

---

## 🆘 إذا بقيت المشكلة

### قدّم المعلومات الآتية:
1. Screenshot من Console (F12)
2. الـ slug أو النص الذي تبحث عنه
3. الـ error messages
4. رابط الصفحة

---

**هذا الـ debugging يساعدك على معرفة ما الذي يحدث بالضبط!** ✨
