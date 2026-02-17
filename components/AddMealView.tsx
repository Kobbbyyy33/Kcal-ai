"use client";

import * as React from "react";
import { Heart, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PhotoUploader } from "@/components/PhotoUploader";
import { DraftMealEditor, type DraftMeal } from "@/components/DraftMealEditor";
import { ManualEntry } from "@/components/ManualEntry";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { loadPreferences } from "@/lib/preferences";
import type { MealType } from "@/types";

type Method = "photo" | "barcode" | "manual";

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

export function AddMealView() {
  const searchParams = useSearchParams();
  const initialMealType = (searchParams.get("meal_type") as MealType | null) ?? "lunch";
  const quick = searchParams.get("quick");

  const [method, setMethod] = React.useState<Method>(quick === "manual" ? "manual" : "photo");
  const [draft, setDraft] = React.useState<DraftMeal | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  const [barcode, setBarcode] = React.useState("");
  const [product, setProduct] = React.useState<OffProduct | null>(null);
  const [defaultPortion, setDefaultPortion] = React.useState(100);
  const [grams, setGrams] = React.useState(100);
  const [loadingBarcode, setLoadingBarcode] = React.useState(false);
  const [recentScans, setRecentScans] = React.useState<StoredProduct[]>([]);
  const [favorites, setFavorites] = React.useState<StoredProduct[]>([]);

  const isFavorite = React.useMemo(
    () => (barcode ? favorites.some((x) => x.barcode === barcode) : false),
    [favorites, barcode]
  );

  async function loadByBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoadingBarcode(true);
    setProduct(null);
    setDraft(null);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(trimmed)}.json`);
      const json = await res.json();
      if (!json || json.status !== 1 || !json.product) {
        throw new Error("Produit non trouve. Utilise la saisie manuelle ci-dessous.");
      }
      setBarcode(trimmed);
      const p = json.product as OffProduct;
      setProduct(p);
      setGrams(defaultPortion);
      const item = { barcode: trimmed, name: p.product_name ?? `Produit ${trimmed}`, image_url: p.image_url ?? null };
      const nextRecent = [item, ...recentScans.filter((x) => x.barcode !== trimmed)].slice(0, 8);
      setRecentScans(nextRecent);
      saveStored(RECENT_KEY, nextRecent);
    } catch (err) {
      setBarcode(trimmed);
      setProduct(null);
      toast.error(err instanceof Error ? err.message : "Erreur Open Food Facts");
    } finally {
      setLoadingBarcode(false);
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

  const per100 = product ? macrosPer100g(product) : null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-[#dbeafe] p-0 dark:border-slate-700">
        <div className="grid sm:grid-cols-[1.1fr_1fr]">
          <div className="p-5">
            <div className="text-lg font-semibold">Compose ton repas</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Photo IA, scan code-barres ou saisie manuelle. Tu gardes la main avant sauvegarde.</div>
          </div>
          <div className="min-h-[150px] bg-slate-100 dark:bg-slate-900">
            <img src="/illustrations/food-hero.svg" alt="Illustration repas" className="h-full w-full object-cover" />
          </div>
        </div>
      </Card>

      <Card className="border-[#dcfce7] p-4 dark:border-slate-700">
        <div className="text-sm font-semibold">Methode</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            ["photo", "Photo IA"],
            ["barcode", "Code-barres"],
            ["manual", "Manuel"]
          ] as const).map(([k, label]) => (
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
                "tab-pill min-h-[44px] px-4 py-3 text-sm font-semibold",
                method === k
                  ? "tab-pill-active"
                  : "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
          <Card className="border-[#fed7aa] p-4 dark:border-slate-700">
            <div className="text-sm font-semibold">Scanner ou saisir un code</div>
            <div className="mt-3">
              <BarcodeScanner
                onDetected={(code) => {
                  setBarcode(code);
                  loadByBarcode(code);
                }}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Ex: 3017620422003"
              />
              <Button className="w-full sm:w-auto" loading={loadingBarcode} onClick={() => loadByBarcode(barcode)}>
                Chercher
              </Button>
            </div>

            {(favorites.length > 0 || recentScans.length > 0) && (
              <div className="mt-4 space-y-2">
                {favorites.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <Heart className="h-3.5 w-3.5 text-rose-500" /> Favoris
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {favorites.slice(0, 5).map((x) => (
                        <button
                          key={`f-${x.barcode}`}
                          className="chip chip-info"
                          onClick={() => {
                            setBarcode(x.barcode);
                            loadByBarcode(x.barcode);
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
                    <div className="mb-1 text-xs font-semibold text-slate-500">Recents</div>
                    <div className="flex flex-wrap gap-2">
                      {recentScans.slice(0, 6).map((x) => (
                        <button
                          key={`r-${x.barcode}`}
                          className="chip chip-info"
                          onClick={() => {
                            setBarcode(x.barcode);
                            loadByBarcode(x.barcode);
                          }}
                        >
                          {x.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {product ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={product.image_url ?? "/icons/scan-food.svg"}
                      alt={product.product_name ?? "Produit"}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                    <div>
                      <div className="text-sm font-semibold">{product.product_name ?? "Produit"}</div>
                      <div className="text-xs text-slate-500">{product.brands ?? "Open Food Facts"}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-slate-100 p-2 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                    onClick={() => {
                      const item = {
                        barcode,
                        name: product.product_name ?? `Produit ${barcode}`,
                        image_url: product.image_url ?? null
                      };
                      const exists = favorites.some((x) => x.barcode === barcode);
                      const next = exists ? favorites.filter((x) => x.barcode !== barcode) : [item, ...favorites].slice(0, 12);
                      setFavorites(next);
                      saveStored(FAVORITE_KEY, next);
                    }}
                  >
                    <Star className={`h-4 w-4 ${isFavorite ? "fill-amber-400 text-amber-500" : "text-slate-500"}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3">
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

                <div className="flex flex-wrap gap-2">
                  {[50, 100, 150, 200].map((g) => (
                    <button
                      key={g}
                      type="button"
                      className="chip chip-info"
                      onClick={() => setGrams(g)}
                    >
                      {g}g
                    </button>
                  ))}
                </div>

                {per100 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-600 dark:text-slate-400">Si le produit n'est pas trouve, utilise la saisie manuelle juste en dessous.</div>
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
