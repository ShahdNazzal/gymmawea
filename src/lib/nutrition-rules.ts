import { supabase } from "@/integrations/supabase/client";
import type { Goal, ActivityLevel } from "./workout-rules";

/** Mifflin-St Jeor for women, then activity multiplier, then goal adjust. */
export function calcCalories(opts: {
  weightKg: number;
  heightCm: number;
  age: number;
  activity: ActivityLevel;
  goal: Goal;
}): number {
  const bmr = 10 * opts.weightKg + 6.25 * opts.heightCm - 5 * opts.age - 161;
  const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }[opts.activity];
  let tdee = bmr * mult;
  if (opts.goal === "lose_weight") tdee -= 400;
  if (opts.goal === "gain_muscle") tdee += 350;
  if (opts.goal === "tone") tdee -= 150;
  return Math.round(tdee);
}

export async function matchNutritionPlan(goal: Goal, calories: number) {
  const { data, error } = await supabase.from("nutrition_plans").select("*").eq("goal", goal);
  if (error) throw error;
  if (!data || data.length === 0) {
    const { data: any } = await supabase.from("nutrition_plans").select("*").limit(1);
    return any?.[0] ?? null;
  }
  const inRange = data.find((p) => calories >= p.min_calories && calories <= p.max_calories);
  if (inRange) return inRange;
  return data.sort(
    (a, b) => Math.abs((a.min_calories + a.max_calories) / 2 - calories) - Math.abs((b.min_calories + b.max_calories) / 2 - calories)
  )[0];
}
