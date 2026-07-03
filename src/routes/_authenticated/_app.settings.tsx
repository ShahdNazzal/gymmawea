import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { matchWorkoutPlan, calcBMI, GOAL_LABELS, ACTIVITY_LABELS, EQUIPMENT_LABELS, type Goal, type ActivityLevel, type Equipment } from "@/lib/workout-rules";
import { calcCalories, matchNutritionPlan } from "@/lib/nutrition-rules";
import { ArrowRight, Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — جمّاوية" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [fp, setFp] = useState<any>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const d = localStorage.getItem("theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    if (!user || role !== "user") return;
    supabase.from("user_fitness_profile").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setFp(data));
  }, [user, role]);

  const toggleDark = (v: boolean) => {
    setDark(v);
    localStorage.setItem("theme", v ? "dark" : "light");
    document.documentElement.classList.toggle("dark", v);
  };

  const save = async () => {
    if (!fp || !user) return;
    const bmi = calcBMI(fp.height, fp.weight);
    await supabase.from("user_fitness_profile").upsert({ ...fp, user_id: user.id, bmi });
    // Re-run rule matching
    const workout = await matchWorkoutPlan({ goal: fp.goal, activity_level: fp.activity_level, equipment: fp.equipment, frequency: fp.frequency });
    const calories = calcCalories({ weightKg: fp.weight, heightCm: fp.height, age: fp.age, activity: fp.activity_level, goal: fp.goal });
    const nutrition = await matchNutritionPlan(fp.goal, calories);
    if (workout && nutrition) {
      const { data: cur } = await supabase.from("active_plan_selection").select("*").eq("user_id", user.id).maybeSingle();
      await supabase.from("active_plan_selection").upsert({
        user_id: user.id,
        workout_plan_type: cur?.workout_plan_type ?? "trainer",
        workout_plan_id: cur?.workout_plan_type === "personal" ? cur.workout_plan_id : workout.id,
        nutrition_plan_type: cur?.nutrition_plan_type ?? "trainer",
        nutrition_plan_id: cur?.nutrition_plan_type === "personal" ? cur.nutrition_plan_id : nutrition.id,
      });
    }
    toast.success("تم التحديث وإعادة مطابقة خطتك");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/profile" })} className="rounded-xl"><ArrowRight className="w-5 h-5" /></Button>
        <h1 className="text-2xl font-extrabold">الإعدادات</h1>
      </div>

      <Card className="p-5 rounded-3xl flex items-center justify-between">
        <div>
          <div className="font-bold">الوضع الليلي</div>
          <div className="text-xs text-muted-foreground">تبديل بين الوضع الفاتح والداكن</div>
        </div>
        <div className="flex items-center gap-2">
          {dark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          <Switch checked={dark} onCheckedChange={toggleDark} />
        </div>
      </Card>

      {role === "user" && fp && (
        <Card className="p-5 rounded-3xl space-y-3">
          <div className="font-bold">بيانات اللياقة</div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>الوزن</Label><Input type="number" value={fp.weight} onChange={(e) => setFp({ ...fp, weight: +e.target.value })} className="rounded-xl mt-1" /></div>
            <div><Label>الطول</Label><Input type="number" value={fp.height} onChange={(e) => setFp({ ...fp, height: +e.target.value })} className="rounded-xl mt-1" /></div>
            <div><Label>العمر</Label><Input type="number" value={fp.age} onChange={(e) => setFp({ ...fp, age: +e.target.value })} className="rounded-xl mt-1" /></div>
          </div>
          <div>
            <Label>الهدف</Label>
            <select value={fp.goal} onChange={(e) => setFp({ ...fp, goal: e.target.value as Goal })} className="w-full mt-1 h-11 rounded-xl border border-input bg-background px-3 text-sm">
              {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
            </select>
          </div>
          <div>
            <Label>مستوى النشاط</Label>
            <select value={fp.activity_level} onChange={(e) => setFp({ ...fp, activity_level: e.target.value as ActivityLevel })} className="w-full mt-1 h-11 rounded-xl border border-input bg-background px-3 text-sm">
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
            </select>
          </div>
          <div>
            <Label>المعدات</Label>
            <select value={fp.equipment} onChange={(e) => setFp({ ...fp, equipment: e.target.value as Equipment })} className="w-full mt-1 h-11 rounded-xl border border-input bg-background px-3 text-sm">
              {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => <option key={k} value={k}>{EQUIPMENT_LABELS[k]}</option>)}
            </select>
          </div>
          <div>
            <Label>عدد أيام التمرين أسبوعياً</Label>
            <Input type="number" min={1} max={7} value={fp.frequency} onChange={(e) => setFp({ ...fp, frequency: +e.target.value })} className="rounded-xl mt-1" />
          </div>
          <Button onClick={save} className="w-full rounded-2xl gradient-primary">حفظ وإعادة مطابقة الخطة</Button>
        </Card>
      )}
    </div>
  );
}
