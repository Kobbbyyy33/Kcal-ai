import { NextResponse } from "next/server";
import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabase/routeClient";
import type { MealType } from "@/types";

const reqSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budget_per_day: z.number().positive().max(80).optional()
});

type TemplateMeal = {
  meal_type: MealType;
  name: string;
  quantity: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  estimated_cost: number;
  tags: string[];
  allergens: string[];
};

const TEMPLATES: TemplateMeal[] = [
  { meal_type: "breakfast", name: "Overnight oats protein", quantity: "1 bol", kcal: 420, protein: 28, carbs: 52, fat: 12, estimated_cost: 2.7, tags: ["vegetarian", "post_workout"], allergens: ["lactose"] },
  { meal_type: "breakfast", name: "Omelette + pain complet", quantity: "1 assiette", kcal: 390, protein: 30, carbs: 26, fat: 18, estimated_cost: 2.3, tags: ["halal", "low_kcal"], allergens: ["eggs"] },
  { meal_type: "lunch", name: "Poulet riz legumes", quantity: "1 box", kcal: 620, protein: 46, carbs: 70, fat: 15, estimated_cost: 4.2, tags: ["halal", "post_workout"], allergens: [] },
  { meal_type: "lunch", name: "Tofu quinoa bowl", quantity: "1 box", kcal: 560, protein: 29, carbs: 64, fat: 19, estimated_cost: 4.5, tags: ["vegan"], allergens: ["soy"] },
  { meal_type: "dinner", name: "Saumon patate douce", quantity: "1 assiette", kcal: 640, protein: 40, carbs: 45, fat: 29, estimated_cost: 5.1, tags: ["low_kcal"], allergens: ["fish"] },
  { meal_type: "dinner", name: "Dinde + semoule + legumes", quantity: "1 assiette", kcal: 590, protein: 44, carbs: 58, fat: 16, estimated_cost: 4.4, tags: ["halal"], allergens: [] },
  { meal_type: "snack", name: "Skyr + banane", quantity: "1 portion", kcal: 240, protein: 18, carbs: 31, fat: 4, estimated_cost: 1.8, tags: ["post_workout"], allergens: ["lactose"] },
  { meal_type: "snack", name: "Hummus + carottes", quantity: "1 portion", kcal: 210, protein: 8, carbs: 21, fat: 10, estimated_cost: 1.4, tags: ["vegan"], allergens: ["sesame"] }
];

function filterTemplates(pref: string[], allergens: string[]) {
  const prefSet = new Set(pref.map((x) => x.toLowerCase()));
  const allSet = new Set(allergens.map((x) => x.toLowerCase()));

  return TEMPLATES.filter((m) => {
    if (m.allergens.some((a) => allSet.has(a.toLowerCase()))) return false;
    if (prefSet.has("vegan") && !m.tags.includes("vegan")) return false;
    if (prefSet.has("halal") && !m.tags.includes("halal")) return false;
    if (prefSet.has("sans lactose") && m.allergens.includes("lactose")) return false;
    if (prefSet.has("sans gluten") && /(pain|semoule|avoine)/i.test(m.name)) return false;
    return true;
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = reqSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const supabase = await supabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("budget_per_day,dietary_preferences,allergens")
    .eq("id", user.id)
    .single();
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  const startDate = parsed.data.start_date ?? format(new Date(), "yyyy-MM-dd");
  const budgetPerDay = parsed.data.budget_per_day ?? Number((profile as any)?.budget_per_day ?? 12);
  const prefs = ((profile as any)?.dietary_preferences ?? []) as string[];
  const allergens = ((profile as any)?.allergens ?? []) as string[];
  const candidates = filterTemplates(prefs, allergens);
  if (candidates.length < 4) return NextResponse.json({ error: "Filters too restrictive. Relax preferences/allergens." }, { status: 400 });

  const pick = (type: MealType, idx: number) => {
    const list = candidates.filter((x) => x.meal_type === type);
    return list[idx % list.length];
  };

  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = format(addDays(parseISO(startDate), i), "yyyy-MM-dd");
    const meals = [pick("breakfast", i), pick("lunch", i + 1), pick("dinner", i + 2), pick("snack", i + 3)];
    let totalCost = meals.reduce((acc, m) => acc + m.estimated_cost, 0);
    const budgetFactor = totalCost > budgetPerDay ? budgetPerDay / totalCost : 1;
    const normalized = meals.map((m) => ({
      ...m,
      estimated_cost: Number((m.estimated_cost * budgetFactor).toFixed(2))
    }));
    totalCost = normalized.reduce((acc, m) => acc + m.estimated_cost, 0);
    const totalKcal = normalized.reduce((acc, m) => acc + m.kcal, 0);
    return {
      date,
      meals: normalized,
      total_kcal: totalKcal,
      estimated_cost: Number(totalCost.toFixed(2))
    };
  });

  const shoppingMap = new Map<string, { quantity: string; estimated_cost: number }>();
  for (const d of days) {
    for (const m of d.meals) {
      const current = shoppingMap.get(m.name) ?? { quantity: "0", estimated_cost: 0 };
      const qtyNum = Number(current.quantity) || 0;
      shoppingMap.set(m.name, {
        quantity: String(qtyNum + 1),
        estimated_cost: Number((current.estimated_cost + m.estimated_cost).toFixed(2))
      });
    }
  }

  const shopping_list = Array.from(shoppingMap.entries()).map(([name, v]) => ({
    name,
    quantity: `${v.quantity} portions`,
    estimated_cost: v.estimated_cost
  }));

  return NextResponse.json({
    budget_per_day: budgetPerDay,
    days,
    shopping_list
  });
}

