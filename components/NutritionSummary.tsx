import { MacroCircle } from "@/components/ui/MacroCircle";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { MacroTotals, Profile } from "@/types";

export function NutritionSummary({
  totals,
  profile
}: {
  totals: MacroTotals;
  profile: Profile;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-medium">Calories</div>
          <div className="text-sm text-gray-600 dark:text-slate-400">
            {Math.round(totals.calories)} / {profile.daily_calorie_goal} kcal
          </div>
        </div>
        <ProgressBar value={totals.calories} max={profile.daily_calorie_goal} className="mt-2" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MacroCircle
          label="Proteines"
          value={totals.protein}
          goal={profile.daily_protein_goal}
          icon="/icons/protein.svg"
          color="#10b981"
        />
        <MacroCircle
          label="Glucides"
          value={totals.carbs}
          goal={profile.daily_carbs_goal}
          icon="/icons/carbs.svg"
          color="#f97316"
        />
        <MacroCircle
          label="Lipides"
          value={totals.fat}
          goal={profile.daily_fat_goal}
          icon="/icons/fat.svg"
          color="#3b82f6"
        />
      </div>
    </div>
  );
}
