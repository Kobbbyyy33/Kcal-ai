"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ManualEntry } from "@/components/ManualEntry";
import { DraftMealEditor, type DraftMeal } from "@/components/DraftMealEditor";
import type { MealType } from "@/types";

type OffProduct = {
  product_name?: string;
  image_url?: string;
  nutriments?: Record<string, number | string | undefined>;
};

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return n;
}

function macrosPer100g(product: OffProduct) {
  const n = product.nutriments ?? {};
  const kcal =
    toNum(n["energy-kcal_100g"]) ??
    (toNum(n["energy_100g"]) != null ? (toNum(n["energy_100g"]) as number) / 4.184 : null) ??
    0;
  const protein = toNum(n["proteins_100g"]) ?? 0;
  const carbs = toNum(n["carbohydrates_100g"]) ?? 0;
  const fat = toNum(n["fat_100g"]) ?? 0;
  return { kcal, protein, carbs, fat };
}

export function ScanView() {
  const [barcode, setBarcode] = React.useState<string>("");
  const [product, setProduct] = React.useState<OffProduct | null>(null);
  const [grams, setGrams] = React.useState(100);
  const [loadingProduct, setLoadingProduct] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftMeal | null>(null);

  async function fetchProduct(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoadingProduct(true);
    setProduct(null);
    setDraft(null);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(trimmed)}.json`
      );
      const json = await res.json();
      if (!json || json.status !== 1 || !json.product) {
        throw new Error("Produit non trouve. Utilise la saisie manuelle.");
      }
      setBarcode(trimmed);
      setProduct(json.product as OffProduct);
      setGrams(100);
    } catch (err) {
      setBarcode(trimmed);
      setProduct(null);
      toast.error(err instanceof Error ? err.message : "Erreur Open Food Facts");
    } finally {
      setLoadingProduct(false);
    }
  }

  React.useEffect(() => {
    if (!product) return;
    const per = macrosPer100g(product);
    const factor = grams / 100;
    setDraft({
      meal_name: product.product_name ?? "Produit scanne",
      items: [
        {
          name: product.product_name ?? (barcode ? `Produit ${barcode}` : "Produit"),
          quantity: `${grams}g`,
          calories: per.kcal * factor,
          protein: per.protein * factor,
          carbs: per.carbs * factor,
          fat: per.fat * factor,
          barcode,
          image_url: product.image_url,
          source: "barcode"
        }
      ]
    });
  }, [product, barcode, grams]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="grid sm:grid-cols-[1.1fr_1fr]">
          <div className="p-5">
            <div className="text-lg font-semibold">Scan intelligent</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Scanne rapidement un produit, ajuste les grammes et ajoute-le au journal.
            </div>
          </div>
          <div className="min-h-[150px] bg-slate-100 dark:bg-slate-900">
            <img src="/illustrations/delivery-hero.svg" alt="Illustration scan" className="h-full w-full object-cover" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold">Scanner</div>
        <div className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Detecte automatiquement un code-barres ou saisis un code manuellement.
        </div>
        <div className="mt-3">
          <BarcodeScanner
            onDetected={(code) => {
              setBarcode(code);
              fetchProduct(code);
            }}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Ex: 3017620422003"
          />
          <Button loading={loadingProduct} onClick={() => fetchProduct(barcode)}>
            Chercher
          </Button>
        </div>
      </Card>

      {product ? (
        <Card className="p-4">
          <div className="text-sm font-semibold">{product.product_name ?? "Produit"}</div>
          <div className="mt-3 flex items-center gap-3">
            <input
              className="w-full"
              type="range"
              min={1}
              max={600}
              value={grams}
              onChange={(e) => setGrams(Number(e.target.value))}
            />
            <input
              className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              type="number"
              min={1}
              max={2000}
              value={grams}
              onChange={(e) => setGrams(Number(e.target.value))}
            />
            <span className="text-sm text-gray-600 dark:text-slate-400">g</span>
          </div>
          <div className="mt-3 text-xs text-gray-600 dark:text-slate-400">
            Les nutriments manquants dans Open Food Facts sont consideres a 0.
          </div>
        </Card>
      ) : null}

      <ManualEntry onDraft={(d) => setDraft(d)} />

      <DraftMealEditor
        initialMealType={"lunch" as MealType}
        draft={draft}
        imageUrl={product?.image_url ?? null}
        onSaved={() => {
          setBarcode("");
          setProduct(null);
          setDraft(null);
        }}
      />
    </div>
  );
}
