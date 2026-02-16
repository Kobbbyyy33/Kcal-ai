"use client";

import * as React from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bell,
  BellOff,
  Bot,
  CalendarPlus2,
  ChevronLeft,
  ChevronRight,
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
import { supabaseBrowser } from "@/lib/supabase/client";
import { toUserErrorMessage } from "@/lib/supabase/errors";
import { useStore } from "@/lib/store/useStore";
import type { CoachInsight, MacroTotals, MealSuggestion, MealType, MealWithItems, Profile } from "@/types";

type WeeklyDay = {
  date: string;
  calories: number;
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

  const [hydration, setHydration] = React.useState(0);
  const [carryBusy, setCarryBusy] = React.useState(false);
  const [streakDays, setStreakDays] = React.useState(0);
  const [activeDays7, setActiveDays7] = React.useState(0);
  const [coach, setCoach] = React.useState<CoachInsight | null>(null);
  const [coachLoading, setCoachLoading] = React.useState(false);
  const [hydrationReminders, setHydrationReminders] = React.useState(true);
  const [pushSupported, setPushSupported] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [pushBusy, setPushBusy] = React.useState(false);

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
          .select("date, food_items(calories)")
          .gte("date", from)
          .lte("date", date)
          .order("date", { ascending: true }),
        supabase.from("meals").select("date").gte("date", streakFrom).lte("date", date)
      ]);

      if (weeklyErr) throw weeklyErr;
      if (streakErr) throw streakErr;

      const grouped = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = format(addDays(parseISO(from), i), "yyyy-MM-dd");
        grouped.set(d, 0);
      }

      for (const row of (weeklyRows ?? []) as Array<{ date: string; food_items: Array<{ calories: number }> }>) {
        const prev = grouped.get(row.date) ?? 0;
        const added = (row.food_items ?? []).reduce((acc, item) => acc + (Number(item.calories) || 0), 0);
        grouped.set(row.date, prev + added);
      }

      setWeekly(Array.from(grouped.entries()).map(([d, calories]) => ({ date: d, calories })));
      const activeDates = new Set(((streakRows ?? []) as Array<{ date: string }>).map((r) => r.date));
      setStreakDays(computeStreak(date, activeDates));
      setActiveDays7(Array.from(grouped.values()).filter((x) => x > 0).length);
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur de chargement"));
    } finally {
      setLoading(false);
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
    const raw = window.localStorage.getItem(hydrationKey(selectedDate));
    const parsed = raw ? Number(raw) : 0;
    setHydration(Number.isFinite(parsed) ? Math.max(0, Math.min(12, parsed)) : 0);
  }, [selectedDate]);

  React.useEffect(() => {
    window.localStorage.setItem(hydrationKey(selectedDate), String(hydration));
  }, [selectedDate, hydration]);

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
      if (hydration >= 8) return;
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
  }, [hydration, hydrationReminders, pushEnabled]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, hydration, streakDays, profile?.id]);

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
                <div className="font-semibold">{hydration}/12</div>
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

      <Card className="p-4">
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

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Droplets className="h-4 w-4 text-emerald-600" />
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
        <div className="mb-3 grid grid-cols-12 gap-1.5">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className={`h-7 rounded-lg ${idx < hydration ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="px-4" onClick={() => setHydration((v) => Math.max(0, v - 1))}>
            - 1 verre
          </Button>
          <div className="text-sm font-semibold">{hydration} / 12</div>
          <Button className="px-4" onClick={() => setHydration((v) => Math.min(12, v + 1))}>
            + 1 verre
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        {profile ? (
          <NutritionSummary totals={totals} profile={profile} />
        ) : (
          <div className="text-sm text-gray-600 dark:text-slate-400">Chargement du profil...</div>
        )}
      </Card>

      <Card className="p-4">
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

      <Card className="p-4">
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

      <Card className="p-4">
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
    </div>
  );
}

