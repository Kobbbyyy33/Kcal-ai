"use client";

import * as React from "react";
import { Heart, History, Star } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ManualEntry } from "@/components/ManualEntry";
import { DraftMealEditor, type DraftMeal } from "@/components/DraftMealEditor";
import { loadPreferences } from "@/lib/preferences";
import type { MealType } from "@/types";

type OffProduct = {
  code?: string;
  product_name?: string;
  image_url?: string;
  brands?: string;
  nutriscore_grade?: string;
  nutriments?: Record<string, number | string | undefined>;
};

type StoredProduct = {
  barcode: string;
  name: string;
  image_url: string | null;
};

type CompareResponse = {
  productA: {
    name: string;
    kcal_100g: number;
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
    score: number;
  };
  productB: {
    name: string;
    kcal_100g: number;
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
    score: number;
  };
  recommendation: {
    better: "A" | "B";
    reasons: string[];
  };
};

const RECENT_KEY = "kcal-ai:recent-scans:v1";
const FAVORITE_KEY = "kcal-ai:favorite-scans:v1";

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

function readStored(key: string): StoredProduct[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as StoredProduct[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveStored(key: string, list: StoredProduct[]) {
  window.localStorage.setItem(key, JSON.stringify(list.slice(0, 12)));
}

export function ScanView() {
  const [barcode, setBarcode] = React.useState<string>("");
  const [product, setProduct] = React.useState<OffProduct | null>(null);
  const [defaultPortion, setDefaultPortion] = React.useState(100);
  const [grams, setGrams] = React.useState(100);
  const [loadingProduct, setLoadingProduct] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftMeal | null>(null);
  const [recentScans, setRecentScans] = React.useState<StoredProduct[]>([]);
  const [favorites, setFavorites] = React.useState<StoredProduct[]>([]);
  const [compareA, setCompareA] = React.useState("");
  const [compareB, setCompareB] = React.useState("");
  const [compareLoading, setCompareLoading] = React.useState(false);
  const [compare, setCompare] = React.useState<CompareResponse | null>(null);

  const isFavorite = React.useMemo(
    () => (barcode ? favorites.some((x) => x.barcode === barcode) : false),
    [favorites, barcode]
  );

  function rememberScan(item: StoredProduct) {
    const nextRecent = [item, ...recentScans.filter((x) => x.barcode !== item.barcode)].slice(0, 8);
    setRecentScans(nextRecent);
    saveStored(RECENT_KEY, nextRecent);
  }

  function toggleFavorite(item: StoredProduct) {
    const exists = favorites.some((x) => x.barcode === item.barcode);
    const next = exists ? favorites.filter((x) => x.barcode !== item.barcode) : [item, ...favorites].slice(0, 12);
    setFavorites(next);
    saveStored(FAVORITE_KEY, next);
    toast.success(exists ? "Retire des favoris" : "Ajoute aux favoris");
  }

  async function fetchProduct(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoadingProduct(true);
    setProduct(null);
    setDraft(null);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(trimmed)}.json`);
      const json = await res.json();
      if (!json || json.status !== 1 || !json.product) {
        throw new Error("Produit non trouve. Utilise la saisie manuelle.");
      }
      setBarcode(trimmed);
      const p = json.product as OffProduct;
      setProduct(p);
      setGrams(defaultPortion);
      rememberScan({
        barcode: trimmed,
        name: p.product_name ?? `Produit ${trimmed}`,
        image_url: p.image_url ?? null
      });
    } catch (err) {
      setBarcode(trimmed);
      setProduct(null);
      toast.error(err instanceof Error ? err.message : "Erreur Open Food Facts");
    } finally {
      setLoadingProduct(false);
    }
  }

  async function compareProducts() {
    if (!compareA.trim() || !compareB.trim()) return;
    setCompareLoading(true);
    setCompare(null);
    try {
      const res = await fetch("/api/food-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodeA: compareA.trim(), barcodeB: compareB.trim() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Comparaison impossible");
      setCompare(json as CompareResponse);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur comparaison");
    } finally {
      setCompareLoading(false);
    }
  }

  React.useEffect(() => {
    const prefs = loadPreferences();
    setDefaultPortion(prefs.default_portion_grams);
    setGrams(prefs.default_portion_grams);
    setRecentScans(readStored(RECENT_KEY));
    setFavorites(readStored(FAVORITE_KEY));
  }, []);

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

  const per100 = product ? macrosPer100g(product) : null;

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
        <div className="mt-1 text-sm text-gray-600 dark:text-slate-400">Detecte automatiquement un code-barres ou saisis un code manuellement.</div>
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

      <Card className="p-4">
        <div className="text-sm font-semibold">Comparateur produits A/B</div>
        <div className="mt-1 text-xs text-slate-500">Compare deux codes-barres et reco automatique.</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
            placeholder="Code A"
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
          />
          <input
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
            placeholder="Code B"
            value={compareB}
            onChange={(e) => setCompareB(e.target.value)}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Button loading={compareLoading} onClick={compareProducts}>
            Comparer
          </Button>
          {barcode ? (
            <Button variant="ghost" onClick={() => setCompareA(barcode)}>
              Utiliser code scanne en A
            </Button>
          ) : null}
        </div>
        {compare ? (
          <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
            <div>
              A: {compare.productA.name} ({compare.productA.score}/100) | B: {compare.productB.name} (
              {compare.productB.score}/100)
            </div>
            <div className="font-semibold">
              Reco: choisir {compare.recommendation.better === "A" ? "A" : "B"} ({compare.recommendation.reasons.join(", ")})
            </div>
          </div>
        ) : null}
      </Card>

      {(favorites.length > 0 || recentScans.length > 0) && (
        <Card className="p-4">
          {favorites.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Heart className="h-4 w-4 text-rose-500" />
                Favoris
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {favorites.slice(0, 6).map((x) => (
                  <button
                    key={`fav-${x.barcode}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                    onClick={() => {
                      setBarcode(x.barcode);
                      fetchProduct(x.barcode);
                    }}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {recentScans.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4 text-slate-500" />
                Recents
              </div>
              <div className="flex flex-wrap gap-2">
                {recentScans.slice(0, 8).map((x) => (
                  <button
                    key={`rec-${x.barcode}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                    onClick={() => {
                      setBarcode(x.barcode);
                      fetchProduct(x.barcode);
                    }}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {product ? (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <img
                src={product.image_url ?? "/icons/scan-food.svg"}
                alt={product.product_name ?? "Produit"}
                className="h-16 w-16 rounded-2xl object-cover"
              />
              <div>
                <div className="text-sm font-semibold">{product.product_name ?? "Produit"}</div>
                <div className="mt-1 text-xs text-slate-500">{product.brands ?? "Open Food Facts"}</div>
                {product.nutriscore_grade ? (
                  <div className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Nutri-score {String(product.nutriscore_grade).toUpperCase()}
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                toggleFavorite({
                  barcode,
                  name: product.product_name ?? `Produit ${barcode}`,
                  image_url: product.image_url ?? null
                })
              }
              className="rounded-full bg-slate-100 p-2 dark:bg-slate-800"
              aria-label="toggle favorite"
            >
              <Star className={`h-4 w-4 ${isFavorite ? "fill-amber-400 text-amber-500" : "text-slate-500"}`} />
            </button>
          </div>

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
          <div className="mt-2 flex gap-2">
            {[50, 100, 150, 200].map((g) => (
              <button
                key={g}
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs dark:border-slate-700"
                onClick={() => setGrams(g)}
              >
                {g}g
              </button>
            ))}
          </div>

          {per100 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">kcal</div>
                <div className="font-semibold">{Math.round(per100.kcal * (grams / 100))}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="flex items-center gap-1 text-slate-500">
                  <img src="/icons/protein.svg" alt="prot" className="h-4 w-4" /> Prot
                </div>
                <div className="font-semibold">{Math.round(per100.protein * (grams / 100))}g</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="flex items-center gap-1 text-slate-500">
                  <img src="/icons/carbs.svg" alt="carbs" className="h-4 w-4" /> Gluc
                </div>
                <div className="font-semibold">{Math.round(per100.carbs * (grams / 100))}g</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="flex items-center gap-1 text-slate-500">
                  <img src="/icons/fat.svg" alt="fat" className="h-4 w-4" /> Lip
                </div>
                <div className="font-semibold">{Math.round(per100.fat * (grams / 100))}g</div>
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-600 dark:text-slate-400">Les nutriments manquants Open Food Facts sont estimes a 0.</div>
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
