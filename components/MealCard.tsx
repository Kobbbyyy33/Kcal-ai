"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { MealWithItems } from "@/types";

function sum(meal: MealWithItems) {
  return meal.food_items.reduce(
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

export function MealCard({
  meal,
  onEdit,
  onDelete,
  onCopy
}: {
  meal: MealWithItems;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const totals = sum(meal);
  const cover = meal.food_items.find((it) => it.image_url)?.image_url ?? null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {cover ? (
              <img src={cover} alt="Meal" className="h-12 w-12 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg">???</div>
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">{meal.meal_name?.trim() ? meal.meal_name : "Repas"}</div>
              <div className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                {Math.round(totals.calories)} kcal • P {Math.round(totals.protein)} • G {Math.round(totals.carbs)} • L {Math.round(totals.fat)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="px-3" aria-label="Editer" onClick={onEdit}>
            <Pencil className="h-5 w-5" />
          </Button>
          <Button variant="ghost" className="px-3" aria-label="Copier" onClick={onCopy}>
            <Copy className="h-5 w-5" />
          </Button>
          <Button variant="ghost" className="px-3" aria-label="Supprimer" onClick={onDelete}>
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {meal.food_items.map((it) => (
          <div key={it.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/70">
            <div className="min-w-0">
              <div className="truncate font-medium">{it.name}</div>
              <div className="text-gray-600 dark:text-slate-400">{it.quantity ?? "Portion"}</div>
            </div>
            <div className="shrink-0 text-gray-700 dark:text-slate-200">{Math.round(Number(it.calories) || 0)} kcal</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

