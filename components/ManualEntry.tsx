"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DraftMeal } from "@/components/DraftMealEditor";

type SearchTag = "high_protein" | "low_kcal" | "post_workout";

type SearchItem = {
  id: string;
  name: string;
  image_url: string | null;
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  tags?: SearchTag[];
};

function n(v: unknown): number | null {
  const num = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(num) ? num : null;
}

export function ManualEntry({ onDraft }: { onDraft: (draft: DraftMeal) => void }) {
  const [tag, setTag] = React.useState<"" | SearchTag>("");
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<SearchItem | null>(null);
  const [grams, setGrams] = React.useState(100);

  const [manualName, setManualName] = React.useState("");
  const [manualQty, setManualQty] = React.useState("100g");
  const [manualKcal, setManualKcal] = React.useState(0);
  const [manualP, setManualP] = React.useState(0);
  const [manualC, setManualC] = React.useState(0);
  const [manualF, setManualF] = React.useState(0);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search-food?q=${encodeURIComponent(query.trim())}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`
      );
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { items: SearchItem[] };
      setResults(json.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur recherche");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!selected) return;
    const factor = grams / 100;
    const calories = (selected.kcal_100g ?? 0) * factor;
    const protein = (selected.protein_100g ?? 0) * factor;
    const carbs = (selected.carbs_100g ?? 0) * factor;
    const fat = (selected.fat_100g ?? 0) * factor;

    onDraft({
      meal_name: selected.name,
      items: [
        {
          name: selected.name,
          quantity: `${grams}g`,
          calories,
          protein,
          carbs,
          fat,
          image_url: selected.image_url ?? undefined,
          source: "manual"
        }
      ]
    });
  }, [selected, grams, onDraft]);

  return (
    <div className="space-y-4">
      <Card className="border-[#e0e7ff] p-4 dark:border-slate-700">
        <div className="text-sm font-semibold">Recherche Open Food Facts</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
            placeholder="Ex: yaourt grec, jambon, muesli..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
          />
          <Button className="w-full sm:w-auto" loading={loading} onClick={search}>
            Chercher
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["", "Tous"],
              ["high_protein", "Riche en prot"],
              ["low_kcal", "Low kcal"],
              ["post_workout", "Post-workout"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              className={[
                "tab-pill px-3 py-1.5 text-xs",
                tag === value
                  ? "tab-pill-active"
                  : "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              ].join(" ")}
              onClick={() => setTag(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {results.length > 0 ? (
          <div className="mt-4 space-y-2">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className={[
                  "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  selected?.id === r.id
                    ? "state-success"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                ].join(" ")}
                onClick={() => {
                  setSelected(r);
                  setGrams(100);
                }}
              >
                <div className="font-medium">{r.name}</div>
                <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                  {r.kcal_100g != null ? `${Math.round(r.kcal_100g)} kcal/100g` : "kcal inconnues"} | P {r.protein_100g ?? 0} | G {r.carbs_100g ?? 0} | L {r.fat_100g ?? 0}
                </div>
                {r.tags && r.tags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="chip chip-info text-[10px]">
                        {t === "high_protein" ? "Riche prot" : t === "low_kcal" ? "Low kcal" : "Post-workout"}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {selected ? (
          <div className="mt-4">
            <div className="text-sm font-semibold">Quantite</div>
            <div className="mt-2 flex items-center gap-3">
              <input className="w-full" type="range" min={1} max={600} value={grams} onChange={(e) => setGrams(Number(e.target.value))} />
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
        ) : null}
      </Card>

      <Card className="border-[#fef3c7] p-4 dark:border-slate-700">
        <div className="text-sm font-semibold">Saisie manuelle</div>
        <div className="mt-1 text-sm text-gray-600 dark:text-slate-400">Utilise cette option si le produit est introuvable ou incomplet.</div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Nom</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Ex: Banane"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Quantite</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              value={manualQty}
              onChange={(e) => setManualQty(e.target.value)}
              placeholder="Ex: 120g"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["kcal", manualKcal, setManualKcal],
              ["prot", manualP, setManualP],
              ["gluc", manualC, setManualC],
              ["lip", manualF, setManualF]
            ] as const
          ).map(([label, val, setVal]) => (
            <label key={label} className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">{label}</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={val}
                onChange={(e) => setVal(n(e.target.value) ?? 0)}
              />
            </label>
          ))}
        </div>

        <div className="mt-4">
          <Button
            className="w-full"
            onClick={() => {
              if (!manualName.trim()) {
                toast.error("Nom requis");
                return;
              }
              onDraft({
                meal_name: manualName.trim(),
                items: [
                  {
                    name: manualName.trim(),
                    quantity: manualQty,
                    calories: manualKcal,
                    protein: manualP,
                    carbs: manualC,
                    fat: manualF,
                    source: "manual"
                  }
                ]
              });
              toast.success("Pre-rempli");
            }}
          >
            Utiliser cette saisie
          </Button>
        </div>
      </Card>
    </div>
  );
}
