"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PhotoUploader } from "@/components/PhotoUploader";
import { DraftMealEditor, type DraftMeal } from "@/components/DraftMealEditor";
import { ManualEntry } from "@/components/ManualEntry";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { MealType } from "@/types";

type Method = "photo" | "barcode" | "manual";

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

export function AddMealView() {
  const searchParams = useSearchParams();
  const initialMealType = (searchParams.get("meal_type") as MealType | null) ?? "lunch";

  const [method, setMethod] = React.useState<Method>("photo");
  const [draft, setDraft] = React.useState<DraftMeal | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  const [barcode, setBarcode] = React.useState("");
  const [product, setProduct] = React.useState<OffProduct | null>(null);
  const [grams, setGrams] = React.useState(100);
  const [loadingBarcode, setLoadingBarcode] = React.useState(false);

  async function loadByBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoadingBarcode(true);
    setProduct(null);
    setDraft(null);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(trimmed)}.json`
      );
      const json = await res.json();
      if (!json || json.status !== 1 || !json.product) {
        throw new Error("Produit non trouve. Utilise la saisie manuelle ci-dessous.");
      }
      setBarcode(trimmed);
      setProduct(json.product as OffProduct);
      setGrams(100);
    } catch (err) {
      setBarcode(trimmed);
      setProduct(null);
      toast.error(err instanceof Error ? err.message : "Erreur Open Food Facts");
    } finally {
      setLoadingBarcode(false);
    }
  }

  React.useEffect(() => {
    if (method !== "barcode") return;
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
  }, [method, product, grams, barcode]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="grid sm:grid-cols-[1.1fr_1fr]">
          <div className="p-5">
            <div className="text-lg font-semibold">Compose ton repas</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Photo IA, scan code-barres ou saisie manuelle. Tu gardes la main avant sauvegarde.
            </div>
          </div>
          <div className="min-h-[150px] bg-slate-100 dark:bg-slate-900">
            <img src="/illustrations/food-hero.svg" alt="Illustration repas" className="h-full w-full object-cover" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold">Methode</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ["photo", "Photo IA"],
              ["barcode", "Code-barres"],
              ["manual", "Manuel"]
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setMethod(k);
                setDraft(null);
                setImageUrl(null);
                setProduct(null);
                setBarcode("");
              }}
              className={[
                "min-h-[44px] rounded-full border px-4 py-3 text-sm font-semibold transition-colors",
                method === k
                  ? "border-primary bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {method === "photo" ? (
        <>
          <PhotoUploader
            onAnalyzed={(d, url) => {
              setDraft(d);
              setImageUrl(url);
            }}
          />
          <DraftMealEditor
            initialMealType={initialMealType}
            draft={draft}
            imageUrl={imageUrl}
            onSaved={() => {
              setDraft(null);
              setImageUrl(null);
            }}
          />
        </>
      ) : null}

      {method === "barcode" ? (
        <>
          <Card className="p-4">
            <div className="text-sm font-semibold">Scanner ou saisir un code</div>
            <div className="mt-3">
              <BarcodeScanner
                onDetected={(code) => {
                  setBarcode(code);
                  loadByBarcode(code);
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
              <Button loading={loadingBarcode} onClick={() => loadByBarcode(barcode)}>
                Chercher
              </Button>
            </div>
            {product ? (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">{product.product_name ?? "Produit"}</div>
                <div className="flex items-center gap-3">
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
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-600 dark:text-slate-400">
                Si le produit n'est pas trouve, utilise la saisie manuelle juste en dessous.
              </div>
            )}
          </Card>

          <ManualEntry onDraft={(d) => setDraft(d)} />
          <DraftMealEditor
            initialMealType={initialMealType}
            draft={draft}
            imageUrl={product?.image_url ?? null}
            onSaved={() => {
              setDraft(null);
              setImageUrl(null);
              setProduct(null);
              setBarcode("");
            }}
          />
        </>
      ) : null}

      {method === "manual" ? (
        <>
          <ManualEntry onDraft={(d) => setDraft(d)} />
          <DraftMealEditor
            initialMealType={initialMealType}
            draft={draft}
            onSaved={() => {
              setDraft(null);
              setImageUrl(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
