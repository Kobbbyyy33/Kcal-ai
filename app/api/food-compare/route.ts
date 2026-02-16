import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  barcodeA: z.string().min(6),
  barcodeB: z.string().min(6)
});

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function fetchOffProduct(barcode: string) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`, {
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Open Food Facts unavailable");
  const json = await res.json();
  if (!json || json.status !== 1 || !json.product) throw new Error(`Produit introuvable: ${barcode}`);
  return json.product as any;
}

function normalize(p: any) {
  const nutr = p?.nutriments ?? {};
  const kcal = toNum(nutr["energy-kcal_100g"]) ?? (toNum(nutr["energy_100g"]) ? (toNum(nutr["energy_100g"]) as number) / 4.184 : null) ?? 0;
  const protein = toNum(nutr["proteins_100g"]) ?? 0;
  const carbs = toNum(nutr["carbohydrates_100g"]) ?? 0;
  const fat = toNum(nutr["fat_100g"]) ?? 0;
  return {
    name: String(p?.product_name ?? "Produit"),
    image_url: p?.image_url ? String(p.image_url) : null,
    kcal_100g: kcal,
    protein_100g: protein,
    carbs_100g: carbs,
    fat_100g: fat
  };
}

function score(x: { kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number }) {
  let s = 55;
  if (x.protein_100g >= 15) s += 18;
  if (x.kcal_100g <= 120) s += 14;
  if (x.kcal_100g >= 350) s -= 12;
  if (x.fat_100g >= 20) s -= 8;
  if (x.carbs_100g >= 40 && x.protein_100g < 10) s -= 6;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const [aRaw, bRaw] = await Promise.all([fetchOffProduct(parsed.data.barcodeA), fetchOffProduct(parsed.data.barcodeB)]);
    const a = normalize(aRaw);
    const b = normalize(bRaw);
    const scoreA = score({
      kcal_100g: Number(a.kcal_100g),
      protein_100g: Number(a.protein_100g),
      carbs_100g: Number(a.carbs_100g),
      fat_100g: Number(a.fat_100g)
    });
    const scoreB = score({
      kcal_100g: Number(b.kcal_100g),
      protein_100g: Number(b.protein_100g),
      carbs_100g: Number(b.carbs_100g),
      fat_100g: Number(b.fat_100g)
    });

    const better = scoreA >= scoreB ? "A" : "B";
    const winner = better === "A" ? a : b;
    const loser = better === "A" ? b : a;
    const reasons: string[] = [];
    if ((winner.protein_100g ?? 0) > (loser.protein_100g ?? 0)) reasons.push("Plus riche en proteines");
    if ((winner.kcal_100g ?? 0) < (loser.kcal_100g ?? 0)) reasons.push("Moins calorique");
    if ((winner.fat_100g ?? 0) < (loser.fat_100g ?? 0)) reasons.push("Moins de lipides");
    if (reasons.length === 0) reasons.push("Meilleur compromis global");

    return NextResponse.json({
      productA: { ...a, score: scoreA },
      productB: { ...b, score: scoreB },
      recommendation: {
        better,
        reasons
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Compare failed" }, { status: 500 });
  }
}
