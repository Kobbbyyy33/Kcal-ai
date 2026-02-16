export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type Profile = {
  id: string;
  email: string | null;
  created_at: string;
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fat_goal: number;
  theme: "light" | "dark";
  budget_per_day: number;
  dietary_preferences: string[];
  allergens: string[];
  goal_mode: "cut" | "maintain" | "bulk";
};

export type Meal = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  meal_type: MealType;
  meal_name: string | null;
  created_at: string;
};

export type FoodItem = {
  id: string;
  meal_id: string;
  name: string;
  quantity: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode: string | null;
  image_url: string | null;
  source: "ai" | "barcode" | "manual";
};

export type MealWithItems = Meal & { food_items: FoodItem[] };

export type MealSuggestion = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  reason: string;
};

export type CoachInsight = {
  headline: string;
  actions: string[];
  motivation: string;
  suggested_meals: MealSuggestion[];
  source: "ai" | "heuristic";
};

export type WeeklyPlanDay = {
  date: string;
  meals: Array<{
    meal_type: MealType;
    name: string;
    quantity: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    estimated_cost: number;
  }>;
  total_kcal: number;
  estimated_cost: number;
};

export type WeeklyPlanResult = {
  budget_per_day: number;
  days: WeeklyPlanDay[];
  shopping_list: Array<{ name: string; quantity: string; estimated_cost: number }>;
};
