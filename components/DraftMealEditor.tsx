"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { enqueueOfflineMeal } from "@/lib/offlineQueue";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useStore } from "@/lib/store/useStore";
import type { MealType } from "@/types";

export type DraftItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode?: string;
  image_url?: string;
  source: "ai" | "barcode" | "manual";
};

export type DraftMeal = {
  meal_name: string;
  items: DraftItem[];
  confidence?: "high" | "medium" | "low";
};

function totals(items: DraftItem[]) {
  return items.reduce(
    (acc, it) => {
      acc.calories += Number(it.calories) || 0;
      acc.protein += Number(it.protein) || 0;
      acc.carbs += Number(it.carbs) || 0;
      acc.fat += Number(it.fat) || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function DraftMealEditor({
  initialMealType,
  draft,
  imageUrl,
  onSaved
}: {
  initialMealType: MealType;
  draft: DraftMeal | null;
  imageUrl?: string | null;
  onSaved?: () => void;
}) {
  const selectedDate = useStore((s) => s.selectedDate);

  const [mealType, setMealType] = React.useState<MealType>(initialMealType);
  const [mealName, setMealName] = React.useState("");
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!draft) return;
    setMealName(draft.meal_name ?? "");
    setItems(
      draft.items.map((it) => ({
        ...it,
        quantity: it.quantity ?? "",
        calories: Number(it.calories) || 0,
        protein: Number(it.protein) || 0,
        carbs: Number(it.carbs) || 0,
        fat: Number(it.fat) || 0,
        image_url: it.image_url ?? imageUrl ?? undefined
      }))
    );
  }, [draft, imageUrl]);

  const sum = totals(items);

  async function saveMeal(payload: {
    date: string;
    meal_type: MealType;
    meal_name: string;
    items: DraftItem[];
    image_url?: string | null;
  }) {
    const supabase = supabaseBrowser();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Non connecte");

    await supabase.from("profiles").upsert({ id: user.id, email: user.email ?? null }).throwOnError();

    const mealInsert = await supabase
      .from("meals")
      .insert({
        user_id: user.id,
        date: payload.date,
        meal_type: payload.meal_type,
        meal_name: payload.meal_name
      })
      .select("*")
      .single();

    if (mealInsert.error) throw mealInsert.error;

    const mealId = mealInsert.data.id as string;
    const foodPayload = payload.items.map((it) => ({
      meal_id: mealId,
      name: it.name,
      quantity: it.quantity,
      calories: it.calories,
      protein: it.protein,
      carbs: it.carbs,
      fat: it.fat,
      barcode: it.barcode ?? null,
      image_url: it.image_url ?? payload.image_url ?? null,
      source: it.source
    }));

    if (foodPayload.length > 0) {
      const { error } = await supabase.from("food_items").insert(foodPayload);
      if (error) throw error;
    }
  }

  if (!draft) return null;

  return (
    <div className="space-y-4">
      <Card className="border-[#bbf7d0] p-4 dark:border-slate-700">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["breakfast", "Petit dej"],
              ["lunch", "Dejeuner"],
              ["dinner", "Diner"],
              ["snack", "Snack"]
            ] as Array<[MealType, string]>
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setMealType(t)}
              className={[
                "tab-pill min-h-[44px] px-3 py-2 text-sm font-semibold",
                t === mealType
                  ? "tab-pill-active"
                  : "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Nom</span>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="Nom du repas"
          />
        </label>

        <div className="mt-4 text-sm text-gray-600 dark:text-slate-400">
          Total: {Math.round(sum.calories)} kcal • P {Math.round(sum.protein)} • G {Math.round(sum.carbs)} • L {Math.round(sum.fat)}
          {draft.confidence ? ` • Confiance: ${draft.confidence}` : ""}
        </div>
      </Card>

      <div className="space-y-3">
        {items.map((it, idx) => (
          <Card key={`${it.name}-${idx}`} className="border-[#dcfce7] p-4 dark:border-slate-700">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Aliment</span>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                  value={it.name}
                  onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))}
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Quantite</span>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                  value={it.quantity}
                  onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: e.target.value } : p)))}
                  placeholder="150g"
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
                <label key={k} className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                    {k === "calories" ? "kcal" : k === "protein" ? "Prot" : k === "carbs" ? "Gluc" : "Lip"}
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={it[k]}
                    onChange={(e) =>
                      setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, [k]: Number(e.target.value) } : p)))
                    }
                    required={k === "calories"}
                  />
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Button
        className="w-full"
        loading={saving}
        onClick={async () => {
          setSaving(true);
          try {
            const payload = {
              date: selectedDate,
              meal_type: mealType,
              meal_name: mealName,
              items,
              image_url: imageUrl
            };

            if (typeof navigator !== "undefined" && !navigator.onLine) {
              enqueueOfflineMeal(payload);
              toast.success("Repas enregistre hors-ligne. Synchronisation auto a la reconnexion.");
              onSaved?.();
              return;
            }

            await saveMeal(payload);
            toast.success("Repas sauvegarde");
            onSaved?.();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur de sauvegarde");
          } finally {
            setSaving(false);
          }
        }}
      >
        Sauvegarder
      </Button>
    </div>
  );
}
