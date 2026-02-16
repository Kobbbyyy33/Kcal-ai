import { NextResponse } from "next/server";
import { addDays, format, parseISO } from "date-fns";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseRouteClient } from "@/lib/supabase/routeClient";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? format(new Date(), "yyyy-MM-dd");
  const from = format(addDays(parseISO(to), -6), "yyyy-MM-dd");

  const supabase = await supabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email,daily_calorie_goal,daily_protein_goal,daily_carbs_goal,daily_fat_goal")
      .eq("id", user.id)
      .single(),
    supabase
      .from("meals")
      .select("date,meal_name,meal_type,food_items(calories,protein,carbs,fat)")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const daily = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (let i = 0; i < 7; i++) {
    const d = format(addDays(parseISO(from), i), "yyyy-MM-dd");
    daily.set(d, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }
  for (const row of (rows ?? []) as Array<any>) {
    const t = daily.get(row.date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const it of row.food_items ?? []) {
      t.calories += Number(it.calories) || 0;
      t.protein += Number(it.protein) || 0;
      t.carbs += Number(it.carbs) || 0;
      t.fat += Number(it.fat) || 0;
    }
    daily.set(row.date, t);
  }

  const allDays = Array.from(daily.entries());
  const avg = allDays.reduce(
    (acc, [, d]) => {
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

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 800;

  const line = (text: string, size = 11, isBold = false) => {
    page.drawText(text, {
      x: 40,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.12, 0.21, 0.12)
    });
    y -= size + 6;
  };

  line("KcalIA - Rapport hebdomadaire coach", 18, true);
  line(`Periode: ${from} -> ${to}`, 11);
  line(`Compte: ${(profile as any)?.email ?? user.email ?? "n/a"}`, 11);
  y -= 8;
  line("Moyennes sur 7 jours", 13, true);
  line(`Calories: ${avg.calories} kcal/jour`);
  line(`Proteines: ${avg.protein} g/jour`);
  line(`Glucides: ${avg.carbs} g/jour`);
  line(`Lipides: ${avg.fat} g/jour`);
  y -= 8;
  line("Detail quotidien", 13, true);

  for (const [date, d] of allDays) {
    line(`${date}  |  ${Math.round(d.calories)} kcal  P:${Math.round(d.protein)}  G:${Math.round(d.carbs)}  L:${Math.round(d.fat)}`, 10);
    if (y < 80) break;
  }

  y -= 8;
  line("Objectifs profil", 13, true);
  line(`Calories: ${(profile as any)?.daily_calorie_goal ?? 2000}`);
  line(`Proteines: ${(profile as any)?.daily_protein_goal ?? 150}`);
  line(`Glucides: ${(profile as any)?.daily_carbs_goal ?? 250}`);
  line(`Lipides: ${(profile as any)?.daily_fat_goal ?? 65}`);

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kcalia-coach-report-${to}.pdf"`
    }
  });
}
