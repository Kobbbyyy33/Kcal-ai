import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { supabaseRouteClient } from "@/lib/supabase/routeClient";

const prefsSchema = z.object({
  default_portion_grams: z.number().int().min(1).max(600),
  scanner_auto_start: z.boolean(),
  scanner_vibrate_on_detect: z.boolean(),
  scan_sound_enabled: z.boolean()
});

const reqSchema = z.object({
  preferences: prefsSchema.optional()
});

function csvEscape(value: unknown) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(columns: string[], rows: Array<Record<string, unknown>>) {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(","));
  return [header, ...lines].join("\n");
}

export async function POST(request: Request) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EXPORT_FROM_EMAIL || "KcalIA <onboarding@resend.dev>";

  if (!resendKey) {
    return NextResponse.json(
      { error: "Missing RESEND_API_KEY. Configure this env var in local/Vercel." },
      { status: 400 }
    );
  }

  const parsedBody = reqSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await supabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: "No user email found" }, { status: 400 });

  const [{ data: profile }, { data: meals, error: mealsErr }, { data: foodRows, error: foodErr }, { data: bodyRows, error: bodyErr }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("meals").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase
      .from("food_items")
      .select("*, meals!inner(user_id)")
      .eq("meals.user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("body_progress").select("*").eq("user_id", user.id).order("date", { ascending: false })
  ]);

  if (mealsErr) return NextResponse.json({ error: mealsErr.message }, { status: 500 });
  if (foodErr) return NextResponse.json({ error: foodErr.message }, { status: 500 });
  if (bodyErr) return NextResponse.json({ error: bodyErr.message }, { status: 500 });

  const foodItems = (foodRows ?? []).map((row: any) => {
    const { meals: _m, ...rest } = row;
    return rest;
  });

  const preferences = parsedBody.data.preferences ?? null;

  const profileCsv = rowsToCsv(
    [
      "id",
      "email",
      "created_at",
      "daily_calorie_goal",
      "daily_protein_goal",
      "daily_carbs_goal",
      "daily_fat_goal",
      "theme"
    ],
    profile ? [profile as Record<string, unknown>] : []
  );

  const prefCsv = rowsToCsv(
    ["default_portion_grams", "scanner_auto_start", "scanner_vibrate_on_detect", "scan_sound_enabled"],
    preferences ? [preferences as Record<string, unknown>] : []
  );

  const mealsCsv = rowsToCsv(
    ["id", "user_id", "date", "meal_type", "meal_name", "created_at"],
    (meals ?? []) as Array<Record<string, unknown>>
  );

  const foodsCsv = rowsToCsv(
    [
      "id",
      "meal_id",
      "name",
      "quantity",
      "calories",
      "protein",
      "carbs",
      "fat",
      "barcode",
      "image_url",
      "source",
      "created_at"
    ],
    foodItems as Array<Record<string, unknown>>
  );
  const bodyCsv = rowsToCsv(
    ["id", "user_id", "date", "weight_kg", "waist_cm", "chest_cm", "hips_cm", "photo_url", "notes", "created_at"],
    (bodyRows ?? []) as Array<Record<string, unknown>>
  );

  const resend = new Resend(resendKey);
  const today = new Date().toISOString().slice(0, 10);

  const email = await resend.emails.send({
    from: fromEmail,
    to: user.email,
    subject: `KcalIA - Export Excel (${today})`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.5">
        <h2>Export KcalIA</h2>
        <p>Bonjour,</p>
        <p>Tu trouveras en piece jointe tes donnees en format CSV (ouvrable dans Excel): profil, preferences, repas et aliments.</p>
        <p>Genere le ${today}.</p>
      </div>
    `,
    attachments: [
      { filename: `kcalia_profile_${today}.csv`, content: Buffer.from(profileCsv).toString("base64") },
      { filename: `kcalia_preferences_${today}.csv`, content: Buffer.from(prefCsv).toString("base64") },
      { filename: `kcalia_meals_${today}.csv`, content: Buffer.from(mealsCsv).toString("base64") },
      { filename: `kcalia_food_items_${today}.csv`, content: Buffer.from(foodsCsv).toString("base64") },
      { filename: `kcalia_body_progress_${today}.csv`, content: Buffer.from(bodyCsv).toString("base64") }
    ]
  });

  if ((email as any)?.error) {
    return NextResponse.json({ error: (email as any).error.message || "Email send failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
