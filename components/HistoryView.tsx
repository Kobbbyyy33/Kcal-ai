"use client";

import * as React from "react";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toUserErrorMessage } from "@/lib/supabase/errors";
import { useStore } from "@/lib/store/useStore";
import type { MealWithItems } from "@/types";

function sumMeals(meals: MealWithItems[]) {
  return meals.reduce((acc, meal) => {
    for (const it of meal.food_items) acc += Number(it.calories) || 0;
    return acc;
  }, 0);
}

function matchesQuery(meals: MealWithItems[], query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return meals.some((meal) => {
    if ((meal.meal_name ?? "").toLowerCase().includes(q)) return true;
    return meal.food_items.some((item) => item.name.toLowerCase().includes(q));
  });
}

export function HistoryView() {
  const router = useRouter();
  const setSelectedDate = useStore((s) => s.setSelectedDate);

  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [byDate, setByDate] = React.useState<Record<string, MealWithItems[]>>({});

  async function load() {
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const to = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("meals")
        .select("*, food_items(*)")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const grouped: Record<string, MealWithItems[]> = {};
      for (const m of (data ?? []) as MealWithItems[]) {
        grouped[m.date] ??= [];
        grouped[m.date].push(m);
      }
      setByDate(grouped);
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur chargement historique"));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const dates = Object.keys(byDate)
    .sort((a, b) => (a < b ? 1 : -1))
    .filter((d) => matchesQuery(byDate[d] ?? [], query));

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="grid sm:grid-cols-[1.1fr_1fr]">
          <div className="p-5">
            <div className="text-lg font-semibold">Historique des 30 derniers jours</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Recherche rapide par nom de repas ou aliment, puis ouvre la date dans le dashboard.
            </div>
          </div>
          <div className="min-h-[150px] bg-slate-100 dark:bg-slate-900">
            <img src="/illustrations/delivery-hero.svg" alt="Illustration historique" className="h-full w-full object-cover" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Rechercher un repas ou aliment..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </Card>

      {loading ? (
        <div className="text-sm text-gray-600 dark:text-slate-400">Chargement...</div>
      ) : dates.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-slate-400">Aucune donnee.</div>
      ) : (
        <div className="space-y-3">
          {dates.map((d) => {
            const meals = byDate[d] ?? [];
            const kcal = sumMeals(meals);
            return (
              <Card key={d} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{format(parseISO(d), "EEEE dd/MM", { locale: fr })}</div>
                    <div className="text-sm text-gray-600 dark:text-slate-400">{meals.length} repas • {Math.round(kcal)} kcal</div>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedDate(d);
                      router.push("/dashboard");
                    }}
                  >
                    Ouvrir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

