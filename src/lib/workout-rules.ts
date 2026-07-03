import { supabase } from "@/integrations/supabase/client";

export type Goal = "lose_weight" | "gain_muscle" | "fitness" | "tone";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high";
export type Equipment = "home" | "gym" | "none";

export interface FitnessInput {
  goal: Goal;
  activity_level: ActivityLevel;
  equipment: Equipment;
  frequency: number;
}

/**
 * Deterministic workout matcher.
 * Priority: exact equipment + goal → same goal any equipment → fitness fallback.
 */
export async function matchWorkoutPlan(input: FitnessInput) {
  const { data: all, error } = await supabase.from("workouts").select("*");
  if (error) throw error;
  if (!all || all.length === 0) return null;

  const activityRank = { sedentary: 0, light: 1, moderate: 2, high: 3 } as const;
  const target = activityRank[input.activity_level];

  const scored = all.map((w) => {
    let score = 0;
    if (w.goal === input.goal) score += 100;
    if (w.equipment === input.equipment) score += 50;
    if (w.equipment === "none") score += 10;
    if (w.min_frequency <= input.frequency) score += 20;
    const wLevel = activityRank[w.activity_level as ActivityLevel];
    score -= Math.abs(wLevel - target) * 5;
    return { w, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].w;
}

export function calcBMI(heightCm: number, weightKg: number) {
  const h = heightCm / 100;
  return +(weightKg / (h * h)).toFixed(1);
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "نحافة";
  if (bmi < 25) return "وزن طبيعي";
  if (bmi < 30) return "زيادة وزن";
  return "سمنة";
}

export const GOAL_LABELS: Record<Goal, string> = {
  lose_weight: "تنحيف",
  gain_muscle: "تضخيم",
  fitness: "لياقة عامة",
  tone: "شد الجسم",
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "خامل",
  light: "نشاط خفيف",
  moderate: "نشاط متوسط",
  high: "نشاط عالي",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  home: "معدات منزلية",
  gym: "نادي رياضي",
  none: "بدون معدات",
};
