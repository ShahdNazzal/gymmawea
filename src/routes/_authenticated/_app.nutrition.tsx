import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Apple, Plus, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/_app/nutrition")({
  head: () => ({ meta: [{ title: "التغذية — جمّاوية" }] }),
  component: NutritionPage,
});

function NutritionPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<any>(null);
  const [trainerPlan, setTrainerPlan] = useState<any>(null);
  const [personal, setPersonal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: sel } = await supabase.from("active_plan_selection").select("*").eq("user_id", user.id).maybeSingle();
    setActive(sel);
    if (sel?.nutrition_plan_type === "trainer" && sel?.nutrition_plan_id) {
      const { data } = await supabase.from("nutrition_plans").select("*").eq("id", sel.nutrition_plan_id).maybeSingle();
      setTrainerPlan(data);
    }
    const { data: up } = await supabase.from("user_nutrition_plans").select("*").eq("user_id", user.id);
    setPersonal(up ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const currentType = active?.nutrition_plan_type;
  const activePersonal = personal.find((p) => p.id === active?.nutrition_plan_id);

  const [browseOpen, setBrowseOpen] = useState(false);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">تغذيتك</h1>

      <div className="glass p-3 rounded-2xl flex items-center justify-between text-sm">
        <span className="font-semibold">
          الخطة النشطة: {currentType === "trainer" ? "مدربة" : currentType === "personal" ? "شخصية" : "—"}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setBrowseOpen(true)} className="rounded-xl text-primary">
          خطط المدربات
        </Button>
      </div>

      {loading && <Skeleton className="h-40 rounded-3xl" />}

      {!loading && currentType === "trainer" && trainerPlan && <MealsView plan={trainerPlan} userId={user!.id} sourceType="trainer" sourceId={trainerPlan.id} />}
      {!loading && currentType === "personal" && activePersonal && <MealsView plan={activePersonal} userId={user!.id} sourceType="personal" sourceId={activePersonal.id} />}

      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">خططي الشخصية</h2>
          <Button size="sm" onClick={() => setNewOpen(true)} className="rounded-xl gradient-primary">
            <Plus className="w-4 h-4 ml-1" /> إنشاء
          </Button>
        </div>
        {personal.length === 0 && (
          <Card className="p-6 text-center rounded-2xl border-dashed">
            <Apple className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد خطط شخصية</p>
          </Card>
        )}
        <div className="grid gap-2">
          {personal.map((p) => (
            <Card key={p.id} className="p-4 rounded-2xl flex items-center justify-between">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{(p.meals ?? []).length} وجبات</div>
              </div>
              <Button
                size="sm"
                variant={active?.nutrition_plan_id === p.id ? "default" : "outline"}
                onClick={async () => {
                  await supabase.from("active_plan_selection").upsert({
                    user_id: user!.id,
                    nutrition_plan_type: "personal",
                    nutrition_plan_id: p.id,
                    workout_plan_type: active?.workout_plan_type,
                    workout_plan_id: active?.workout_plan_id,
                  });
                  toast.success("تم التفعيل");
                  load();
                }}
                className="rounded-xl"
              >
                {active?.nutrition_plan_id === p.id ? "نشطة" : "تفعيل"}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <NewNutritionDialog open={newOpen} onClose={() => setNewOpen(false)} userId={user?.id ?? ""} onSaved={load} />
      <BrowseTrainerNutritionDialog
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        userId={user?.id ?? ""}
        activeId={active?.nutrition_plan_id}
        currentSelection={active}
        onAdopted={() => { setBrowseOpen(false); load(); }}
      />
    </div>
  );
}

function MealsView({ plan, userId, sourceType, sourceId }: any) {
  return (
    <div className="space-y-3">
      <Card className="p-5 rounded-3xl gradient-blush border-none">
        <h2 className="text-xl font-extrabold">{plan.name}</h2>
        {plan.description && <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>}
      </Card>
      {(plan.meals ?? []).map((m: any, i: number) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
          <MealRow meal={m} userId={userId} sourceType={sourceType} sourceId={sourceId} />
        </motion.div>
      ))}
    </div>
  );
}

