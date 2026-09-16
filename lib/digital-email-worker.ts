"use server";

import { createHmac, randomUUID } from "node:crypto";
import * as repo from "@/lib/repositories";
import {
  getDigitalEmailProvider,
  type EmailMessage,
} from "@/lib/email-provider";

const MAX_ATTEMPTS = 5;
const GUEST_GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`);
  return value;
}

function guestTokenFor(outboxId: string, orderId: string): string {
  return createHmac("sha256", required("GUEST_DELIVERY_TOKEN_SECRET"))
    .update(`guest-delivery:${outboxId}:${orderId}`)
    .digest("base64url");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] as string,
  );
}

function formatPrice(value: number): string {
  return `${value.toLocaleString("fr-DZ")} DZD`;
}

function parseCredential(secret: string) {
  return {
    username: secret.match(/^\s*Username:\s*(.+)$/im)?.[1]?.trim(),
    password: secret.match(/^\s*Password:\s*([\s\S]+)$/im)?.[1]?.trim(),
  };
}

async function buildMessage(
  job: any,
  guestLinks: string[],
): Promise<EmailMessage> {
  const context = await repo.getDigitalDeliveryEmailContext(job.order_id);
  const siteUrl = required("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  const isGuest = job.email_type === "guest_digital_delivery";
  const orderLink = `${siteUrl}/account/orders/${encodeURIComponent(job.order_id)}`;
  const textLines = [
    "Edigiya Store",
    `Order: ${context.orderNumber}`,
    "Paiement : Payé",
    "Livraison : Produit livré",
    "",
  ];
  const itemHtml = context.items
    .map((item: any) => {
      const options =
        Object.entries(item.optionValues || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join(" · ") ||
        [item.variantName, item.variantValue].filter(Boolean).join(": ");
      const credential = parseCredential(item.secret);
      textLines.push(
        `Product: ${item.title}`,
        ...(options ? [`Package: ${options}`] : []),
        `Quantity: ${item.quantity}`,
        `Price: ${formatPrice(item.lineTotal)}`,
      );
      if (item.fulfillmentType === "credentials")
        textLines.push(
          `Username: ${credential.username || "(included in credential)"}`,
          `Password: ${credential.password || "(included in credential)"}`,
        );
      else textLines.push(`Code: ${item.secret}`);
      textLines.push("");
      return `<section style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px"><h2 style="margin:0 0 8px">${escapeHtml(item.title)}</h2>${options ? `<p><strong>Package:</strong> ${escapeHtml(options)}</p>` : ""}<p><strong>Quantity:</strong> ${item.quantity}<br><strong>Price:</strong> ${escapeHtml(formatPrice(item.lineTotal))}</p>${item.fulfillmentType === "credentials" ? `<p><strong>Username:</strong><br><code>${escapeHtml(credential.username || "(included in credential)")}</code></p><p><strong>Password:</strong><br><code>${escapeHtml(credential.password || "(included in credential)")}</code></p>` : `<p><strong>Code:</strong><br><code>${escapeHtml(item.secret)}</code></p>`}</section>`;
    })
    .join("");
  const links = guestLinks.length > 0 ? guestLinks : ["/account"];
  textLines.push(
    `Total : ${formatPrice(context.total)}`,
    `Voir ma commande : ${orderLink}`,
    ...(isGuest ? [`Livraison sécurisée : ${links.join("\n")}`] : []),
  );
  const safeLinks = links.map(escapeHtml);
  const html = `<div style="font-family:Arial,sans-serif;color:#111827;max-width:640px"><h1 style="color:#0f766e">Edigiya Store</h1><p>Votre livraison numérique est prête.</p><p><strong>Commande :</strong> ${escapeHtml(context.orderNumber)}<br><strong>Paiement :</strong> Payé<br><strong>Livraison :</strong> Produit livré</p>${itemHtml}<p><strong>Total :</strong> ${escapeHtml(formatPrice(context.total))}</p><p><a href="${escapeHtml(orderLink)}" style="display:inline-block;padding:12px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:7px;font-weight:600">Voir ma commande</a></p>${isGuest ? `<p>${safeLinks.map((link) => `<a href="${link}" style="color:#16a34a">Ouvrir la livraison sécurisée</a>`).join("<br>")}</p>` : ""}</div>`;
  return {
    to: job.recipient_email,
    subject: `Votre livraison numérique Edigiya — ${context.orderNumber}`,
    html,
    text: textLines.join("\n"),
  };
}

async function buildGuestLinks(job: any): Promise<string[]> {
  if (job.email_type !== "guest_digital_delivery") return [];
  const siteUrl = required("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  const token = guestTokenFor(job.outbox_id, job.order_id);
  const grant = await repo.createGuestDigitalDeliveryGrant({
    orderId: job.order_id,
    token,
    expiresAt: new Date(Date.now() + GUEST_GRANT_TTL_MS).toISOString(),
    idempotencyKey: `email:${job.outbox_id}:${job.order_id}`,
    actorId: "email_worker",
  });
  return [
    `${siteUrl}/digital-delivery#token=${encodeURIComponent(grant.token)}`,
  ];
}

function retryAt(attemptCount: number): string {
  const delayMs = Math.min(
    60 * 60 * 1000,
    15 * 60 * 1000 * 2 ** Math.max(0, attemptCount - 1),
  );
  return new Date(Date.now() + delayMs).toISOString();
}

export async function processOneDigitalEmailJob(
  workerId = `worker:${randomUUID()}`,
) {
  const job = await repo.claimDigitalEmailOutboxJob(workerId, 300);
  if (!job) return { processed: false } as const;
  try {
    if (job.attempt_count >= MAX_ATTEMPTS) {
      await repo.markDigitalEmailOutboxFailed(
        job.outbox_id,
        job.lease_token,
        "EMAIL_MAX_ATTEMPTS_REACHED",
        new Date("9999-12-31T23:59:59.000Z").toISOString(),
      );
      return { processed: true, sent: false, exhausted: true } as const;
    }
    const guestLinks = await buildGuestLinks(job);
    await getDigitalEmailProvider().sendEmail(
      await buildMessage(job, guestLinks),
    );
    const marked = await repo.markDigitalEmailOutboxSent(
      job.outbox_id,
      job.lease_token,
    );
    return { processed: true, sent: marked } as const;
  } catch (error) {
    const safeError =
      error instanceof Error &&
      error.message === "EMAIL_PROVIDER_NOT_CONFIGURED"
        ? "EMAIL_PROVIDER_NOT_CONFIGURED"
        : "EMAIL_DELIVERY_FAILED";
    await repo.markDigitalEmailOutboxFailed(
      job.outbox_id,
      job.lease_token,
      safeError,
      retryAt(job.attempt_count),
    );
    return { processed: true, sent: false, error: safeError } as const;
  }
}
