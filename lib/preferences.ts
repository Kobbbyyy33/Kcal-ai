export type AppPreferences = {
  default_portion_grams: number;
  hydration_goal_glasses: number;
  product_score_mode: "tolerant" | "balanced" | "strict";
  scanner_auto_start: boolean;
  scanner_vibrate_on_detect: boolean;
  scan_sound_enabled: boolean;
};

const STORAGE_KEY = "kcal-ai:preferences:v1";

export const defaultPreferences: AppPreferences = {
  default_portion_grams: 100,
  hydration_goal_glasses: 12,
  product_score_mode: "balanced",
  scanner_auto_start: false,
  scanner_vibrate_on_detect: true,
  scan_sound_enabled: false
};

export function clampPortion(value: number) {
  if (!Number.isFinite(value)) return defaultPreferences.default_portion_grams;
  return Math.min(600, Math.max(1, Math.round(value)));
}

export function clampHydrationGoal(value: number) {
  if (!Number.isFinite(value)) return defaultPreferences.hydration_goal_glasses;
  return Math.min(20, Math.max(4, Math.round(value)));
}

export function loadPreferences(): AppPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      default_portion_grams: clampPortion(parsed.default_portion_grams ?? defaultPreferences.default_portion_grams),
      hydration_goal_glasses: clampHydrationGoal(parsed.hydration_goal_glasses ?? defaultPreferences.hydration_goal_glasses),
      product_score_mode:
        parsed.product_score_mode === "tolerant" || parsed.product_score_mode === "strict" || parsed.product_score_mode === "balanced"
          ? parsed.product_score_mode
          : defaultPreferences.product_score_mode,
      scanner_auto_start: Boolean(parsed.scanner_auto_start),
      scanner_vibrate_on_detect:
        parsed.scanner_vibrate_on_detect === undefined ? defaultPreferences.scanner_vibrate_on_detect : Boolean(parsed.scanner_vibrate_on_detect),
      scan_sound_enabled: Boolean(parsed.scan_sound_enabled)
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(next: AppPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...next,
      default_portion_grams: clampPortion(next.default_portion_grams),
      hydration_goal_glasses: clampHydrationGoal(next.hydration_goal_glasses)
    })
  );
}

export function clearFoodScanCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("kcal-ai:recent-scans:v1");
  window.localStorage.removeItem("kcal-ai:favorite-scans:v1");
  window.localStorage.removeItem("kcal-ai:scan-history:v1");
}
