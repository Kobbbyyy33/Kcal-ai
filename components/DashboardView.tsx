"use client";

import * as React from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bell,
  BellOff,
  Bot,
  CalendarPlus2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Download,
  Droplets,
  Flame,
  Lightbulb,
  Plus,
  Sparkles,
  Trophy
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MealCard } from "@/components/MealCard";
import { MealEditorModal } from "@/components/MealEditorModal";
import { Modal } from "@/components/ui/Modal";
import { NutritionSummary } from "@/components/NutritionSummary";
import { SmartOnboardingCard } from "@/components/SmartOnboardingCard";
import { flushOfflineMealQueue, getOfflineQueueSize } from "@/lib/offlineQueue";
import { clampHydrationGoal, loadPreferences, type AppPreferences } from "@/lib/preferences";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toUserErrorMessage } from "@/lib/supabase/errors";
import { useStore } from "@/lib/store/useStore";
import type { CoachInsight, FoodItem, MacroTotals, MealSuggestion, MealType, MealWithItems, Profile, WeeklyPlanResult } from "@/types";

type WeeklyDay = {
  date: string;
  calories: number;
  protein: number;
  score: number;
};

type WeeklyCoachResult = {
  adherence_score: number;
  recommendation: string;
  adjusted_goals: {
    daily_calorie_goal: number;
    daily_protein_goal: number;
    daily_carbs_goal: number;
    daily_fat_goal: number;
  };
  missions: Array<{ id: string; label: string; progress: number; target: number }>;
  rare_badges: string[];
};

type BodyProgressRow = {
  id: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  photo_url: string | null;
  notes: string | null;
};

