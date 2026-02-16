import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  imageBase64: z.string().min(20),
  mediaType: z.string().min(3)
});

const num = z.coerce.number().finite().nonnegative();

const itemSchema = z.object({
  name: z.string().min(1),
  quantity: z.string().min(1).catch("1 portion"),
  calories: num,
  protein: num,
  carbs: num,
  fat: num
});

const resultSchema = z.object({
  meal_name: z.string().min(1).catch("Repas"),
  items: z.array(itemSchema),
  total: z.object({
    calories: num,
    protein: num,
    carbs: num,
    fat: num
  }).optional(),
  confidence: z.enum(["high", "medium", "low"])
});

function extractJson(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = text.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function normalizeMeal(raw: unknown) {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) return null;

  const meal = parsed.data;
  const computed = meal.items.reduce(
    (acc, item) => {
      acc.calories += item.calories;
      acc.protein += item.protein;
      acc.carbs += item.carbs;
      acc.fat += item.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    meal_name: meal.meal_name,
    items: meal.items,
    total: meal.total ?? computed,
    confidence: meal.confidence
  };
}

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return new NextResponse("Missing OPENAI_API_KEY", { status: 500 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return new NextResponse("Missing Supabase env", { status: 500 });

  const cookieStore = await cookies();
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };
  const supabase = createServerClient(url, anonKey, {
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
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { imageBase64, mediaType } = parsed.data;
  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > 5 * 1024 * 1024) return new NextResponse("Image too large", { status: 413 });

  const prompt = `Analyse cette photo de repas et retourne UNIQUEMENT un JSON avec cette structure exacte :\n{\n  \"meal_name\": \"nom du plat principal\",\n  \"items\": [\n    {\n      \"name\": \"nom de l'aliment\",\n      \"quantity\": \"quantité estimée (ex: 150g, 1 portion)\",\n      \"calories\": nombre de calories,\n      \"protein\": grammes de protéines,\n      \"carbs\": grammes de glucides,\n      \"fat\": grammes de lipides\n    }\n  ],\n  \"total\": {\n    \"calories\": total calories,\n    \"protein\": total protéines,\n    \"carbs\": total glucides,\n    \"fat\": total lipides\n  },\n  \"confidence\": \"high/medium/low\"\n}\nN'ajoute aucun texte autour.`;

  const openai = new OpenAI({ apiKey: key });
  const dataUrl = `data:${mediaType};base64,${imageBase64}`;
  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: dataUrl, detail: "low" }
          ]
        }
      ],
      max_output_tokens: 900
    });

    const text = response.output_text ?? "";
    const extracted = extractJson(text) ?? extractJson(JSON.stringify(response));
    const normalized = normalizeMeal(extracted);

    if (!normalized || normalized.items.length === 0) {
      return new NextResponse("OpenAI did not return valid meal JSON", { status: 502 });
    }

    return NextResponse.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI request failed";
    return new NextResponse(message, { status: 502 });
  }
}
