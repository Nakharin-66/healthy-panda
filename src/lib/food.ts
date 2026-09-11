import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { FoodLogSource } from "@/types/food";

export type FoodItem = Tables<"food_items">;
export type FoodLogRow = Tables<"food_logs">;
export type MealType = FoodLogRow["meal_type"];

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "มื้อเช้า",
  lunch: "มื้อกลางวัน",
  dinner: "มื้อเย็น",
  snack: "ของว่าง",
};

export function guessMealType(date = new Date()): MealType {
  const h = date.getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export const QUICK_PORTIONS = [0.5, 1, 1.5, 2];

export function portionLabel(qty: number) {
  if (qty === 0.5) return "½";
  if (qty === 1.5) return "1½";
  if (qty === 2.5) return "2½";
  return String(qty);
}

export interface Nutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
}

function round(n: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Scales a food item's per-serving nutrition to the eaten portion. */
export function scaleNutrition(item: FoodItem, quantity: number): Nutrition {
  const servings = item.serving_size > 0 ? quantity / Number(item.serving_size) : quantity;
  return {
    calories: Math.round(Number(item.calories) * servings),
    protein_g: round(Number(item.protein_g) * servings),
    carbs_g: round(Number(item.carbs_g) * servings),
    fat_g: round(Number(item.fat_g) * servings),
    fiber_g: round(Number(item.fiber_g) * servings),
    sodium_mg: Math.round(Number(item.sodium_mg) * servings),
  };
}

export function unitOptions(item: FoodItem): string[] {
  const units = (item.supported_units ?? []).filter(Boolean);
  return units.includes(item.serving_unit) ? units : [item.serving_unit, ...units];
}

/** Categories come from the database, never a hard-coded menu list. */
export function useFoodCategories() {
  return useQuery({
    queryKey: ["food_categories"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("food_items").select("category");
      if (error) throw error;
      const seen = new Map<string, number>();
      for (const row of data ?? []) seen.set(row.category, (seen.get(row.category) ?? 0) + 1);
      return [...seen.entries()].map(([category, count]) => ({ category, count }));
    },
  });
}

export function useFoodSearch(term: string, category: string | null) {
  const q = term.trim();
  return useQuery({
    queryKey: ["food_items", q, category],
    staleTime: 60_000,
    queryFn: async () => {
      let query = supabase
        .from("food_items")
        .select("*")
        .order("name_th", { ascending: true })
        .limit(60);
      if (category) query = query.eq("category", category);
      if (q) query = query.or(`name_th.ilike.%${q}%,name_en.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFoodItem(id?: string | null) {
  return useQuery({
    queryKey: ["food_item", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export interface SaveFoodLogInput {
  food_item_id?: string | null;
  food_name: string;
  meal_type: MealType;
  serving_quantity: number;
  serving_unit: string;
  nutrition: Nutrition;
  source: FoodLogSource;
  source_reference: string;
  ai_confidence?: number | null;
  image_url?: string | null;
  recorded_at?: string;
}

function toRow(input: SaveFoodLogInput) {
  return {
    food_item_id: input.food_item_id ?? null,
    food_name: input.food_name,
    meal_type: input.meal_type,
    serving_quantity: input.serving_quantity,
    serving_unit: input.serving_unit,
    calories: input.nutrition.calories,
    protein_g: input.nutrition.protein_g,
    carbohydrates_g: input.nutrition.carbs_g,
    fat_g: input.nutrition.fat_g,
    fiber_g: input.nutrition.fiber_g,
    sodium_mg: input.nutrition.sodium_mg,
    source: input.source,
    source_reference: input.source_reference,
    ai_confidence: input.ai_confidence ?? null,
    image_url: input.image_url ?? null,
    ...(input.recorded_at ? { recorded_at: input.recorded_at } : {}),
  };
}

function useFoodInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["food_logs"] });
    qc.invalidateQueries({ queryKey: ["food_history"] });
    qc.invalidateQueries({ queryKey: ["scan_history"] });
  };
}

export function useSaveFoodLogs(profileId?: string) {
  const invalidate = useFoodInvalidate();
  return useMutation({
    mutationFn: async (entries: SaveFoodLogInput[]) => {
      if (!profileId) throw new Error("no profile");
      if (entries.length === 0) throw new Error("empty");
      const { error } = await supabase
        .from("food_logs")
        .insert(entries.map((e) => ({ profile_id: profileId, ...toRow(e) })));
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateFoodLog() {
  const invalidate = useFoodInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SaveFoodLogInput }) => {
      const { error } = await supabase.from("food_logs").update(toRow(patch)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteFoodLog() {
  const invalidate = useFoodInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("food_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export interface DayGroup {
  date: string;
  total: Nutrition;
  meals: { meal: MealType; logs: FoodLogRow[]; calories: number }[];
}

export function useFoodHistory(profileId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["food_history", profileId, from, to],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_logs")
        .select("*")
        .eq("profile_id", profileId!)
        .gte("recorded_at", `${from}T00:00:00`)
        .lte("recorded_at", `${to}T23:59:59.999`)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return groupByDay(data ?? []);
    },
  });
}

export function groupByDay(logs: FoodLogRow[]): DayGroup[] {
  const byDate = new Map<string, FoodLogRow[]>();
  for (const log of logs) {
    const key = log.recorded_at.slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), log]);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dayLogs]) => ({
      date,
      total: dayLogs.reduce<Nutrition>(
        (acc, l) => ({
          calories: acc.calories + Number(l.calories),
          protein_g: round(acc.protein_g + Number(l.protein_g)),
          carbs_g: round(acc.carbs_g + Number(l.carbohydrates_g)),
          fat_g: round(acc.fat_g + Number(l.fat_g)),
          fiber_g: round(acc.fiber_g + Number(l.fiber_g ?? 0)),
          sodium_mg: acc.sodium_mg + Number(l.sodium_mg ?? 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 },
      ),
      meals: MEAL_ORDER.map((meal) => {
        const mealLogs = dayLogs.filter((l) => l.meal_type === meal);
        return {
          meal,
          logs: mealLogs,
          calories: mealLogs.reduce((s, l) => s + Number(l.calories), 0),
        };
      }).filter((m) => m.logs.length > 0),
    }));
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function rangeFor(preset: "today" | "7d" | "30d") {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 6);
  if (preset === "30d") from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}
