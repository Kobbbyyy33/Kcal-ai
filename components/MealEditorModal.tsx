"use client";

import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { MealWithItems } from "@/types";
import { supabaseBrowser } from "@/lib/supabase/client";

type EditableItem = {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function MealEditorModal({
  open,
  meal,
  onClose,
  onSaved
}: {
  open: boolean;
  meal: MealWithItems | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [mealName, setMealName] = React.useState("");
  const [items, setItems] = React.useState<EditableItem[]>([]);

  React.useEffect(() => {
    if (!meal) return;
    setMealName(meal.meal_name ?? "");
    setItems(
      meal.food_items.map((it) => ({
        id: it.id,
        name: it.name,
        quantity: it.quantity ?? "",
        calories: Number(it.calories) || 0,
        protein: Number(it.protein) || 0,
        carbs: Number(it.carbs) || 0,
        fat: Number(it.fat) || 0
      }))
    );
  }, [meal]);

  return (
    <Modal open={open} title="Éditer le repas" onClose={onClose}>
      {!meal ? null : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              const supabase = supabaseBrowser();
              const { error: mealErr } = await supabase
                .from("meals")
                .update({ meal_name: mealName })
                .eq("id", meal.id);
              if (mealErr) throw mealErr;

              const payload = items.map((it) => ({
                id: it.id,
                meal_id: meal.id,
                name: it.name,
                quantity: it.quantity,
                calories: it.calories,
                protein: it.protein,
                carbs: it.carbs,
                fat: it.fat
              }));

              const { error: itemsErr } = await supabase.from("food_items").upsert(payload);
              if (itemsErr) throw itemsErr;

              toast.success("Repas mis à jour");
              onSaved();
              onClose();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur de sauvegarde");
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">Nom du repas</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="Ex: Poulet & riz"
            />
          </label>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={it.id} className="rounded-2xl border border-gray-200 p-3 dark:border-slate-800">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Aliment</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                      value={it.name}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p))
                        )
                      }
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Quantité</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                      value={it.quantity}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, quantity: e.target.value } : p))
                        )
                      }
                      placeholder="150g"
                    />
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
                    <label key={k} className="block">
                      <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                        {k === "calories"
                          ? "kcal"
                          : k === "protein"
                            ? "Prot"
                            : k === "carbs"
                              ? "Gluc"
                              : "Lip"}
                      </span>
                      <input
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        value={it[k]}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, [k]: Number(e.target.value) } : p
                            )
                          )
                        }
                        required={k === "calories"}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={saving}>
              Sauvegarder
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

