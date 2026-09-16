"use client";

import { useMemo } from "react";
import type { ProductVariant } from "@/lib/data";

type Props = {
  variants: ProductVariant[];
  selectedId: string;
  onChange: (id: string) => void;
};

const labels: Record<string, string> = {
  screens: "Nombre d’écrans",
  duration: "Durée",
  payment: "Mode de paiement",
  package: "Formule",
  formule: "Formule",
};

export function PricingSelector({ variants, selectedId, onChange }: Props) {
  const groups = useMemo(() => {
    const values = new Map<string, Set<string>>();
    for (const variant of variants) {
      const structured =
        (variant as ProductVariant & { optionValues?: Record<string, string> })
          .optionValues || {};
      const fallback = variant.name.split(" · ");
      const entries = Object.keys(structured).length
        ? Object.entries(structured)
        : ([["formule", variant.name]] as Array<[string, string]>);
      for (const [key, value] of entries) {
        if (!values.has(key)) values.set(key, new Set());
        values.get(key)?.add(value);
      }
      if (!entries.length && fallback.length)
        values.set("formule", new Set([variant.name]));
    }
    return [...values.entries()];
  }, [variants]);

  return (
    <div className="mt-6 space-y-5">
      {groups.map(([key, options]) => (
        <fieldset key={key}>
          <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {labels[key] || key}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...options].map((option) => {
              const variant = variants.find(
                (candidate) =>
                  ((
                    candidate as ProductVariant & {
                      optionValues?: Record<string, string>;
                    }
                  ).optionValues || {})[key] === option,
              );
              const active = variant?.id === selectedId;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => variant && onChange(variant.id)}
                  className={`border px-3 py-2 text-sm ${active ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground">
        Les prix sont gérés par Edigiya et affichés selon la combinaison
        sélectionnée.
      </p>
    </div>
  );
}