function MealRow({ meal, userId, sourceType, sourceId }: any) {
  const [done, setDone] = useState(false);
  return (
    <Card className="p-4 rounded-2xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={async () => {
            await supabase.from("meal_logs").insert({
              user_id: userId,
              source_type: sourceType,
              source_id: sourceId,
              meal_name: meal.name,
              calories: meal.calories,
            });
            setDone(true);
            toast.success("تم تسجيل الوجبة");
          }}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${done ? "gradient-primary border-primary" : "border-border"}`}
        >
          {done && <CheckCircle2 className="w-5 h-5 text-primary-foreground" />}
        </button>
        <div>
          <div className="text-xs text-primary font-bold">{meal.meal}</div>
          <div className={`font-semibold text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{meal.name}</div>
        </div>
      </div>
      {meal.calories && <span className="text-xs font-bold bg-secondary px-2 py-1 rounded-full">{meal.calories} سعرة</span>}
    </Card>
  );
}

function NewNutritionDialog({ open, onClose, userId, onSaved }: any) {
  const [name, setName] = useState("");
  const [meals, setMeals] = useState<any[]>([{ meal: "فطور", name: "", calories: 0 }]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>خطة تغذية شخصية</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم الخطة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div className="space-y-2">
            {meals.map((m, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_70px_auto] gap-2 items-center">
                <Input value={m.meal} onChange={(e) => { const c = [...meals]; c[i].meal = e.target.value; setMeals(c); }} className="rounded-xl" placeholder="نوع" />
                <Input value={m.name} onChange={(e) => { const c = [...meals]; c[i].name = e.target.value; setMeals(c); }} className="rounded-xl" placeholder="الوجبة" />
                <Input type="number" value={m.calories} onChange={(e) => { const c = [...meals]; c[i].calories = +e.target.value; setMeals(c); }} className="rounded-xl text-center" placeholder="سعرات" />
                <button onClick={() => setMeals(meals.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setMeals([...meals, { meal: "سناك", name: "", calories: 0 }])} className="rounded-xl w-full">
              <Plus className="w-4 h-4 ml-1" /> إضافة وجبة
            </Button>
          </div>
          <Button onClick={async () => {
            if (!name) return toast.error("اكتبي اسم الخطة");
            await supabase.from("user_nutrition_plans").insert({ user_id: userId, name, meals: meals.filter(m => m.name) });
            toast.success("تم الحفظ"); onClose(); onSaved();
            setName(""); setMeals([{ meal: "فطور", name: "", calories: 0 }]);
          }} className="w-full rounded-2xl gradient-primary">حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BrowseTrainerNutritionDialog({ open, onClose, userId, activeId, currentSelection, onAdopted }: any) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("nutrition_plans")
      .select("*")
      .select("*").eq("is_public", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setPlans(data ?? []); setLoading(false); });
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>خطط تغذية من المدربات</DialogTitle></DialogHeader>
        {loading && <Skeleton className="h-24 rounded-2xl" />}
        {!loading && plans.length === 0 && (
          <Card className="p-6 text-center rounded-2xl border-dashed">
            <Apple className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد خطط منشورة بعد</p>
          </Card>
        )}
        <div className="grid gap-2">
          {plans.map((p) => (
            <Card key={p.id} className="p-3 rounded-2xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.min_calories}–{p.max_calories} سعرة • {(Array.isArray(p.meals) ? p.meals : []).length} وجبات
                </div>
              </div>
              <Button
                size="sm"
                variant={activeId === p.id ? "default" : "outline"}
                onClick={async () => {
                  await supabase.from("active_plan_selection").upsert({
                    user_id: userId,
                    nutrition_plan_type: "trainer",
                    nutrition_plan_id: p.id,
                    workout_plan_type: currentSelection?.workout_plan_type,
                    workout_plan_id: currentSelection?.workout_plan_id,
                  });
                  toast.success("تم اعتماد الخطة");
                  onAdopted();
                }}
                className="rounded-xl shrink-0"
              >
                {activeId === p.id ? "نشطة" : "اعتماد"}
              </Button>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
