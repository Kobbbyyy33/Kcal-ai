"use client";

import * as React from "react";
import { Bell, Camera, Download, Droplets, Eraser, History, ShieldCheck, Smartphone, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  clearFoodScanCache,
  clampHydrationGoal,
  clampPortion,
  loadPreferences,
  savePreferences,
  type AppPreferences
} from "@/lib/preferences";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toUserErrorMessage } from "@/lib/supabase/errors";
import { readScanHistory, type ScannedFoodHistoryEntry } from "@/lib/scanHistory";
import type { Profile } from "@/types";

type GoalForm = {
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fat_goal: number;
};

type GoalPreset = "cut" | "maintain" | "bulk";

function computePreset(baseCalories: number, preset: GoalPreset): GoalForm {
  const safeBase = Math.max(1200, baseCalories || 2000);
  const calories =
    preset === "cut" ? Math.max(1200, safeBase - 300) : preset === "bulk" ? Math.min(4200, safeBase + 250) : safeBase;

  const ratio =
    preset === "cut"
      ? { p: 0.35, c: 0.35, f: 0.3 }
      : preset === "bulk"
        ? { p: 0.3, c: 0.45, f: 0.25 }
        : { p: 0.3, c: 0.4, f: 0.3 };

  return {
    daily_calorie_goal: Math.round(calories),
    daily_protein_goal: Math.round((calories * ratio.p) / 4),
    daily_carbs_goal: Math.round((calories * ratio.c) / 4),
    daily_fat_goal: Math.round((calories * ratio.f) / 9)
  };
}

function isMissingGoalModeColumn(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return message.includes("profiles.goal_mode") && message.includes("does not exist");
}

