import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { z } from "zod";

type MealRow = {
  meal_name: string | null;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  food_items: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
};

type ProfileRow = {
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fat_goal: number;
  budget_per_day?: number;
  dietary_preferences?: string[];
  allergens?: string[];
};

const reqSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hydration: z.number().int().min(0).max(20).default(0),
  streakDays: z.number().int().min(0).max(365).default(0)
});

const suggestionSchema = z.object({
  name: z.string().min(1),
  calories: z.coerce.number().nonnegative(),
  protein: z.coerce.number().nonnegative(),
  carbs: z.coerce.number().nonnegative(),
  fat: z.coerce.number().nonnegative(),
  reason: z.string().min(1)
});

const coachSchema = z.object({
  headline: z.string().min(1),
  actions: z.array(z.string().min(1)).min(2).max(4),
  motivation: z.string().min(1),
  suggested_meals: z.array(suggestionSchema).min(2).max(4)
});

function extractJson(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) return null;
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return null;
  }
}

function computeTotals(meals: MealRow[]) {
  return meals.reduce(
    (acc, meal) => {
      for (const item of meal.food_items) {
        acc.calories += Number(item.calories) || 0;
        acc.protein += Number(item.protein) || 0;
        acc.carbs += Number(item.carbs) || 0;
        acc.fat += Number(item.fat) || 0;
      }
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function buildFallback(profile: ProfileRow | null, meals: MealRow[], hydration: number, streakDays: number) {
  const totals = computeTotals(meals);
  const goal = profile ?? {
    daily_calorie_goal: 2000,
    daily_protein_goal: 150,
    daily_carbs_goal: 250,
    daily_fat_goal: 65
  };

  const remaining = {
    calories: Math.max(goal.daily_calorie_goal - totals.calories, 0),
    protein: Math.max(goal.daily_protein_goal - totals.protein, 0),
    carbs: Math.max(goal.daily_carbs_goal - totals.carbs, 0),
    fat: Math.max(goal.daily_fat_goal - totals.fat, 0)
  };

  const actions: string[] = [];
  if (hydration < 5) actions.push("Bois 2 verres d'eau dans les 60 prochaines minutes.");
  if (remaining.protein > 30) actions.push("Ajoute une source riche en proteines a ton prochain repas.");
  if (remaining.calories > 700) actions.push("Planifie un vrai repas complet pour rester regulier.");
  if (actions.length < 3) actions.push("Ajoute un fruit et une portion de legumes pour equilibrer.");

  const suggestions = [
    {
      name: "Bowl poulet, riz et legumes",
      calories: 620,
      protein: 46,
      carbs: 62,
      fat: 16,
      reason: "Bon ratio proteines/glucides pour combler un gros manque."
    },
    {
      name: "Skyr + banane + amandes",
      calories: 360,
      protein: 28,
      carbs: 34,
      fat: 12,
      reason: "Snack proteine rapide si tu manques de temps."
    },
    {
      name: "Omelette 3 oeufs + pain complet + avocat",
      calories: 520,
      protein: 32,
      carbs: 28,
      fat: 30,
      reason: "Apporte des lipides utiles et de la satiété."
    }
  ];

  return {
    headline: streakDays > 0 ? `Streak ${streakDays} jours: tu es constant.` : "On relance une routine solide aujourd'hui.",
    actions: actions.slice(0, 3),
    motivation: remaining.calories < 300 ? "Tu es proche de l'objectif du jour." : "Encore une marge pour bien finir la journee.",
    suggested_meals: suggestions
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedReq = reqSchema.safeParse(body);
  if (!parsedReq.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { date, hydration, streakDays } = parsedReq.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });

  const cookieStore = await cookies();
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const c of cookiesToSet) cookieStore.set(c.name, c.value, c.options);
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: profileRes }, { data: mealsRes, error: mealsErr }] = await Promise.all([
    supabase
      .from("profiles")
      .select("daily_calorie_goal,daily_protein_goal,daily_carbs_goal,daily_fat_goal,budget_per_day,dietary_preferences,allergens")
      .eq("id", user.id)
      .single(),
    supabase.from("meals").select("meal_name,meal_type,food_items(name,calories,protein,carbs,fat)").eq("date", date)
  ]);
  if (mealsErr) return NextResponse.json({ error: mealsErr.message }, { status: 500 });

  const meals = (mealsRes ?? []) as MealRow[];
  const profile = (profileRes ?? null) as ProfileRow | null;
  const fallback = buildFallback(profile, meals, hydration, streakDays);

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ ...fallback, source: "heuristic" });

  try {
    const totals = computeTotals(meals);
    const openai = new OpenAI({ apiKey: openaiKey });
    const prompt = [
      "Tu es un coach nutrition tres concret.",
      "Retourne uniquement un JSON valide avec les champs:",
      '{"headline":"...","actions":["..."],"motivation":"...","suggested_meals":[{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"reason":"..."}]}',
      "Contraintes: 3 actions max, 3 suggestions repas max, style clair, court, motivant, en francais.",
      `Contexte du jour: calories ${Math.round(totals.calories)}, proteines ${Math.round(totals.protein)}, glucides ${Math.round(totals.carbs)}, lipides ${Math.round(totals.fat)}.`,
      `Objectifs: calories ${profile?.daily_calorie_goal ?? 2000}, proteines ${profile?.daily_protein_goal ?? 150}, glucides ${profile?.daily_carbs_goal ?? 250}, lipides ${profile?.daily_fat_goal ?? 65}.`,
      `Budget/jour: ${profile?.budget_per_day ?? 12} EUR.`,
      `Preferences: ${Array.isArray(profile?.dietary_preferences) ? profile?.dietary_preferences.join(", ") : "aucune"}.`,
      `Allergenes a eviter: ${Array.isArray(profile?.allergens) ? profile?.allergens.join(", ") : "aucun"}.`,
      `Hydratation: ${hydration}/12. Streak: ${streakDays} jours.`
    ].join("\n");

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 500
    });
    const raw = response.output_text ?? "";
    const json = extractJson(raw);
    const parsedCoach = coachSchema.safeParse(json);
    if (!parsedCoach.success) return NextResponse.json({ ...fallback, source: "heuristic" });

    return NextResponse.json({ ...parsedCoach.data, source: "ai" });
  } catch {
    return NextResponse.json({ ...fallback, source: "heuristic" });
  }
}
