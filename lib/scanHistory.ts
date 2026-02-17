export type ScannedFoodHistoryEntry = {
  barcode: string;
  name: string;
  image_url: string | null;
  brands: string | null;
  nutriscore_grade: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  source: "scan" | "add-meal";
  scanned_at: string;
};

export const SCAN_HISTORY_KEY = "kcal-ai:scan-history:v1";

export function readScanHistory(): ScannedFoodHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCAN_HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as ScannedFoodHistoryEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveScanHistory(list: ScannedFoodHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(list.slice(0, 120)));
}

export function pushScanHistory(entry: ScannedFoodHistoryEntry) {
  const current = readScanHistory();
  const next = [entry, ...current.filter((x) => x.barcode !== entry.barcode)];
  saveScanHistory(next);
  return next;
}

