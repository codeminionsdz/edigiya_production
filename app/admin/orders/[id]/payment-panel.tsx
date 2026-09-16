"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  adminGetPaymentProofUrl,
  adminRejectPayment,
  adminRetryDigitalDeliveryEmail,
  adminVerifyPayment,
} from "@/app/admin/actions";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  verification_required: "Vérification requise",
  paid: "Payé",
  failed: "Échec",
  rejected: "Rejeté",
  cancelled: "Annulé",
};
const statusClasses: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  verification_required: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};
const methodLabels: Record<string, string> = {
  flexy: "Flexy",
  ccp: "CCP",
  bank_transfer: "Virement bancaire",
  slickpay: "SlickPay",
  cod: "Paiement à la réception",
  cib: "CIB",
  edahabia: "Edahabia",
  bank: "Banque",
};

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString("fr-DZ") : "—";
}
function price(value: unknown) {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function PaymentPanel({
  orderId,
  payment,
}: {
  orderId: string;
  payment?: any;
}) {
  const [busy, setBusy] = useState<
    "verify" | "reject" | "proof" | "email" | null
  >(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const events = Array.isArray(payment?.payment_events)
    ? payment.payment_events
    : [];
  const reviewable = ["pending", "verification_required"].includes(
    payment?.status,
  );

  async function verify() {
    if (!payment || busy) return;
    setBusy("verify");
    const result = await adminVerifyPayment(payment.id);
    setBusy(null);
    if (!result.success) window.alert(result.error);
    else window.location.reload();
  }
  async function reject() {
    if (!payment || busy || !reason.trim()) return;
    setBusy("reject");
    const result = await adminRejectPayment(payment.id, reason);
    setBusy(null);
    if (!result.success) window.alert(result.error);
    else {
      setRejectOpen(false);
      window.location.reload();
    }
  }
  async function openProof() {
    if (!payment || busy) return;
    setBusy("proof");
    const result = await adminGetPaymentProofUrl(payment.id, orderId);
    setBusy(null);
    if (!result.success || !result.url)
      window.alert(result.error || "Le justificatif n’est plus disponible.");
    else window.open(result.url, "_blank", "noopener,noreferrer");
  }
  async function retryEmail() {
    if (!payment || busy) return;
    setBusy("email");
    const result = await adminRetryDigitalDeliveryEmail(orderId);
    setBusy(null);
    if (!result.success) window.alert(result.error);
    else
      window.alert(
        result.email?.sent
          ? "Email envoyé."
          : `Email non envoyé: ${result.email?.error || "en attente"}`,
      );
  }

  if (!payment)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paiement</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aucun paiement associé à cette commande.
        </CardContent>
      </Card>
    );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Paiement</CardTitle>
          <Badge
            className={statusClasses[payment.status] || statusClasses.pending}
          >
            {statusLabels[payment.status] || payment.status || "Inconnu"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Méthode
              </p>
              <p className="font-semibold">
                {methodLabels[payment.method] || payment.method || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Montant
              </p>
              <p className="font-semibold">{price(payment.amount_dzd)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Créé le
              </p>
              <p className="text-sm">{date(payment.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Vérifié le
              </p>
              <p className="text-sm">{date(payment.verified_at)}</p>
            </div>
          </div>

          {payment.proof_object_path && (
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">
                Justificatif de paiement
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={openProof}
                disabled={busy !== null}
              >
                <ExternalLink className="h-4 w-4" />
                {busy === "proof" ? "Ouverture…" : "Voir le justificatif"}
              </Button>
            </div>
          )}
          {payment.status === "rejected" && payment.failure_reason && (
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">
                Motif du rejet
              </p>
              <p className="mt-1 text-sm">{payment.failure_reason}</p>
            </div>
          )}
          {payment.status === "paid" && (
            <div className="border-t pt-4">
              <Button
                variant="outline"
                onClick={retryEmail}
                disabled={busy !== null}
              >
                {busy === "email" ? "Envoi…" : "Renvoyer le produit par email"}
              </Button>
            </div>
          )}
          {reviewable && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={verify} disabled={busy !== null}>
                <Check className="h-4 w-4" />
                {busy === "verify" ? "Vérification…" : "Vérifier le paiement"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setRejectOpen(true)}
                disabled={busy !== null}
              >
                <X className="h-4 w-4" />
                Rejeter le paiement
              </Button>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Historique du paiement</p>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun événement disponible.
              </p>
            ) : (
              <div className="space-y-3">
                {events.map((event: any) => (
                  <div key={event.id} className="flex gap-3 text-sm">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">
                        {(
                          {
                            payment_created: "Paiement créé",
                            proof_uploaded: "Justificatif envoyé",
                            verification_required: "Vérification requise",
                            payment_verified: "Paiement vérifié",
                            payment_rejected: "Paiement rejeté",
                          } as Record<string, string>
                        )[event.event_type] || event.event_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {date(event.created_at)}
                        {event.metadata?.note
                          ? ` — ${event.metadata.note}`
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le paiement</DialogTitle>
            <DialogDescription>
              Indiquez la raison qui sera conservée dans l’historique.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motif du rejet…"
            className="min-h-28"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={busy !== null}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={reject}
              disabled={!reason.trim() || busy !== null}
            >
              {busy === "reject" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Rejeter le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
