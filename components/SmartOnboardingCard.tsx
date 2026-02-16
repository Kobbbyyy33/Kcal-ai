"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toUserErrorMessage } from "@/lib/supabase/errors";

type Sex = "male" | "female";
type Activity = "sedentary" | "light" | "moderate" | "high";
type Goal = "lose" | "maintain" | "gain";

type Props = {
  userId: string;
  onDone: () => void;
};

const activityFactor: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725
};

function round50(value: number) {
  return Math.round(value / 50) * 50;
}

function computeGoals({
  sex,
  age,
  heightCm,
  weightKg,
  activity,
  goal
}: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
}) {
  const sexOffset = sex === "male" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const tdee = bmr * activityFactor[activity];
  const calorieFactor = goal === "lose" ? 0.85 : goal === "gain" ? 1.12 : 1;
  const calories = Math.max(1200, round50(tdee * calorieFactor));

  const proteinPerKg = goal === "lose" ? 2 : 1.8;
  const protein = Math.max(80, Math.round(weightKg * proteinPerKg));
  const fat = Math.max(45, Math.round((calories * 0.27) / 9));
  const carbs = Math.max(90, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    daily_calorie_goal: calories,
    daily_protein_goal: protein,
    daily_fat_goal: fat,
    daily_carbs_goal: carbs
  };
}

export function SmartOnboardingCard({ userId, onDone }: Props) {
  const [sex, setSex] = React.useState<Sex>("male");
  const [age, setAge] = React.useState(30);
  const [heightCm, setHeightCm] = React.useState(175);
  const [weightKg, setWeightKg] = React.useState(75);
  const [activity, setActivity] = React.useState<Activity>("moderate");
  const [goal, setGoal] = React.useState<Goal>("maintain");
  const [saving, setSaving] = React.useState(false);

  const goals = React.useMemo(
    () => computeGoals({ sex, age, heightCm, weightKg, activity, goal }),
    [sex, age, heightCm, weightKg, activity, goal]
  );

  return (
    <Card className="p-4">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
        <Sparkles className="h-3.5 w-3.5" />
        Onboarding intelligent
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Renseigne ton profil en 30 secondes. On calcule automatiquement tes objectifs nutrition.
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Sexe</span>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as Sex)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="male">Homme</option>
            <option value="female">Femme</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Age</span>
          <input
            type="number"
            min={14}
            max={90}
            value={age}
            onChange={(e) => setAge(Number(e.target.value) || 30)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Taille (cm)</span>
          <input
            type="number"
            min={130}
            max={230}
            value={heightCm}
            onChange={(e) => setHeightCm(Number(e.target.value) || 175)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Poids (kg)</span>
          <input
            type="number"
            min={35}
            max={220}
            value={weightKg}
            onChange={(e) => setWeightKg(Number(e.target.value) || 75)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Activite</span>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as Activity)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="sedentary">Sedentaire</option>
            <option value="light">Legere</option>
            <option value="moderate">Moderee</option>
            <option value="high">Elevee</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Objectif</span>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as Goal)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="lose">Perte de poids</option>
            <option value="maintain">Maintien</option>
            <option value="gain">Prise de masse</option>
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
        <div className="font-semibold">Objectifs proposes</div>
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {goals.daily_calorie_goal} kcal • P {goals.daily_protein_goal}g • G {goals.daily_carbs_goal}g • L{" "}
          {goals.daily_fat_goal}g
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const supabase = supabaseBrowser();
              const { error } = await supabase.from("profiles").update(goals).eq("id", userId);
              if (error) throw error;
              window.localStorage.setItem(`onboarding:v2:${userId}`, "done");
              toast.success("Objectifs personnalises enregistres");
              onDone();
            } catch (err) {
              toast.error(toUserErrorMessage(err, "Erreur onboarding"));
            } finally {
              setSaving(false);
            }
          }}
        >
          Appliquer ces objectifs
        </Button>
      </div>
    </Card>
  );
}
