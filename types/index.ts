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
