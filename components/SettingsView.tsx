"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toUserErrorMessage } from "@/lib/supabase/errors";
import type { Profile } from "@/types";

type GoalForm = {
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fat_goal: number;
};

export function SettingsView() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [email, setEmail] = React.useState<string>("");
  const [goals, setGoals] = React.useState<GoalForm>({
    daily_calorie_goal: 2000,
    daily_protein_goal: 150,
    daily_carbs_goal: 250,
    daily_fat_goal: 65
  });

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
      }
    } catch (err) {
      toast.error(toUserErrorMessage(err, "Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

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

      <Card className="p-4">
        <div className="text-sm font-semibold">Objectifs journaliers</div>
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
                const { error } = await supabase
                  .from("profiles")
                  .update({
                    daily_calorie_goal: goals.daily_calorie_goal,
                    daily_protein_goal: goals.daily_protein_goal,
                    daily_carbs_goal: goals.daily_carbs_goal,
                    daily_fat_goal: goals.daily_fat_goal
                  })
                  .eq("id", user.id);
                if (error) throw error;
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
    </div>
  );
}