function emptyTotals(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function sumMeals(meals: MealWithItems[]): MacroTotals {
  return meals.reduce((acc, meal) => {
    for (const it of meal.food_items) {
      acc.calories += Number(it.calories) || 0;
      acc.protein += Number(it.protein) || 0;
      acc.carbs += Number(it.carbs) || 0;
      acc.fat += Number(it.fat) || 0;
    }
    return acc;
  }, emptyTotals());
}

function sumMealCalories(meal: MealWithItems[]) {
  return meal.reduce((acc, m) => {
    for (const it of m.food_items) acc += Number(it.calories) || 0;
    return acc;
  }, 0);
}

function hydrationKey(date: string) {
  return `hydration:${date}`;
}

const HYDRATION_REMINDER_KEY = "hydration-reminders-enabled";
const LAST_REMINDER_KEY = "hydration-last-reminder-at";
const QUICK_WATER_PREFIX = "quick-water-applied:";

function buildTip(profile: Profile | null, totals: MacroTotals, hydration: number) {
  if (!profile) return "On charge ton profil nutrition...";

  const remaining = Math.max(profile.daily_calorie_goal - totals.calories, 0);
  if (hydration < 4) return `Pense a boire de l'eau. Il reste environ ${Math.round(remaining)} kcal aujourd'hui.`;
  if (totals.protein < profile.daily_protein_goal * 0.7) return "Ajoute une source de proteines pour mieux atteindre ton objectif.";
  if (remaining < 250) return "Tu approches ton objectif calories. Priorise des aliments legers.";
  return "Belle progression. Continue avec un repas equilibre.";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function computeStreak(selectedDate: string, datesWithMeals: Set<string>) {
  let streak = 0;
  let cursor = selectedDate;
  while (datesWithMeals.has(cursor)) {
    streak += 1;
    cursor = format(addDays(parseISO(cursor), -1), "yyyy-MM-dd");
  }
  return streak;
}

function getSmartSuggestions(profile: Profile | null, totals: MacroTotals): MealSuggestion[] {
  if (!profile) return [];
  const remaining = {
    calories: Math.max(profile.daily_calorie_goal - totals.calories, 0),
    protein: Math.max(profile.daily_protein_goal - totals.protein, 0),
    carbs: Math.max(profile.daily_carbs_goal - totals.carbs, 0),
    fat: Math.max(profile.daily_fat_goal - totals.fat, 0)
  };

  const bank: MealSuggestion[] = [
    {
      name: "Poulet grille + riz + brocoli",
      calories: 610,
      protein: 47,
      carbs: 61,
      fat: 15,
      reason: "Ideal si tu dois remonter les proteines sans exploser les calories."
    },
    {
      name: "Saumon + quinoa + legumes verts",
      calories: 640,
      protein: 40,
      carbs: 49,
      fat: 28,
      reason: "Bon si tes lipides sont bas et que tu veux un repas complet."
    },
    {
      name: "Wrap dinde + fromage blanc + fruit",
      calories: 430,
      protein: 34,
      carbs: 38,
      fat: 14,
      reason: "Option rapide et equilibree pour milieu de journee."
    },
    {
      name: "Skyr, avoine, banane et amandes",
      calories: 390,
      protein: 26,
      carbs: 46,
      fat: 11,
      reason: "Snack dense en nutriments quand il manque encore de l'energie."
    }
  ];

  return bank
    .map((meal) => {
      const score =
        Math.abs(meal.calories - remaining.calories * 0.55) +
        Math.abs(meal.protein - Math.max(remaining.protein, 15)) * 2 +
        Math.abs(meal.carbs - Math.max(remaining.carbs * 0.5, 15)) * 0.6 +
        Math.abs(meal.fat - Math.max(remaining.fat * 0.5, 8)) * 0.7;
      return { meal, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((x) => x.meal);
}

function dayConsistencyScore(
  calories: number,
  protein: number,
  goals: { daily_calorie_goal: number; daily_protein_goal: number }
) {
  const calDeltaRatio = goals.daily_calorie_goal > 0 ? Math.abs(calories - goals.daily_calorie_goal) / goals.daily_calorie_goal : 1;
  const proteinRatio = goals.daily_protein_goal > 0 ? Math.min(protein / goals.daily_protein_goal, 1) : 0;
  const score = 100 - calDeltaRatio * 55 + proteinRatio * 45;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function foodQualityScore(it: FoodItem, mode: AppPreferences["product_score_mode"]) {
  const kcal = Number(it.calories) || 0;
  const p = Number(it.protein) || 0;
  const c = Number(it.carbs) || 0;
  const f = Number(it.fat) || 0;

  const strictness = mode === "strict" ? 1.25 : mode === "tolerant" ? 0.75 : 1;

  let score = 62;
  if (p >= 20) score += Math.round(18 * strictness);
  else if (p >= 12) score += Math.round(10 * strictness);
  else score -= 10;

  if (kcal > 700) score -= Math.round(12 * strictness);
  else if (kcal > 450) score -= Math.round(6 * strictness);

  if (f > 35) score -= Math.round(10 * strictness);
  else if (f > 20) score -= Math.round(4 * strictness);

  if (c > 75 && p < 10) score -= Math.round(8 * strictness);
  if (it.source === "barcode") score += 3;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";
  const summary =
    grade === "A" || grade === "B"
      ? "Profil nutrition tres correct."
      : grade === "C"
        ? "Correct mais perfectible."
        : "Produit a limiter selon tes objectifs.";

  return { score, grade, summary };
}

const MEAL_TYPES: Array<{ type: MealType; label: string }> = [
  { type: "breakfast", label: "Petit dej" },
  { type: "lunch", label: "Dejeuner" },
  { type: "dinner", label: "Diner" },
  { type: "snack", label: "Snacks" }
];

export function DashboardView() {
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);

  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [meals, setMeals] = React.useState<MealWithItems[]>([]);
  const [weekly, setWeekly] = React.useState<WeeklyDay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string>("");
  const [onboardingDone, setOnboardingDone] = React.useState(true);

  const [editing, setEditing] = React.useState<MealWithItems | null>(null);
  const [copying, setCopying] = React.useState<MealWithItems | null>(null);
  const [copyDate, setCopyDate] = React.useState(selectedDate);
  const [copyingBusy, setCopyingBusy] = React.useState(false);
  const [selectedFood, setSelectedFood] = React.useState<FoodItem | null>(null);

  const [hydration, setHydration] = React.useState(0);
  const [hydrationGoal, setHydrationGoal] = React.useState(12);
  const [productScoreMode, setProductScoreMode] = React.useState<AppPreferences["product_score_mode"]>("balanced");
  const [carryBusy, setCarryBusy] = React.useState(false);
  const [streakDays, setStreakDays] = React.useState(0);
  const [activeDays7, setActiveDays7] = React.useState(0);
  const [coach, setCoach] = React.useState<CoachInsight | null>(null);
  const [coachLoading, setCoachLoading] = React.useState(false);
  const [weeklyCoach, setWeeklyCoach] = React.useState<WeeklyCoachResult | null>(null);
  const [weeklyCoachLoading, setWeeklyCoachLoading] = React.useState(false);
  const [planLoading, setPlanLoading] = React.useState(false);
  const [weeklyPlan, setWeeklyPlan] = React.useState<WeeklyPlanResult | null>(null);
  const [bodyProgress, setBodyProgress] = React.useState<BodyProgressRow[]>([]);
  const [savingProgress, setSavingProgress] = React.useState(false);
  const [newProgress, setNewProgress] = React.useState<{
    weight_kg: string;
    waist_cm: string;
    chest_cm: string;
    hips_cm: string;
    photo_url: string;
    notes: string;
  }>({ weight_kg: "", waist_cm: "", chest_cm: "", hips_cm: "", photo_url: "", notes: "" });
  const [offlineQueueCount, setOfflineQueueCount] = React.useState(0);
  const [syncingOffline, setSyncingOffline] = React.useState(false);
  const [hydrationReminders, setHydrationReminders] = React.useState(true);
  const [pushSupported, setPushSupported] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [pushBusy, setPushBusy] = React.useState(false);

  const setHydrationValue = React.useCallback(
    (updater: number | ((prev: number) => number)) => {
      setHydration((prev) => {
        const rawNext = typeof updater === "function" ? updater(prev) : updater;
        const next = Math.max(0, Math.min(hydrationGoal, Math.round(rawNext)));
        window.localStorage.setItem(hydrationKey(selectedDate), String(next));
        return next;
      });
    },
    [hydrationGoal, selectedDate]
  );

  async function refresh(date = selectedDate) {
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      await supabase
        .from("profiles")
        .upsert({ id: user.id, email: user.email ?? null })
        .throwOnError();

      const [{ data: profRes }, { data: dayRows, error: dayErr }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("meals")
          .select("*, food_items(*)")
          .eq("date", date)
          .order("created_at", { ascending: true })
      ]);

      if (profRes) setProfile(profRes as Profile);
      if (dayErr) throw dayErr;
      setMeals((dayRows ?? []) as MealWithItems[]);

      const from = format(subDays(parseISO(date), 6), "yyyy-MM-dd");
      const streakFrom = format(subDays(parseISO(date), 29), "yyyy-MM-dd");
      const [{ data: weeklyRows, error: weeklyErr }, { data: streakRows, error: streakErr }] = await Promise.all([
        supabase
          .from("meals")
          .select("date, food_items(calories,protein)")
          .gte("date", from)
          .lte("date", date)
          .order("date", { ascending: true }),
        supabase.from("meals").select("date").gte("date", streakFrom).lte("date", date)
      ]);

      if (weeklyErr) throw weeklyErr;
      if (streakErr) throw streakErr;

      const grouped = new Map<string, { calories: number; protein: number }>();
      for (let i = 0; i < 7; i++) {
        const d = format(addDays(parseISO(from), i), "yyyy-MM-dd");
        grouped.set(d, { calories: 0, protein: 0 });
      }

      for (const row of (weeklyRows ?? []) as Array<{ date: string; food_items: Array<{ calories: number; protein: number }> }>) {
        const prev = grouped.get(row.date) ?? { calories: 0, protein: 0 };
        const added = (row.food_items ?? []).reduce(
          (acc, item) => {
            acc.calories += Number(item.calories) || 0;
            acc.protein += Number(item.protein) || 0;
            return acc;
          },
          { calories: 0, protein: 0 }
        );
        grouped.set(row.date, { calories: prev.calories + added.calories, protein: prev.protein + added.protein });
      }

      const goals = {
        daily_calorie_goal: (profRes as Profile | null)?.daily_calorie_goal ?? 2000,
        daily_protein_goal: (profRes as Profile | null)?.daily_protein_goal ?? 150
      };
      setWeekly(
        Array.from(grouped.entries()).map(([d, val]) => ({
          date: d,
          calories: val.calories,
          protein: val.protein,
          score: dayConsistencyScore(val.calories, val.protein, goals)
        }))
      );
      const activeDates = new Set(((streakRows ?? []) as Array<{ date: string }>).map((r) => r.date));
      setStreakDays(computeStreak(date, activeDates));
      setActiveDays7(Array.from(grouped.values()).filter((x) => x.calories > 0).length);
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  }

  async function saveMealPayload(payload: {
    date: string;
    meal_type: MealType;
    meal_name: string;
    items: Array<{
      name: string;
      quantity: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      barcode?: string;
      image_url?: string;
      source: "ai" | "barcode" | "manual";
    }>;
    image_url?: string | null;
  }) {
    const supabase = supabaseBrowser();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Non connecte");
    await supabase
      .from("profiles")
      .upsert({ id: user.id, email: user.email ?? null })
      .throwOnError();
    const mealInsert = await supabase
      .from("meals")
      .insert({
        user_id: user.id,
        date: payload.date,
        meal_type: payload.meal_type,
        meal_name: payload.meal_name
      })
      .select("*")
      .single();
    if (mealInsert.error) throw mealInsert.error;
    const itemsPayload = payload.items.map((it) => ({
      meal_id: mealInsert.data.id,
      name: it.name,
      quantity: it.quantity,
      calories: it.calories,
      protein: it.protein,
      carbs: it.carbs,
      fat: it.fat,
      barcode: it.barcode ?? null,
      image_url: it.image_url ?? payload.image_url ?? null,
      source: it.source
    }));
    if (itemsPayload.length > 0) {
      const { error } = await supabase.from("food_items").insert(itemsPayload);
      if (error) throw error;
    }
  }

  async function syncOfflineMeals() {
    if (syncingOffline) return;
    setSyncingOffline(true);
    try {
      const synced = await flushOfflineMealQueue(saveMealPayload);
      setOfflineQueueCount(getOfflineQueueSize());
      if (synced > 0) {
        toast.success(`${synced} repas hors-ligne synchronises`);
        refresh(selectedDate);
      }
    } catch {
      // noop
    } finally {
      setSyncingOffline(false);
    }
  }

  async function loadWeeklyCoach() {
    setWeeklyCoachLoading(true);
    try {
      const res = await fetch("/api/weekly-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Coach hebdo indisponible");
      setWeeklyCoach(json as WeeklyCoachResult);
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Coach hebdo indisponible"));
      setWeeklyCoach(null);
    } finally {
      setWeeklyCoachLoading(false);
    }
  }

  async function applyWeeklyCoachGoals() {
    if (!weeklyCoach) return;
    try {
      const supabase = supabaseBrowser();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecte");
      const { error } = await supabase
        .from("profiles")
        .update({
          daily_calorie_goal: weeklyCoach.adjusted_goals.daily_calorie_goal,
          daily_protein_goal: weeklyCoach.adjusted_goals.daily_protein_goal,
          daily_carbs_goal: weeklyCoach.adjusted_goals.daily_carbs_goal,
          daily_fat_goal: weeklyCoach.adjusted_goals.daily_fat_goal
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Objectifs hebdo appliques");
      refresh(selectedDate);
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Impossible d'appliquer les objectifs"));
    }
  }

  async function generateWeeklyPlan() {
    setPlanLoading(true);
    try {
      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: selectedDate, budget_per_day: profile?.budget_per_day ?? 12 })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Plan indisponible");
      setWeeklyPlan(json as WeeklyPlanResult);
      toast.success("Plan 7 jours genere");
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Plan indisponible"));
    } finally {
      setPlanLoading(false);
    }
  }

  async function loadBodyProgress() {
    try {
      const supabase = supabaseBrowser();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("body_progress")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(10);
      if (error) throw error;
      setBodyProgress((data ?? []) as BodyProgressRow[]);
    } catch {
      // noop
    }
  }

  async function addBodyProgress() {
    setSavingProgress(true);
    try {
      const supabase = supabaseBrowser();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecte");
      const payload = {
        user_id: user.id,
        date: selectedDate,
        weight_kg: newProgress.weight_kg ? Number(newProgress.weight_kg) : null,
        waist_cm: newProgress.waist_cm ? Number(newProgress.waist_cm) : null,
        chest_cm: newProgress.chest_cm ? Number(newProgress.chest_cm) : null,
        hips_cm: newProgress.hips_cm ? Number(newProgress.hips_cm) : null,
        photo_url: newProgress.photo_url || null,
        notes: newProgress.notes || null
      };
      const { error } = await supabase.from("body_progress").insert(payload);
      if (error) throw error;
      setNewProgress({ weight_kg: "", waist_cm: "", chest_cm: "", hips_cm: "", photo_url: "", notes: "" });
      await loadBodyProgress();
      toast.success("Progression corporelle enregistree");
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur progression"));
    } finally {
      setSavingProgress(false);
    }
  }

  async function downloadCoachPdf() {
    try {
      const res = await fetch(`/api/coach-report-pdf?to=${encodeURIComponent(selectedDate)}`);
      if (!res.ok) throw new Error("Export PDF indisponible");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kcalia-coach-report-${selectedDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur export PDF"));
    }
  }

  async function carryFromPreviousDay() {
    setCarryBusy(true);
    try {
      const supabase = supabaseBrowser();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecte");

      const fromDate = format(addDays(parseISO(selectedDate), -1), "yyyy-MM-dd");
      const { data: sourceMeals, error } = await supabase
        .from("meals")
        .select("*, food_items(*)")
        .eq("date", fromDate)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const items = (sourceMeals ?? []) as MealWithItems[];
      if (items.length === 0) {
        toast.message("Aucun repas trouve hier.");
        return;
      }

      for (const meal of items) {
        const { data: insertedMeal, error: mealErr } = await supabase
          .from("meals")
          .insert({
            user_id: user.id,
            date: selectedDate,
            meal_type: meal.meal_type,
            meal_name: meal.meal_name
          })
          .select("id")
          .single();

        if (mealErr) throw mealErr;

        const payload = meal.food_items.map((it) => ({
          meal_id: insertedMeal.id,
          name: it.name,
          quantity: it.quantity,
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
          barcode: it.barcode,
          image_url: it.image_url,
          source: it.source
        }));

        if (payload.length > 0) {
          const { error: foodErr } = await supabase.from("food_items").insert(payload);
          if (foodErr) throw foodErr;
        }
      }

      toast.success("Repas d'hier copies");
      refresh(selectedDate);
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur de copie"));
    } finally {
      setCarryBusy(false);
    }
  }

  async function loadCoach() {
    setCoachLoading(true);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          hydration,
          streakDays
        })
      });
      if (!response.ok) throw new Error("Coach indisponible");
      const data = (await response.json()) as CoachInsight;
      setCoach(data);
    } catch {
      setCoach(null);
    } finally {
      setCoachLoading(false);
    }
  }

  async function sendPushReminder(kind: "hydration" | "meal") {
    try {
      await fetch("/api/push/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind })
      });
    } catch {
      // noop
    }
  }

  async function enablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Push non supporte sur cet appareil.");
      return;
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      toast.error("VAPID public key manquante.");
      return;
    }
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permission notifications refusee");
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid)
        }));
      const payload = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Impossible d'enregistrer le push.");
      setPushEnabled(true);
      toast.success("Notifications push activees");
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur activation push"));
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (!("serviceWorker" in navigator)) return;
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
      toast.success("Notifications push desactivees");
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur desactivation push"));
    } finally {
      setPushBusy(false);
    }
  }

  React.useEffect(() => {
    refresh(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  React.useEffect(() => {
    const prefs = loadPreferences();
    setHydrationGoal(clampHydrationGoal(prefs.hydration_goal_glasses));
    setProductScoreMode(prefs.product_score_mode);
  }, []);

  React.useEffect(() => {
    const raw = window.localStorage.getItem(hydrationKey(selectedDate));
    const parsed = raw ? Number(raw) : 0;
    setHydration(Number.isFinite(parsed) ? Math.max(0, Math.min(hydrationGoal, parsed)) : 0);
  }, [selectedDate, hydrationGoal]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("quick") !== "water") return;
    const key = `${QUICK_WATER_PREFIX}${selectedDate}`;
    if (window.localStorage.getItem(key) === "done") return;
    setHydrationValue((v) => v + 1);
    window.localStorage.setItem(key, "done");
    toast.success("Hydratation +1");
  }, [selectedDate, setHydrationValue]);

  React.useEffect(() => {
    const raw = window.localStorage.getItem(HYDRATION_REMINDER_KEY);
    setHydrationReminders(raw == null ? true : raw === "true");
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    const done = window.localStorage.getItem(`onboarding:v2:${userId}`) === "done";
    setOnboardingDone(done);
  }, [userId]);

  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushSupported(false);
      return;
    }
    setPushSupported(true);
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setPushEnabled(Boolean(sub));
      } catch {
        setPushEnabled(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(HYDRATION_REMINDER_KEY, String(hydrationReminders));
  }, [hydrationReminders]);

  React.useEffect(() => {
    if (!hydrationReminders) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (hydration >= Math.max(4, Math.ceil(hydrationGoal * 0.66))) return;
      const now = Date.now();
      const lastRaw = window.localStorage.getItem(LAST_REMINDER_KEY);
      const last = lastRaw ? Number(lastRaw) : 0;
      if (now - last < 1000 * 60 * 60 * 2) return;
      if (pushEnabled) {
        sendPushReminder("hydration");
      } else {
        toast.message("Hydratation", {
          description: "Pense a boire un verre d'eau pour rester regulier."
        });
      }
      window.localStorage.setItem(LAST_REMINDER_KEY, String(now));
    }, 1000 * 60 * 10);
    return () => window.clearInterval(id);
  }, [hydration, hydrationGoal, hydrationReminders, pushEnabled]);

  React.useEffect(() => {
    if (!hydrationReminders) return;
    if (meals.length > 0) return;
    const now = new Date();
    const hour = now.getHours();
    if (hour < 13 || hour > 21) return;
    const key = `meal-reminder:${selectedDate}`;
    if (window.localStorage.getItem(key) === "done") return;
    if (pushEnabled) {
      sendPushReminder("meal");
    } else {
      toast.message("Rappel repas", { description: "Pense a ajouter ton repas dans l'app." });
    }
    window.localStorage.setItem(key, "done");
  }, [meals.length, hydrationReminders, pushEnabled, selectedDate]);

  React.useEffect(() => {
    if (!profile) return;
    loadCoach();
    loadWeeklyCoach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, hydration, streakDays, profile?.id]);

  React.useEffect(() => {
    loadBodyProgress();
    setOfflineQueueCount(getOfflineQueueSize());
    const onOnline = () => {
      setOfflineQueueCount(getOfflineQueueSize());
      syncOfflineMeals();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const totals = profile ? sumMeals(meals) : emptyTotals();
  const maxWeekly = weekly.reduce((m, d) => Math.max(m, d.calories), 0);
  const avgWeekly =
    weekly.length > 0 ? Math.round(weekly.reduce((acc, d) => acc + d.calories, 0) / weekly.length) : 0;
  const bestDay = weekly.reduce<WeeklyDay | null>(
    (best, day) => (!best || day.calories > best.calories ? day : best),
    null
  );

  const remainingCalories = profile ? Math.max(Math.round(profile.daily_calorie_goal - totals.calories), 0) : 0;
  const smartSuggestions = React.useMemo(() => getSmartSuggestions(profile, totals), [profile, totals]);
  const currentDayScore = weekly.find((d) => d.date === selectedDate)?.score ?? 0;
  const rankSorted = [...weekly].sort((a, b) => b.score - a.score);
  const weeklyRank = Math.max(1, rankSorted.findIndex((d) => d.date === selectedDate) + 1);
  const badges = [
    streakDays >= 5 ? "5 jours d'affilee" : null,
    profile && totals.protein >= profile.daily_protein_goal ? "Objectif proteines atteint" : null,
    hydration >= Math.max(4, Math.ceil(hydrationGoal * 0.66)) ? "Hydratation solide" : null,
    activeDays7 >= 6 ? "Semaine tres active" : null
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {userId && !onboardingDone ? <SmartOnboardingCard userId={userId} onDone={() => setOnboardingDone(true)} /> : null}

      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 sm:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3 p-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
              <Sparkles className="h-3.5 w-3.5" />
              Plan du jour
            </div>
            <div>
              <div className="text-2xl font-semibold">Ton tableau nutrition</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {format(parseISO(selectedDate), "EEEE dd MMMM", { locale: fr })}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <div className="text-[11px] text-slate-500">Reste</div>
                <div className="font-semibold">{remainingCalories} kcal</div>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <div className="text-[11px] text-slate-500">Hydratation</div>
                <div className="font-semibold">
                  {hydration}/{hydrationGoal}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <div className="text-[11px] text-slate-500">Streak</div>
                <div className="font-semibold">{streakDays} j</div>
              </div>
            </div>
          </div>
          <div className="h-full min-h-[190px] w-full bg-slate-100 dark:bg-slate-900">
            <img src="/illustrations/food-hero.svg" alt="Illustration repas" className="h-full w-full object-cover" />
          </div>
        </div>
      </Card>

      <Card className="border-[#dbeafe] p-4 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            className="px-3"
            aria-label="Jour precedent"
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), -1), "yyyy-MM-dd"))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-base font-semibold">{format(parseISO(selectedDate), "EEEE dd/MM", { locale: fr })}</div>
          <Button
            variant="ghost"
            className="px-3"
            aria-label="Jour suivant"
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      <Card className="border-[#dbeafe] p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Droplets className="h-4 w-4 text-sky-600" />
          Quick actions
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button className="w-full px-4" onClick={() => setHydrationValue((v) => v + 1)}>
            Eau +1
          </Button>
          <Link href="/add-meal?quick=manual">
            <Button variant="ghost" className="w-full border border-slate-300 px-4 dark:border-slate-600">
              Repas express
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="border-[#bfdbfe] p-4 dark:border-slate-700">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Droplets className="h-4 w-4 text-sky-600" />
            Hydratation
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200"
              onClick={() => setHydrationReminders((v) => !v)}
            >
              {hydrationReminders ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              {hydrationReminders ? "Rappels ON" : "Rappels OFF"}
            </button>
            {pushSupported ? (
              pushEnabled ? (
                <Button variant="ghost" className="px-3 text-xs" loading={pushBusy} onClick={disablePush}>
                  Push actif
                </Button>
              ) : (
                <Button variant="ghost" className="px-3 text-xs" loading={pushBusy} onClick={enablePush}>
                  Activer Push
                </Button>
              )
            ) : null}
          </div>
        </div>
        <div
          className="mb-3 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${hydrationGoal}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: hydrationGoal }).map((_, idx) => (
            <div
              key={idx}
              className={`h-7 rounded-lg ${idx < hydration ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" className="px-4" onClick={() => setHydrationValue((v) => v - 1)}>
            - 1 verre
          </Button>
          <div className="text-sm font-semibold">
            {hydration} / {hydrationGoal}
          </div>
          <Button className="px-4" onClick={() => setHydrationValue((v) => v + 1)}>
            + 1 verre
          </Button>
        </div>
      </Card>

      <Card className="border-[#fee2e2] p-4 dark:border-slate-700">
        {profile ? (
          <NutritionSummary totals={totals} profile={profile} />
        ) : (
          <div className="text-sm text-gray-600 dark:text-slate-400">Chargement du profil...</div>
        )}
      </Card>

      <Card className="border-[#dcfce7] p-4 dark:border-slate-700">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Apercu 7 jours</div>
          <div className="text-xs text-gray-600 dark:text-slate-400">Moyenne: {avgWeekly} kcal</div>
        </div>
        <div className="grid h-24 grid-cols-7 items-end gap-2">
          {weekly.map((d) => {
            const h = maxWeekly > 0 ? Math.max(8, Math.round((d.calories / maxWeekly) * 100)) : 8;
            return (
              <div key={d.date} className="flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-emerald-500 to-emerald-300"
                  style={{ height: `${h}%` }}
                />
                <div className="text-[10px] text-gray-500 dark:text-slate-400">
                  {format(parseISO(d.date), "EE", { locale: fr })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-slate-400">
          <span>Pic: {bestDay ? `${Math.round(bestDay.calories)} kcal` : "n/a"}</span>
          <span>{buildTip(profile, totals, hydration)}</span>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <Trophy className="h-3.5 w-3.5" />
          {activeDays7}/7 jours actifs cette semaine
        </div>
      </Card>

      <Card className="border-[#e9d5ff] p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Classement hebdo</div>
          <div className="text-xs text-slate-500">
            Rang #{weeklyRank}/{Math.max(weekly.length, 1)}
          </div>
        </div>
        <div className="text-sm">
          Score du jour: <span className="font-semibold">{currentDayScore}/100</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {badges.length > 0 ? (
            badges.map((b) => (
              <span key={b} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                {b}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500">Aucun badge pour le moment. Continue ta routine.</span>
          )}
        </div>
      </Card>

      <Card className="border-[#fde68a] p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Coach hebdo intelligent</div>
          <Button variant="ghost" className="px-3 text-xs" loading={weeklyCoachLoading} onClick={loadWeeklyCoach}>
            Recalculer
          </Button>
        </div>
        {weeklyCoach ? (
          <div className="space-y-2">
            <div className="text-sm">Adherence: <span className="font-semibold">{weeklyCoach.adherence_score}/100</span></div>
            <div className="text-xs text-slate-500">{weeklyCoach.recommendation}</div>
            <div className="text-xs">
              Objectifs proposes: {weeklyCoach.adjusted_goals.daily_calorie_goal} kcal • P {weeklyCoach.adjusted_goals.daily_protein_goal}
            </div>
            <div className="space-y-1">
              {weeklyCoach.missions.map((m) => (
                <div key={m.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
                  <div>{m.label}</div>
                  <div className="text-slate-500">{Math.min(m.progress, m.target)} / {m.target}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(weeklyCoach.rare_badges ?? []).map((b) => (
                <span key={b} className="chip chip-success">{b}</span>
              ))}
            </div>
            <Button className="mt-1" onClick={applyWeeklyCoachGoals}>Appliquer ces objectifs</Button>
          </div>
        ) : (
          <div className="text-xs text-slate-500">Pas de recommandation hebdo pour le moment.</div>
        )}
      </Card>

      <Card className="border-[#fecaca] p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="h-4 w-4 text-emerald-600" />
            Plan repas 7 jours + liste de courses
          </div>
          <Button variant="ghost" className="px-3 text-xs" loading={planLoading} onClick={generateWeeklyPlan}>
            Generer
          </Button>
        </div>
        {weeklyPlan ? (
          <div className="space-y-3">
            <div className="text-xs text-slate-500">Budget cible: {weeklyPlan.budget_per_day} EUR / jour</div>
            <div className="space-y-1">
              {weeklyPlan.days.slice(0, 3).map((d) => (
                <div key={d.date} className="rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
                  {d.date}: {Math.round(d.total_kcal)} kcal • {d.estimated_cost} EUR
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold">Courses:</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {weeklyPlan.shopping_list.slice(0, 8).map((x) => (
                  <span key={x.name} className="chip chip-info">{x.name} ({x.quantity})</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">Genere ton plan adapte au budget/preferences.</div>
        )}
      </Card>

      <Card className="border-[#e2e8f0] p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Progression corporelle</div>
          <Button variant="ghost" className="px-3 text-xs" onClick={loadBodyProgress}>Rafraichir</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(["weight_kg", "waist_cm", "chest_cm", "hips_cm"] as const).map((k) => (
            <input
              key={k}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              type="number"
              placeholder={k}
              value={newProgress[k]}
              onChange={(e) => setNewProgress((p) => ({ ...p, [k]: e.target.value }))}
            />
          ))}
          <input
            className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 sm:col-span-5"
            placeholder="photo url (avant/apres)"
            value={newProgress.photo_url}
            onChange={(e) => setNewProgress((p) => ({ ...p, photo_url: e.target.value }))}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button loading={savingProgress} onClick={addBodyProgress}>Ajouter mesure</Button>
          <Button variant="ghost" onClick={downloadCoachPdf}>
            <Download className="h-4 w-4" />
            Export PDF coach
          </Button>
        </div>
        <div className="mt-2 space-y-1">
          {bodyProgress.slice(0, 5).map((b) => (
            <div key={b.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
              {b.date} • poids {b.weight_kg ?? "-"} kg • taille {b.waist_cm ?? "-"} cm
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-[#bae6fd] p-4 dark:border-slate-700">
        <div className="mb-2 text-sm font-semibold">Mode offline + sync</div>
        <div className="text-xs text-slate-500">Repas en attente: {offlineQueueCount}</div>
        <div className="mt-2">
          <Button variant="ghost" loading={syncingOffline} onClick={syncOfflineMeals}>
            Synchroniser maintenant
          </Button>
        </div>
      </Card>

      <Card className="border-[#bbf7d0] p-4 dark:border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarPlus2 className="h-4 w-4 text-emerald-600" />
              Action rapide
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Copier automatiquement les repas du jour precedent.</div>
          </div>
          <Button loading={carryBusy} onClick={carryFromPreviousDay} className="px-5">
            Copier hier
          </Button>
        </div>
      </Card>

      <Card className="border-[#ddd6fe] p-4 dark:border-slate-700">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-emerald-600" />
            Coach IA du jour
          </div>
          <Button variant="ghost" className="px-3 text-xs" onClick={loadCoach} loading={coachLoading}>
            Rafraichir
          </Button>
        </div>
        {coach ? (
          <div className="space-y-3">
            <div className="text-sm font-semibold">{coach.headline}</div>
            <div className="space-y-1.5">
              {coach.actions.map((action, idx) => (
                <div key={`${action}-${idx}`} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/70">
                  {action}
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-500">{coach.motivation}</div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Conseils IA indisponibles pour le moment.</div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-emerald-600" />
          Suggestions repas intelligentes
        </div>
        {(coach?.suggested_meals?.length ? coach.suggested_meals : smartSuggestions).length === 0 ? (
          <div className="text-sm text-slate-500">Ajoute des repas pour recevoir des suggestions ciblees.</div>
        ) : (
          <div className="space-y-2">
            {(coach?.suggested_meals?.length ? coach.suggested_meals : smartSuggestions).map((meal, idx) => (
              <div key={`${meal.name}-${idx}`} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                <div className="text-sm font-semibold">{meal.name}</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {Math.round(meal.calories)} kcal • P {Math.round(meal.protein)} • G {Math.round(meal.carbs)} • L{" "}
                  {Math.round(meal.fat)}
                </div>
                <div className="mt-1 text-xs text-slate-500">{meal.reason}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Flame className="h-5 w-5 text-emerald-600" />
          Repas
        </div>
        <Link href="/add-meal">
          <Button className="px-4">
            <Plus className="h-5 w-5" />
            Ajouter
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600 dark:text-slate-400">Chargement...</div>
      ) : (
        <div className="space-y-5">
          {MEAL_TYPES.map(({ type, label }) => {
            const group = meals.filter((m) => m.meal_type === type);
            return (
              <section key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    {label} ({Math.round(sumMealCalories(group))} kcal)
                  </div>
                  <Link href={`/add-meal?meal_type=${type}`}>
                    <Button variant="ghost" className="px-3">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
                {group.length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-slate-400">Aucun repas.</div>
                ) : (
                  <div className="space-y-3">
                    {group.map((meal) => (
                      <MealCard
                        key={meal.id}
                        meal={meal}
                        onFoodClick={(food) => setSelectedFood(food)}
                        onEdit={() => setEditing(meal)}
                        onCopy={() => {
                          setCopyDate(selectedDate);
                          setCopying(meal);
                        }}
                        onDelete={async () => {
                          if (!confirm("Supprimer ce repas ?")) return;
                          try {
                            const supabase = supabaseBrowser();
                            const { error } = await supabase.from("meals").delete().eq("id", meal.id);
                            if (error) throw error;
                            toast.success("Repas supprime");
                            refresh();
                          } catch (err) {
                            toast.error(toUserErrorMessage(err, "Erreur de suppression"));
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <MealEditorModal
        open={!!editing}
        meal={editing}
        onClose={() => setEditing(null)}
        onSaved={() => refresh()}
      />

      <Modal
        open={!!copying}
        title="Copier le repas"
        onClose={() => {
          setCopying(null);
          setCopyingBusy(false);
        }}
      >
        {!copying ? null : (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Date cible</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                type="date"
                value={copyDate}
                onChange={(e) => setCopyDate(e.target.value)}
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setCopying(null)}>
                Annuler
              </Button>
              <Button
                loading={copyingBusy}
                onClick={async () => {
                  setCopyingBusy(true);
                  try {
                    const supabase = supabaseBrowser();
                    const {
                      data: { user }
                    } = await supabase.auth.getUser();
                    if (!user) throw new Error("Non connecte");
                    const { data: inserted, error: mealErr } = await supabase
                      .from("meals")
                      .insert({
                        user_id: user.id,
                        date: copyDate,
                        meal_type: copying.meal_type,
                        meal_name: copying.meal_name
                      })
                      .select("*")
                      .single();
                    if (mealErr) throw mealErr;

                    const itemsPayload = copying.food_items.map((it) => ({
                      meal_id: inserted.id,
                      name: it.name,
                      quantity: it.quantity,
                      calories: it.calories,
                      protein: it.protein,
                      carbs: it.carbs,
                      fat: it.fat,
                      barcode: it.barcode,
                      image_url: it.image_url,
                      source: it.source
                    }));

                    if (itemsPayload.length > 0) {
                      const { error: itemsErr } = await supabase.from("food_items").insert(itemsPayload);
                      if (itemsErr) throw itemsErr;
                    }

                    toast.success("Repas copie");
                    setCopying(null);
                    if (copyDate === selectedDate) refresh();
                  } catch (err) {
                    toast.error(toUserErrorMessage(err, "Erreur de copie"));
                  } finally {
                    setCopyingBusy(false);
                  }
                }}
              >
                Copier
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!selectedFood} title={selectedFood?.name ?? "Detail produit"} onClose={() => setSelectedFood(null)}>
        {!selectedFood ? null : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <img
                src={selectedFood.image_url ?? "/icons/scan-food.svg"}
                alt={selectedFood.name}
                className="h-16 w-16 rounded-2xl object-cover"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{selectedFood.name}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedFood.quantity ?? "Portion"} • {Math.round(Number(selectedFood.calories) || 0)} kcal</div>
                {selectedFood.barcode ? <div className="mt-1 text-xs text-slate-500">Code-barres: {selectedFood.barcode}</div> : null}
                <div className="mt-1 text-xs text-slate-500">Source: {selectedFood.source === "barcode" ? "Scan code-barres" : selectedFood.source === "ai" ? "Photo IA" : "Saisie manuelle"}</div>
              </div>
            </div>

            {(() => {
              const q = foodQualityScore(selectedFood, productScoreMode);
              return (
                <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  <div className="font-semibold">Analyse style Yuka: {q.grade} ({q.score}/100)</div>
                  <div className="mt-1">{q.summary}</div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">Proteines</div>
                <div className="font-semibold">{Math.round(Number(selectedFood.protein) || 0)} g</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">Glucides</div>
                <div className="font-semibold">{Math.round(Number(selectedFood.carbs) || 0)} g</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">Lipides</div>
                <div className="font-semibold">{Math.round(Number(selectedFood.fat) || 0)} g</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/70">
                <div className="text-slate-500">Calories</div>
                <div className="font-semibold">{Math.round(Number(selectedFood.calories) || 0)} kcal</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

