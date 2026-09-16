"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  adminGetOrderById,
  createOrderPaymentAtomic,
  getCheckoutProductsByIds,
  getResumableCheckoutForSession,
  getStoreSettings,
} from "@/lib/repositories";
import { submitPaymentProof } from "@/lib/payments/service";
import { buildOrderContactMessage } from "@/lib/order-contact-message";
import { createSlickPayInvoiceForPayment } from "@/lib/payments/slickpay-service";
import { verifySlickPayPaymentForSession } from "@/lib/payments/slickpay-service";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getResumableCheckoutAction(orderHint?: string) {
  try {
    const sessionId = (await cookies()).get("session_id")?.value;
    if (!sessionId || !uuidRegex.test(sessionId)) return null;
    return await getResumableCheckoutForSession(
      sessionId,
      orderHint && uuidRegex.test(orderHint) ? orderHint : undefined,
    );
  } catch (error) {
    console.error("Failed to resume checkout:", error);
    return null;
  }
}

export async function placeOrder(formData: FormData) {
  let paymentMethod = "flexy";
  try {
    const sessionId = (await cookies()).get("session_id")?.value;
    if (!sessionId || !uuidRegex.test(sessionId))
      return {
        error:
          "Session invalide. Veuillez rafraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â®chir la page.",
      };
    const firstName = String(formData.get("firstName") || "").trim(),
      lastName = String(formData.get("lastName") || "").trim(),
      email = String(formData.get("email") || "").trim(),
      phone = String(formData.get("phone") || "").trim();
    const deliveryMethod = "digital";
    paymentMethod = String(formData.get("paymentMethod") || "flexy");
    const checkoutKey = String(formData.get("checkoutKey") || "").trim();
    if (!["slickpay", "flexy", "baridimob"].includes(paymentMethod))
      return {
        error:
          "Cette mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©thode de paiement nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢est pas disponible pour un achat numÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rique.",
      };
    let paymentSettings: any = null;
    try {
      if (paymentMethod !== "slickpay")
        paymentSettings = await getStoreSettings();
    } catch {
      return {
        error:
          "Les mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©thodes de paiement sont temporairement indisponibles. Veuillez rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©essayer plus tard.",
      };
    }
    const configured =
      paymentMethod === "slickpay"
        ? true
        : paymentMethod === "flexy"
          ? Boolean(
              String(paymentSettings?.flexy_number || "").trim() &&
              String(paymentSettings?.flexy_instructions || "").trim(),
            )
          : paymentMethod === "baridimob" || paymentMethod === "ccp"
            ? Boolean(String(paymentSettings?.ccp_instructions || "").trim())
            : Boolean(String(paymentSettings?.bank_instructions || "").trim());
    if (!configured)
      return {
        error:
          "Cette mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©thode de paiement est temporairement indisponible. Veuillez choisir une autre mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©thode.",
      };
    if (
      !firstName ||
      !lastName ||
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !phone ||
      !uuidRegex.test(checkoutKey)
    )
      return {
        error:
          "Veuillez complÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ter vos informations avec une adresse e-mail valide.",
      };
    let requestedItems: any[];
    try {
      requestedItems = JSON.parse(String(formData.get("cartItems") || "[]"));
    } catch {
      return { error: "Panier invalide." };
    }
    if (!Array.isArray(requestedItems) || requestedItems.length === 0)
      return { error: "Votre panier est vide." };
    const normalized = requestedItems.map((item) => ({
      productId: String(item?.product?.id || ""),
      quantity: Number(item?.quantity || 0),
    }));
    if (
      normalized.some(
        (item) =>
          !uuidRegex.test(item.productId) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 99,
      )
    )
      return { error: "Article de panier invalide." };
    const products = await getCheckoutProductsByIds(
      normalized.map((item) => item.productId),
    );
    if (products.length !== normalized.length)
      return {
        error:
          "Un produit du panier nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢est plus disponible.",
      };
    const productById = new Map(
      products.map((product: any) => [product.id, product]),
    );
    let subtotal = 0;
    const authoritativeItems = normalized.map((item) => {
      const product: any = productById.get(item.productId);
      if (!product?.is_active)
        throw new Error(
          `Le produit ${product?.title_fr || ""} nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢est plus disponible.`,
        );
      /* Legacy variant input is ignored: a cart item is product + payment. */
      const variant = null; /* item.variantId
        ? (product.product_variants || []).find(
            (candidate: any) =>
              candidate.id === item.variantId &&
              candidate.product_id === product.id &&
              candidate.is_active !== false,
          )
        : null */
      if (false && !variant)
        throw new Error(
          "La variante sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©lectionnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e est invalide.",
        );
      const hasVariants = (product.product_variants || []).length > 0;
      if (false && hasVariants && !variant) {
        throw new Error("Veuillez sélectionner une formule.");
      }
      const stock = product.stock;
      const digitalStock = product.digital_inventory_count;
      const finite = product.inventory_type !== "unlimited";
      const insufficientStock =
        digitalStock !== undefined && digitalStock !== null
          ? digitalStock < item.quantity
          : finite && stock !== null && stock < item.quantity;
      if (insufficientStock)
        throw new Error(
          `Le produit ${product.title_fr} nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢est plus disponible.`,
        );
      const selectedPrice =
        paymentMethod === "baridimob"
          ? product.price_baridimob_dzd
          : paymentMethod === "flexy"
            ? product.price_flexy_dzd
            : product.price_slickpay_dzd;
      if (
        selectedPrice === null ||
        selectedPrice === undefined ||
        !Number.isFinite(Number(selectedPrice))
      ) {
        throw new Error("Le prix de ce produit est indisponible.");
      }
      const unitPrice = Number(selectedPrice);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      return {
        product,
        variant,
        variantId: null,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        paymentMethod,
      };
    });
    const shipping = 0,
      total = subtotal;
    const orderNumber = `CH-${Date.now()}`;
    const result = await createOrderPaymentAtomic({
      orderNumber,
      checkoutKey,
      sessionId,
      paymentMethod,
      subtotal,
      shipping,
      total,
      wilayaCode: null,
      deliveryMethod,
      addressSnapshot: { firstName, lastName, email, phone },
      items: authoritativeItems.map((item) => ({
        product_id: item.product.id,
        variant_id: item.variantId,
        title_snapshot: `${item.product.title_fr} · ${paymentMethod}`,
        unit_price_dzd: item.unitPrice,
        qty: item.quantity,
        line_total_dzd: item.lineTotal,
      })),
    });
    revalidatePath("/admin/orders");
    const created = await adminGetOrderById(result.order_id);
    const payment = created.payments?.[0];
    const paymentStatus = payment?.status || "pending";
    let paymentUrl: string | undefined;
    if (paymentMethod === "slickpay") {
      const invoice = await createSlickPayInvoiceForPayment({
        paymentId: result.payment_id,
        orderId: result.order_id,
        sessionId,
        customer: { firstName, lastName, phone, email },
      });
      paymentUrl = invoice.paymentUrl;
    }
    const createdOrder = {
      subtotal: Number(created.subtotal_dzd),
      total: Number(created.total_dzd),
      shipping: Number(created.shipping_dzd),
      items: (created.order_items || []).map((item: any) => ({
        id: item.id,
        title: item.title_snapshot,
        qty: item.qty,
        unitPrice: Number(item.unit_price_dzd),
        lineTotal: Number(item.line_total_dzd),
      })),
    };
    const customer = created.address_snapshot || {};
    return {
      success: true,
      orderId: result.order_id,
      orderNumber: result.order_number,
      paymentId: result.payment_id,
      paymentStatus,
      paymentUrl,
      amount: total,
      createdOrder,
      contactMessage: buildOrderContactMessage({
        orderNumber: created.order_number,
        items: created.order_items?.map((item: any) => ({
          title: item.title_snapshot,
          qty: Number(item.qty),
          unitPrice: Number(item.unit_price_dzd),
        })),
        total: Number(created.total_dzd),
        method: payment?.method,
        status: paymentStatus,
        customer: {
          name: [customer.firstName, customer.lastName]
            .filter(Boolean)
            .join(" "),
          phone: customer.phone,
          email: customer.email,
        },
      }),
    };
  } catch (error: any) {
    console.error(
      "Order placement failed:",
      paymentMethod === "slickpay" ? "SlickPay checkout failed" : error,
    );
    return {
      error:
        paymentMethod === "slickpay"
          ? "Le paiement SlickPay est temporairement indisponible. Votre commande reste en attente, veuillez rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©essayer."
          : error?.message ||
            "Erreur lors de la crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ation de la commande.",
    };
  }
}

