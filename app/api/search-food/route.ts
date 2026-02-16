import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabase/routeClient";

const schema = z.object({
  q: z.string().min(1).max(120),
  tag: z.enum(["high_protein", "low_kcal", "post_workout"]).optional()
});

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    q: url.searchParams.get("q") ?? "",
    tag: url.searchParams.get("tag") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const { q: query, tag } = parsed.data;
  const supabase = await supabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  let userPrefs: string[] = [];
  let userAllergens: string[] = [];
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("dietary_preferences,allergens")
      .eq("id", user.id)
      .single();
    userPrefs = (((prof as any)?.dietary_preferences ?? []) as string[]).map((x) => x.toLowerCase());
    userAllergens = (((prof as any)?.allergens ?? []) as string[]).map((x) => x.toLowerCase());
  }
  const offUrl = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  offUrl.searchParams.set("search_terms", query);
  offUrl.searchParams.set("search_simple", "1");
  offUrl.searchParams.set("action", "process");
  offUrl.searchParams.set("json", "1");
  offUrl.searchParams.set("page_size", "20");

  const res = await fetch(offUrl.toString(), {
    headers: { "User-Agent": "kcal-ai (demo)" },
    cache: "no-store"
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Open Food Facts error" }, { status: 502 });
  }

  const json = await res.json();
  const products = Array.isArray(json?.products) ? json.products : [];

  function computeTags(x: { kcal_100g: number | null; protein_100g: number | null; carbs_100g: number | null }) {
    const tags: string[] = [];
    const p = x.protein_100g ?? 0;
    const kcal = x.kcal_100g ?? 9999;
    const c = x.carbs_100g ?? 0;
    if (p >= 15) tags.push("high_protein");
    if (kcal <= 120) tags.push("low_kcal");
    if (p >= 12 && c >= 20 && kcal <= 320) tags.push("post_workout");
    return tags;
  }

  const items: Array<{
    id: string;
    name: string;
    image_url: string | null;
    kcal_100g: number | null;
    protein_100g: number | null;
    carbs_100g: number | null;
    fat_100g: number | null;
    tags: string[];
  }> = products
    .map((p: any) => {
      const nutr = p?.nutriments ?? {};
      const kcal =
        toNum(nutr["energy-kcal_100g"]) ??
        (toNum(nutr["energy_100g"]) != null ? (toNum(nutr["energy_100g"]) as number) / 4.184 : null);

      const base = {
        id: String(p?.id ?? p?._id ?? p?.code ?? `${p?.product_name}-${Math.random()}`),
        name: String(p?.product_name ?? p?.generic_name ?? "Produit"),
        image_url: p?.image_url ? String(p.image_url) : null,
        kcal_100g: kcal,
        protein_100g: toNum(nutr["proteins_100g"]),
        carbs_100g: toNum(nutr["carbohydrates_100g"]),
        fat_100g: toNum(nutr["fat_100g"])
      };
      return {
        ...base,
        tags: computeTags(base)
      };
    })
    .filter((x: { name: string }) => x.name && x.name !== "Produit");

  const filtered = (tag ? items.filter((x: { tags: string[] }) => x.tags.includes(tag)) : items).filter((x: any) => {
    const name = String(x.name ?? "").toLowerCase();
    if (userPrefs.includes("vegan") && /(poulet|boeuf|porc|saumon|thon|oeuf|fromage|lait|yaourt)/i.test(name)) return false;
    if (userPrefs.includes("sans lactose") && /(lait|fromage|yaourt|skyr|whey)/i.test(name)) return false;
    if (userPrefs.includes("sans gluten") && /(ble|pain|pates|semoule|avoine)/i.test(name)) return false;
    if (userAllergens.includes("lactose") && /(lait|fromage|yaourt|skyr|whey)/i.test(name)) return false;
    if (userAllergens.includes("eggs") && /oeuf/i.test(name)) return false;
    if (userAllergens.includes("fish") && /(saumon|thon|poisson)/i.test(name)) return false;
    if (userAllergens.includes("soy") && /tofu|soja/i.test(name)) return false;
    return true;
  });

  return NextResponse.json({ items: filtered });
}
