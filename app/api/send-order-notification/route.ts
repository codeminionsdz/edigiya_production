import { wilayas } from '@/lib/data';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nutrition-dz.store';

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  throw new Error('Missing Telegram environment variables. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');
}

function getWilayaName(code: string | number): string {
  const wilayaCode = String(code).padStart(2, '0');
  const wilaya = wilayas.find(w => w.code === wilayaCode);
  return wilaya ? wilaya.name : `الولاية ${code}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      order_id,
      order_number,
      customer_name,
      total_amount,
      wilaya_code,
      phone,
      address,
      delivery_method,
      cartItems,
      subtotal,
      shipping,
    } = body;

    if (!order_id || !order_number) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get wilaya name
    const wilayaName = wilaya_code ? getWilayaName(wilaya_code) : 'غير محدد';

    // Format items list
    let itemsList = '';
    if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
      itemsList = '\n\n📦 المنتجات:\n';
      cartItems.forEach((item, index) => {
        const itemName = item.product?.name?.fr || item.title || `منتج ${index + 1}`;
        const qty = item.quantity || 1;
        const price = item.product?.price || 0;
        const lineTotal = price * qty;
        itemsList += `${index + 1}. ${itemName} x${qty} = ${lineTotal} DZD\n`;
      });
    }

    // Build direct link to order
    const orderLink = `${SITE_URL}/admin/orders`;

    // Build message
    const message = `✅ <b>طلبية جديدة!</b>

<b>📋 معلومات الطلب:</b>
رقم الطلب: <code>${order_number}</code>
الحالة: قيد الانتظار

<b>👤 بيانات الزبون:</b>
الاسم: ${customer_name || 'عميل'}
الهاتف: ${phone || 'غير محدد'}
الولاية: ${wilayaName}
${address ? `العنوان: ${address}` : ''}

<b>طريقة التوصيل:</b>
${delivery_method === 'home' ? '🏠 توصيل للمنزل' : '📍 استلام من مكتب'}
${itemsList}
<b>💰 التفاصيل المالية:</b>
المجموع الجزئي: ${subtotal || total_amount || 0} DZD
توصيل: ${shipping || 0} DZD
<b>الإجمالي: ${total_amount || 0} DZD</b>

<a href="${orderLink}">👉 اضغط هنا لعرض الطلب</a>`;

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Telegram send error:', response.status, errorBody);
      return Response.json(
        { error: 'Failed to send Telegram notification' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Send notifications error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
