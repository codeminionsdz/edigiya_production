'use server';

import { cookies } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createOrder, addOrderItem } from '@/lib/repositories';

export async function placeOrder(formData: FormData) {
  try {
    // Get session ID from cookie
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    console.log('🛒 Place Order - Session ID:', sessionId ? 'Found' : 'Not found');
    
    if (!sessionId) {
      console.error('❌ No session_id found in cookies');
      return { error: 'Session non trouvée. Veuillez rafraîchir la page.' };
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      console.error('❌ Invalid session_id format:', sessionId);
      return { error: 'Session invalide. Veuillez rafraîchir la page et réessayer.' };
    }

    // Extract form data
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const stopDeskName = formData.get('stopDeskName') as string;
    const wilayaCode = formData.get('wilayaCode') as string;
    const deliveryMethod = formData.get('deliveryMethod') as 'home' | 'desk';
    const paymentMethod = formData.get('paymentMethod') as string;
    const cartItemsJson = formData.get('cartItems') as string;
    const subtotal = parseFloat(formData.get('subtotal') as string);
    const shipping = parseFloat(formData.get('shipping') as string);
    const total = parseFloat(formData.get('total') as string);

    // Validate form data
    if (!firstName || !lastName || !phone || !address || !wilayaCode) {
      return { error: 'Informations manquantes. Veuillez remplir tous les champs.' };
    }

    const cartItems = JSON.parse(cartItemsJson);
    
    console.log('🛒 Place Order - Cart items:', cartItems.length);
    
    if (!cartItems || cartItems.length === 0) {
      return { error: 'Votre panier est vide.' };
    }

    // Generate order number
    const orderNumber = `CH-${Date.now()}`;
    
    console.log('🛒 Place Order - Creating order:', orderNumber);

    // Create order
    const order = await createOrder({
      order_number: orderNumber,
      session_id: sessionId,
      status: 'pending',
      payment_method: paymentMethod,
      subtotal,
      shipping,
      total,
      wilaya_code: parseInt(wilayaCode, 10),
      delivery_method: deliveryMethod,
      address_snapshot: {
        firstName,
        lastName,
        phone,
        address,
        stopDeskName: deliveryMethod === 'desk' ? stopDeskName : undefined,
      },
    });

    console.log('📦 Order created with ID:', order.id);

    console.log('📦 Order created with ID:', order.id);

    // Add order items
    console.log('📦 Adding order items...');
    for (const item of cartItems) {
      await addOrderItem({
        order_id: order.id,
        product_id: item.product.id,
        variant_id: item.variantId || undefined,
        title_snapshot: item.product.name.fr, // Use FR as snapshot
        unit_price_dzd: item.product.price,
        qty: item.quantity,
        line_total_dzd: item.product.price * item.quantity,
      });
    }

    console.log('✅ Order created successfully:', orderNumber);

    revalidatePath('/admin/orders');

    return { success: true, orderId: order.id, orderNumber };
  } catch (error: any) {
    console.error('❌ Order placement failed:', error);
    return { error: error?.message || 'Erreur lors de la création de la commande.' };
  }
}
