import { NextResponse } from "next/server";
import { addDays, format, parseISO } from "date-fns";
import { supabaseRouteClient } from "@/lib/supabase/routeClient";

type DailyTotals = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function startOfWindow(endDate: string, days: number) {
  return format(addDays(parseISO(endDate), -(days - 1)), "yyyy-MM-dd");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { date?: string };
  const endDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : format(new Date(), "yyyy-MM-dd");
  const fromDate = startOfWindow(endDate, 7);

  const supabase = await supabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: profile, error: profileErr }, { data: mealRows, error: mealsErr }] = await Promise.all([
    supabase
      .from("profiles")
      .select("daily_calorie_goal,daily_protein_goal,daily_carbs_goal,daily_fat_goal")
      .eq("id", user.id)
      .single(),
    supabase
      .from("meals")
      .select("date,food_items(calories,protein,carbs,fat)")
      .gte("date", fromDate)
      .lte("date", endDate)
  ]);

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
  if (mealsErr) return NextResponse.json({ error: mealsErr.message }, { status: 500 });

  const grouped = new Map<string, DailyTotals>();
  for (let i = 0; i < 7; i++) {
    const d = format(addDays(parseISO(fromDate), i), "yyyy-MM-dd");
    grouped.set(d, { date: d, calories: 0, protein: 0, carbs: 0, fat: 0 });
  }

  for (const row of (mealRows ?? []) as Array<any>) {
    const totals = grouped.get(row.date) ?? { date: row.date, calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const it of row.food_items ?? []) {
      totals.calories += Number(it.calories) || 0;
      totals.protein += Number(it.protein) || 0;
      totals.carbs += Number(it.carbs) || 0;
      totals.fat += Number(it.fat) || 0;
    }
    grouped.set(row.date, totals);
  }

  const days = Array.from(grouped.values());
  const avg = days.reduce(
    (acc, d) => {
      acc.calories += d.calories;
      acc.protein += d.protein;
      acc.carbs += d.carbs;
      acc.fat += d.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  avg.calories = Math.round(avg.calories / 7);
  avg.protein = Math.round(avg.protein / 7);
  avg.carbs = Math.round(avg.carbs / 7);
  avg.fat = Math.round(avg.fat / 7);

  const p = profile as any;
  const adherenceCal = p.daily_calorie_goal > 0 ? 1 - Math.min(1, Math.abs(avg.calories - p.daily_calorie_goal) / p.daily_calorie_goal) : 0;
  const adherenceProtein = p.daily_protein_goal > 0 ? Math.min(1, avg.protein / p.daily_protein_goal) : 0;
  const adherence = Math.max(0, Math.min(1, adherenceCal * 0.6 + adherenceProtein * 0.4));

  const adjusted = {
    daily_calorie_goal:
      adherence < 0.55
        ? Math.max(1300, Math.round(p.daily_calorie_goal * 0.95))
        : adherence > 0.82
          ? Math.round(p.daily_calorie_goal * 1.02)
          : p.daily_calorie_goal,
    daily_protein_goal:
      adherenceProtein < 0.8 ? Math.round(p.daily_protein_goal * 0.95) : Math.round(p.daily_protein_goal * 1.02),
    daily_carbs_goal: p.daily_carbs_goal,
    daily_fat_goal: p.daily_fat_goal
  };

  const missions = [
    { id: "log_meals", label: "Completer 3 repas aujourd'hui", progress: Math.min(3, (days.at(-1)?.calories ?? 0) > 0 ? 3 : 0), target: 3 },
    { id: "protein", label: "Atteindre l'objectif proteines", progress: Math.min(adjusted.daily_protein_goal, days.at(-1)?.protein ?? 0), target: adjusted.daily_protein_goal },
    { id: "consistency", label: "5 jours actifs sur 7", progress: days.filter((d) => d.calories > 0).length, target: 5 }
  ];

  const rareBadges = [
    adherence > 0.9 ? "Precision Elite" : null,
    days.filter((d) => d.protein >= p.daily_protein_goal).length >= 5 ? "Protein Master 5/7" : null,
    days.filter((d) => d.calories > 0).length === 7 ? "Semaine parfaite" : null
  ].filter(Boolean);

  return NextResponse.json({
    window: { from: fromDate, to: endDate },
    adherence_score: Math.round(adherence * 100),
    average: avg,
    current_goals: p,
    adjusted_goals: adjusted,
    recommendation:
      adherence < 0.55
        ? "On baisse legerement les objectifs pour retrouver de la regularite."
        : adherence > 0.82
          ? "Progression stable, legere hausse proposee."
          : "Objectifs actuels pertinents. Continue sur cette dynamique.",
    missions,
    rare_badges: rareBadges
  });
}