function SettingSwitch({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="min-w-0 pr-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border p-1 transition-colors duration-200",
          checked
            ? "border-[#7da03c] bg-[#7da03c]"
            : "border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700"
        ].join(" ")}
      >
        <span
          className={[
            "h-6 w-6 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-0"
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function SettingsView() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savingPrefs, setSavingPrefs] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [email, setEmail] = React.useState<string>("");

  const [goals, setGoals] = React.useState<GoalForm>({
    daily_calorie_goal: 2000,
    daily_protein_goal: 150,
    daily_carbs_goal: 250,
    daily_fat_goal: 65
  });
  const [budgetPerDay, setBudgetPerDay] = React.useState<number>(12);
  const [goalMode, setGoalMode] = React.useState<GoalPreset>("maintain");
  const [dietaryPrefs, setDietaryPrefs] = React.useState<string>("");
  const [allergens, setAllergens] = React.useState<string>("");

  const [prefs, setPrefs] = React.useState<AppPreferences>(() => loadPreferences());
  const [scanHistory, setScanHistory] = React.useState<ScannedFoodHistoryEntry[]>([]);
  const [selectedScan, setSelectedScan] = React.useState<ScannedFoodHistoryEntry | null>(null);

  async function load() {
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");

      await supabase.from("profiles").upsert({ id: user.id, email: user.email ?? null }).throwOnError();
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const profile = data as Profile | null;
      if (profile) {
        setGoals({
          daily_calorie_goal: profile.daily_calorie_goal,
          daily_protein_goal: profile.daily_protein_goal,
          daily_carbs_goal: profile.daily_carbs_goal,
          daily_fat_goal: profile.daily_fat_goal
        });
        setBudgetPerDay(Number((profile as any).budget_per_day ?? 12));
        setGoalMode(((profile as any).goal_mode ?? "maintain") as GoalPreset);
        setDietaryPrefs((((profile as any).dietary_preferences ?? []) as string[]).join(", "));
        setAllergens((((profile as any).allergens ?? []) as string[]).join(", "));
      }

      setPrefs(loadPreferences());
      setScanHistory(readScanHistory());
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  React.useEffect(() => {
    savePreferences(prefs);
  }, [prefs]);

  async function exportMyData() {
    setExporting(true);
    try {
      const res = await fetch("/api/export/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Export impossible");
      toast.success("Export envoye par mail (format Excel-compatible)");
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur export"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="text-sm font-semibold">Profil</div>
        <div className="mt-2 text-sm text-gray-600 dark:text-slate-400">{email || "Non connecte"}</div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Theme</div>
            <div className="text-xs text-gray-600 dark:text-slate-400">Clair ou sombre</div>
          </div>
          <ThemeToggle />
        </div>
      </Card>

      <Card className="border-[#dce8cb] p-4 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <WandSparkles className="h-4 w-4 text-[#7da03c]" />
          Objectifs journaliers
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="chip chip-info"
            onClick={() => {
              setGoalMode("cut");
              setGoals(computePreset(goals.daily_calorie_goal, "cut"));
            }}
          >
            Mode seche
          </button>
          <button
            type="button"
            className="chip chip-info"
            onClick={() => {
              setGoalMode("maintain");
              setGoals(computePreset(goals.daily_calorie_goal, "maintain"));
            }}
          >
            Mode maintien
          </button>
          <button
            type="button"
            className="chip chip-info"
            onClick={() => {
              setGoalMode("bulk");
              setGoals(computePreset(goals.daily_calorie_goal, "bulk"));
            }}
          >
            Mode prise de masse
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Calories", "daily_calorie_goal"],
              ["Proteines", "daily_protein_goal"],
              ["Glucides", "daily_carbs_goal"],
              ["Lipides", "daily_fat_goal"]
            ] as const
          ).map(([label, key]) => (
            <label key={key} className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">{label}</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                type="number"
                min={0}
                value={goals[key]}
                onChange={(e) =>
                  setGoals((prev) => ({
                    ...prev,
                    [key]: Number(e.target.value) || 0
                  }))
                }
              />
            </label>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Budget / jour (EUR)</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              type="number"
              min={1}
              step="0.5"
              value={budgetPerDay}
              onChange={(e) => setBudgetPerDay(Number(e.target.value) || 12)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Preferences alimentaires</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              value={dietaryPrefs}
              onChange={(e) => setDietaryPrefs(e.target.value)}
              placeholder="vegan, halal, sans lactose"
            />
          </label>
        </div>
        <label className="mt-2 block">
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Allergenes a exclure</span>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
            value={allergens}
            onChange={(e) => setAllergens(e.target.value)}
            placeholder="lactose, eggs, fish, soy, sesame"
          />
        </label>

        <div className="mt-4 flex justify-end">
          <Button
            loading={saving || loading}
            onClick={async () => {
              setSaving(true);
              try {
                const supabase = supabaseBrowser();
                const {
                  data: { user }
                } = await supabase.auth.getUser();
                if (!user) throw new Error("Non connecte");

                const basePayload = {
                  daily_calorie_goal: goals.daily_calorie_goal,
                  daily_protein_goal: goals.daily_protein_goal,
                  daily_carbs_goal: goals.daily_carbs_goal,
                  daily_fat_goal: goals.daily_fat_goal,
                  budget_per_day: budgetPerDay,
                  dietary_preferences: dietaryPrefs
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                  allergens: allergens
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                };

                const firstTry = await supabase
                  .from("profiles")
                  .update({
                    ...basePayload,
                    goal_mode: goalMode,
                  })
                  .eq("id", user.id);

                if (firstTry.error && isMissingGoalModeColumn(firstTry.error)) {
                  const fallback = await supabase.from("profiles").update(basePayload).eq("id", user.id);
                  if (fallback.error) throw fallback.error;
                } else if (firstTry.error) {
                  throw firstTry.error;
                }
                toast.success("Objectifs enregistres");
              } catch (err) {
                toast.error(toUserErrorMessage(err, "Erreur de sauvegarde"));
              } finally {
                setSaving(false);
              }
            }}
          >
            Sauvegarder
          </Button>
        </div>
      </Card>

      <Card className="border-[#f4d7bf] p-4 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="h-4 w-4 text-[#e55f15]" />
          Scanner et saisie rapide
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Portion par defaut (g)</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              type="number"
              min={1}
              max={600}
              value={prefs.default_portion_grams}
              onChange={(e) =>
                setPrefs((prev) => ({
                  ...prev,
                  default_portion_grams: clampPortion(Number(e.target.value) || 100)
                }))
              }
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Objectif eau (verres/jour)</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              type="number"
              min={4}
              max={20}
              value={prefs.hydration_goal_glasses}
              onChange={(e) =>
                setPrefs((prev) => ({
                  ...prev,
                  hydration_goal_glasses: clampHydrationGoal(Number(e.target.value) || 12)
                }))
              }
            />
          </label>
        </div>

        <div className="mt-2 rounded-2xl border border-sky-200/70 bg-sky-50/70 px-3 py-2 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-300">
            <Droplets className="h-4 w-4" />
            Hydratation
          </div>
          <div className="mt-1 text-xs text-sky-700/80 dark:text-sky-300/80">
            Cet objectif est utilise dans le Dashboard pour la progression d'eau et les rappels.
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Smartphone className="h-4 w-4" />
              Mobile
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Active "Demarrage auto" seulement en HTTPS (Vercel), sinon iPhone bloque la camera.
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="text-sm font-medium">Severite du score produit</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Ajuste l'analyse "style Yuka" dans la popup produit sur le Dashboard.
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  ["tolerant", "Tolerant"],
                  ["balanced", "Equilibre"],
                  ["strict", "Strict"]
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={[
                    "tab-pill min-h-[40px] px-3 py-2 text-xs font-semibold",
                    prefs.product_score_mode === mode ? "tab-pill-active" : "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  ].join(" ")}
                  onClick={() => setPrefs((prev) => ({ ...prev, product_score_mode: mode }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <SettingSwitch
            checked={prefs.scanner_auto_start}
            onChange={(next) => setPrefs((prev) => ({ ...prev, scanner_auto_start: next }))}
            label="Demarrage auto du scanner"
            description="Lance la camera automatiquement sur l'ecran scan."
          />
          <SettingSwitch
            checked={prefs.scanner_vibrate_on_detect}
            onChange={(next) => setPrefs((prev) => ({ ...prev, scanner_vibrate_on_detect: next }))}
            label="Vibration a la detection"
            description="Retour haptique quand un code-barres est detecte."
          />
          <SettingSwitch
            checked={prefs.scan_sound_enabled}
            onChange={(next) => setPrefs((prev) => ({ ...prev, scan_sound_enabled: next }))}
            label="Son de confirmation"
            description="Joue un bip quand le scan reussit."
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            className="w-full"
            loading={savingPrefs}
            onClick={async () => {
              setSavingPrefs(true);
              try {
                savePreferences(prefs);
                toast.success("Preferences enregistrees");
              } finally {
                setSavingPrefs(false);
              }
            }}
          >
            Enregistrer les preferences
          </Button>
          <Button
            variant="ghost"
            className="w-full border border-slate-300 dark:border-slate-600"
            onClick={() => {
              clearFoodScanCache();
              setScanHistory([]);
              toast.success("Cache local nettoye");
            }}
          >
            <Eraser className="h-4 w-4" />
            Vider favoris/scans
          </Button>
        </div>
      </Card>

      <Card className="border-[#dbeafe] p-4 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-sky-600" />
            Historique scans
          </div>
          <div className="text-xs text-slate-500">{scanHistory.length} produit(s)</div>
        </div>

        {scanHistory.length === 0 ? (
          <div className="mt-2 text-xs text-slate-500">Aucun produit scanne pour le moment.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {scanHistory.slice(0, 20).map((it) => (
              <button
                key={`${it.barcode}-${it.scanned_at}`}
                type="button"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                onClick={() => setSelectedScan(it)}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={it.image_url ?? "/icons/scan-food.svg"}
                    alt={it.name}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{it.name}</div>
                    <div className="text-xs text-slate-500">
                      {it.barcode} • {it.kcal_100g ? `${Math.round(it.kcal_100g)} kcal/100g` : "kcal inconnues"}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">{new Date(it.scanned_at).toLocaleDateString("fr-FR")}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-[#21502c]" />
          Donnees et securite
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Envoi par mail des donnees en fichiers CSV (ouvrables dans Excel): profil, preferences, repas, aliments.
        </div>
        <div className="mt-3">
          <Button variant="ghost" className="w-full" loading={exporting} onClick={exportMyData}>
            <Download className="h-4 w-4" />
            Envoyer mes donnees par mail
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-[#21502c]" />
          Notifications
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Les notifications push se configurent depuis le Dashboard (activation/desactivation).
        </div>
      </Card>

      <Modal open={!!selectedScan} title={selectedScan?.name ?? "Produit"} onClose={() => setSelectedScan(null)}>
        {!selectedScan ? null : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <img
                src={selectedScan.image_url ?? "/icons/scan-food.svg"}
                alt={selectedScan.name}
                className="h-16 w-16 rounded-2xl object-cover"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{selectedScan.name}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedScan.brands ?? "Marque inconnue"}</div>
                <div className="mt-1 text-xs text-slate-500">Code-barres: {selectedScan.barcode}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Scanne le {new Date(selectedScan.scanned_at).toLocaleString("fr-FR")}
                </div>
                {selectedScan.nutriscore_grade ? (
                  <div className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Nutri-score {selectedScan.nutriscore_grade}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">Calories</div>
                <div className="font-semibold">{Math.round(selectedScan.kcal_100g)} kcal</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">Proteines</div>
                <div className="font-semibold">{Math.round(selectedScan.protein_100g)} g</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">Glucides</div>
                <div className="font-semibold">{Math.round(selectedScan.carbs_100g)} g</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">Lipides</div>
                <div className="font-semibold">{Math.round(selectedScan.fat_100g)} g</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
