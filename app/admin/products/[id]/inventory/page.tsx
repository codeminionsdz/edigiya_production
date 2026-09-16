"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  adminCreateDigitalInventoryUnit,
  adminGetDigitalInventory,
  adminGetProductById,
  adminRotateDigitalInventoryUnitSecret,
  adminSetDigitalInventoryUnitStatus,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statuses = [
  "available",
  "reserved",
  "allocated",
  "consumed",
  "sold",
  "disabled",
  "revoked",
];
function newKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function DigitalInventoryPage() {
  const { id } = useParams<{ id: string }>();
  const productId = String(id || "");
  const [product, setProduct] = useState<any>(null);
  const [data, setData] = useState<any>({
    units: [],
    allocations: [],
    counts: {},
  });
  const [unitType, setUnitType] = useState<"credential" | "code">("credential");
  const variantId = "none";
  const setVariantId = (_value: string) => {};
  const [secret, setSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rotationUnit, setRotationUnit] = useState<string | null>(null);
  const [rotationSecret, setRotationSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const createKeyRef = useRef<string | null>(null);
  const rotationKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [productResult, inventoryResult] = await Promise.all([
      adminGetProductById(productId),
      adminGetDigitalInventory(productId),
    ]);
    if (!("error" in productResult)) setProduct(productResult);
    if (!("error" in inventoryResult)) setData(inventoryResult);
  }, [productId]);
  useEffect(() => {
    void load();
  }, [load]);

  const variants = useMemo(
    () => product?.product_variants || product?.variants || [],
    [product],
  );
  async function createUnit() {
    setBusy(true);
    setMessage("");
    if (false && variants.length > 0 && variantId === "none") {
      setBusy(false);
      setMessage("Sélectionnez une formule exacte pour ce produit.");
      return;
    }
    createKeyRef.current ||= newKey();
    const value =
      unitType === "credential"
        ? `Username: ${username.trim()}\nPassword: ${password}`
        : secret;
    const result = await adminCreateDigitalInventoryUnit({
      productId: productId,
      variantId: null,
      unitType,
      secret: value,
      idempotencyKey: createKeyRef.current,
    });
    setBusy(false);
    if ("error" in result && typeof result.error === "string") {
      setMessage(result.error);
      return;
    }
    createKeyRef.current = null;
    setSecret("");
    setUsername("");
    setPassword("");
    setMessage("Unité créée. Le secret ne sera plus affiché.");
    await load();
  }
  async function changeStatus(unitId: string, status: "disabled" | "revoked") {
    setBusy(true);
    const result = await adminSetDigitalInventoryUnitStatus(unitId, status);
    setBusy(false);
    setMessage(
      "error" in result && typeof result.error === "string"
        ? result.error
        : "Statut mis à jour.",
    );
    await load();
  }
  async function rotate() {
    if (!rotationUnit || !rotationSecret) return;
    rotationKeyRef.current ||= newKey();
    setBusy(true);
    const result = await adminRotateDigitalInventoryUnitSecret({
      unitId: rotationUnit,
      secret: rotationSecret,
      idempotencyKey: rotationKeyRef.current,
    });
    setBusy(false);
    if ("error" in result && typeof result.error === "string") {
      rotationKeyRef.current = null;
      setMessage(result.error);
      return;
    }
    rotationKeyRef.current = null;
    setMessage("Secret remplacé. La version précédente reste masquée.");
    setRotationSecret("");
    setRotationUnit(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">
            Produit / Opérations sécurisées
          </p>
          <h1 className="text-2xl font-bold">
            Inventaire numérique — {product?.title_fr || "…"}
          </h1>
        </div>
      </div>
      {message && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statuses.map((status) => (
          <Card key={status}>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">
                {status}
              </p>
              <p className="text-2xl font-semibold">
                {data.counts?.[status] || 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Ajouter une unité
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Type</Label>
            <Select
              value={unitType}
              onValueChange={(v) => setUnitType(v as "credential" | "code")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credential">Credential</SelectItem>
                <SelectItem value="code">Code</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {false && (
            <div>
              <Label>Formule / package (optionnel)</Label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Produit sans formule</SelectItem>
                  {variants.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {Object.values(v.option_values || {}).join(" · ") ||
                        v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {unitType === "credential" ? (
            <>
              <div>
                <Label>Identifiant / e-mail</Label>
                <Input
                  value={username}
                  autoComplete="off"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex. compte@exemple.com"
                />
              </div>
              <div>
                <Label>Mot de passe</Label>
                <Input
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Saisi une seule fois"
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <Label>Code — saisi une seule fois</Label>
              <Input
                type="password"
                value={secret}
                autoComplete="new-password"
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Non affiché après enregistrement"
              />
            </div>
          )}
          <div className="md:col-span-4">
            <Button
              disabled={
                busy ||
                (unitType === "credential"
                  ? !username.trim() || !password
                  : !secret)
              }
              onClick={createUnit}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Créer via Vault sécurisé
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Les secrets ne sont jamais affichés dans la liste et ne sont pas
              conservés dans le navigateur.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Unités et historique d’allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.units.map((unit: any) => (
              <div
                key={unit.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">
                    {unit.unit_type} · version {unit.secret_version}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {unit.status} ·{" "}
                    {new Date(unit.created_at).toLocaleString("fr-DZ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {unit.status === "available" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => changeStatus(unit.id, "disabled")}
                      >
                        Désactiver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => changeStatus(unit.id, "revoked")}
                      >
                        Révoquer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRotationUnit(unit.id)}
                      >
                        Remplacer le secret
                      </Button>
                    </>
                  )}
                </div>
                {rotationUnit === unit.id && (
                  <div className="flex w-full gap-2">
                    <Input
                      type="password"
                      value={rotationSecret}
                      onChange={(e) => setRotationSecret(e.target.value)}
                      placeholder="Nouveau secret, non affiché"
                    />
                    <Button disabled={busy || !rotationSecret} onClick={rotate}>
                      Confirmer
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {data.units.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune unité numérique. أضف الوحدات بعد إنشاء المنتج.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