export async function submitPaymentProofAction(formData: FormData) {
  try {
    const sessionId = (await cookies()).get("session_id")?.value,
      paymentId = String(formData.get("paymentId") || ""),
      orderId = String(formData.get("orderId") || ""),
      file = formData.get("proof");
    if (
      !sessionId ||
      !uuidRegex.test(sessionId) ||
      !uuidRegex.test(paymentId) ||
      !uuidRegex.test(orderId) ||
      !(file instanceof File)
    )
      return { error: "DonnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es de preuve invalides." };
    const payment = await submitPaymentProof({
      paymentId,
      orderId,
      sessionId,
      file,
      reference: String(formData.get("reference") || ""),
    });
    return { success: true, status: payment.status };
  } catch (error: any) {
    const message = String(error?.message || "");
    const safe = [
      "Paiement introuvable.",
      "Une preuve est uniquement requise pour un paiement manuel.",
      "Ce paiement ne peut plus ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre modifiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.",
      "La preuve doit faire au maximum 8 Mo.",
      "Format acceptÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© : JPG, PNG ou WebP.",
      "Le contenu du fichier ne correspond pas ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  une image valide.",
      "Une preuve a dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© envoyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e et est en cours de vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rification.",
      "PAYMENT_STATE_CONFLICT",
    ];
    return {
      error: safe.includes(message)
        ? message === "PAYMENT_STATE_CONFLICT"
          ? "Cette preuve a dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© envoyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e ou le paiement a changÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tat."
          : message
        : "Impossible dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢envoyer la preuve. Veuillez rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©essayer.",
    };
  }
}

export async function verifySlickPayReturnAction(
  orderId: string,
  paymentId: string,
) {
  try {
    const sessionId = (await cookies()).get("session_id")?.value;
    if (
      !sessionId ||
      !uuidRegex.test(sessionId) ||
      !uuidRegex.test(orderId) ||
      !uuidRegex.test(paymentId)
    )
      return { error: "Paiement introuvable." };
    const payment = await verifySlickPayPaymentForSession({
      orderId,
      paymentId,
      sessionId,
    });
    return { success: true, status: payment?.status || "pending" };
  } catch {
    return {
      error:
        "La vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rification du paiement est temporairement indisponible.",
    };
  }
}
