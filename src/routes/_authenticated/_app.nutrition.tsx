import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Apple, Plus, CheckCircle2, X, Droplets, Flame, Dumbbell,
  Play, Youtube, Pencil, Trash2, PartyPopper, ChevronLeft, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/_app/nutrition")({
  head: () => ({ meta: [{ title: "التغذية — جمّاوية" }] }),
  component: NutritionPage,
});

// ================== أدوات مساعدة عامة ==================

// نستخرج معرف فيديو اليوتيوب من أي شكل رابط (watch / youtu.be / shorts / embed)
function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// جدول "recipes" جديد ومش موجود بعد بملف الأنواع المولّد تلقائياً (types.ts) تبع Supabase،
// فبنعمل تحويل بسيط هون بدل ما نكرر "as any" بكل سطر. أفضل حل دائم هو تحديث types.ts
// عن طريق: npx supabase gen types typescript --project-id <PROJECT_ID> --schema public
// وبعدها فيكِ تشيلي هالسطر وترجعي تستخدمي supabase.from("recipes") العادي.
const recipesTable = () => (supabase as any).from("recipes");

// نفس فكرة recipesTable: عمود "protein" جديد بجدول meal_logs الموجود أصلاً، ومش موجود
// بملف الأنواع القديم، فبنعمل bypass بسيط هون بدل ما نحتاج نحدّث types.ts من الطرفية
const mealLogsTable = () => (supabase as any).from("meal_logs");

// نحسب احتياج المستخدمة اليومي من السعرات والبروتين اعتماداً على بياناتها وهدفها
// (معادلة Mifflin-St Jeor، مبنية على إنه جمهور التطبيق نساء)
type NutritionTargets = {
  calorieTarget: number;
  proteinTarget: number;
  showCalories: boolean;
  goalLabel: string;
};

function calcNutritionTargets(fp: any): NutritionTargets | null {
  if (!fp?.weight || !fp?.height) return null;

  const weight = Number(fp.weight);
  const height = Number(fp.height);
  const age = Number(fp.age) || 25;
  const freq = Number(fp.frequency) || 3;
  const goal = String(fp.goal || "").toLowerCase();

  const bmr = 10 * weight + 6.25 * height - 5 * age - 161;

  let activityMultiplier = 1.2;
  if (freq >= 6) activityMultiplier = 1.725;
  else if (freq >= 4) activityMultiplier = 1.55;
  else if (freq >= 2) activityMultiplier = 1.375;

  const tdee = bmr * activityMultiplier;

  const isBulk = /gain|bulk|تضخيم|زياد/.test(goal);
  const isLean = /lean|تنشيف|recomp/.test(goal);
  const isLose = /lose|تنحيف|فقدان|خسار/.test(goal);

  let calorieTarget = tdee;
  let proteinPerKg = 1.8;
  let goalLabel = "الحفاظ على الوزن";

  if (isBulk) {
    calorieTarget = tdee + 300;
    proteinPerKg = 2.0;
    goalLabel = "تضخيم";
  } else if (isLean) {
    calorieTarget = tdee - 300;
    proteinPerKg = 2.4;
    goalLabel = "تنشيف";
  } else if (isLose) {
    calorieTarget = tdee - 500;
    proteinPerKg = 2.2;
    goalLabel = "تنحيف";
  }

  // البروتين هو الأساس دايماً لأنه مرتبط ببناء العضلات والحفاظ عليها بغض النظر عن هدفك
  // أما السعرات فهي تقديرية وبتختلف كثير حسب نشاطك الفعلي بالتمرين، فبنعرضها كخانة ثانوية إرشادية
  return {
    calorieTarget: Math.max(1200, Math.round(calorieTarget)),
    proteinTarget: Math.round(weight * proteinPerKg),
    showCalories: true,
    goalLabel,
  };
}

// ================== بالونات احتفال عند تحقيق هدف البروتين ==================

function ProteinCelebration({ triggerKey }: { triggerKey: number }) {
  const colors = ["#ff6b9d", "#c06fdb", "#6bc5ff", "#ffd166", "#8affa0"];
  const balloons = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: 4 + Math.random() * 92,
    delay: Math.random() * 0.5,
    duration: 2.6 + Math.random() * 1.4,
    color: colors[i % colors.length],
    size: 26 + Math.random() * 18,
  }));

  if (!triggerKey) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {balloons.map((b) => (
        <motion.div
          key={`${triggerKey}-${b.id}`}
          initial={{ y: "110vh", opacity: 0 }}
          animate={{ y: "-20vh", opacity: [0, 1, 1, 0] }}
          transition={{ duration: b.duration, delay: b.delay, ease: "easeOut" }}
          style={{ left: `${b.left}%`, width: b.size, height: b.size * 1.25, background: b.color }}
          className="absolute rounded-[50%_50%_50%_50%/40%_40%_60%_60%] shadow-lg"
        >
          <div
            className="absolute left-1/2 top-full -translate-x-1/2 w-px h-6"
            style={{ background: b.color }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ================== شريط تقدّم (سعرات / بروتين) ==================

function NutrientBar({
  icon,
  label,
  consumed,
  target,
  unit,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  consumed: number;
  target: number;
  unit: string;
  colorClass: string;
}) {
  const remaining = Math.max(0, target - consumed);
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const done = remaining === 0 && target > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold">
          {icon}
          {label}
        </div>
        <div className={`font-semibold ${done ? "text-primary" : "text-muted-foreground"}`}>
          {done ? "تم تحقيق الهدف 🎉" : `متبقي ${Math.round(remaining)} ${unit}`}
        </div>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${colorClass}`}
        />
      </div>
      <div className="text-[10px] text-muted-foreground">
        {Math.round(consumed)} / {Math.round(target)} {unit}
      </div>
    </div>
  );
}

// ================== الصفحة الرئيسية ==================

function NutritionPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<any>(null);
  const [trainerPlan, setTrainerPlan] = useState<any>(null);
  const [personal, setPersonal] = useState<any[]>([]);
  const [fp, setFp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  const [todayCalories, setTodayCalories] = useState(0);
  const [todayProtein, setTodayProtein] = useState(0);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const proteinGoalReachedRef = useRef(false);

  const load = async () => {
    if (!user) return;
    const [{ data: sel }, { data: profileFp }, { data: logs }] = await Promise.all([
      supabase.from("active_plan_selection").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_fitness_profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("meal_logs").select("*").eq("user_id", user.id).gte("created_at", startOfTodayISO()),
    ]);
    setActive(sel);
    setFp(profileFp);

    const calSum = (logs ?? []).reduce((s, l: any) => s + (Number(l.calories) || 0), 0);
    const proSum = (logs ?? []).reduce((s, l: any) => s + (Number(l.protein) || 0), 0);
    setTodayCalories(calSum);
    setTodayProtein(proSum);

    if (sel?.nutrition_plan_type === "trainer" && sel?.nutrition_plan_id) {
      const { data } = await supabase.from("nutrition_plans").select("*").eq("id", sel.nutrition_plan_id).maybeSingle();
      setTrainerPlan(data);
    } else {
      setTrainerPlan(null);
    }
    const { data: up } = await supabase.from("user_nutrition_plans").select("*").eq("user_id", user.id);
    setPersonal(up ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const targets = calcNutritionTargets(fp);

  // نتابع لما البروتين يوصل للهدف عشان نطلق الاحتفال مرة وحدة بس لكل مرة توصل فيها الهدف
  useEffect(() => {
    if (!targets) return;
    const reached = targets.proteinTarget > 0 && todayProtein >= targets.proteinTarget;
    if (reached && !proteinGoalReachedRef.current) {
      proteinGoalReachedRef.current = true;
      setCelebrationKey(Date.now());
      toast.success("ممتازة! وصلتِ لهدف البروتين اليوم 🎈");
    }
    if (!reached) {
      proteinGoalReachedRef.current = false;
    }
  }, [todayProtein, targets?.proteinTarget]);

  // بيتنادى من MealRow فور تسجيل وجبة، عشان الشريط يتحدث فوراً بدون انتظار إعادة التحميل
  const onMealLogged = (calories: number, protein: number) => {
    setTodayCalories((c) => c + (Number(calories) || 0));
    setTodayProtein((p) => p + (Number(protein) || 0));
  };

  const currentType = active?.nutrition_plan_type;
  const activePersonal = personal.find((p) => p.id === active?.nutrition_plan_id);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">تغذيتك</h1>

      {/* بطاقة الهدف اليومي: سعرات + بروتين + تذكير المي */}
      {!loading && targets && (
        <Card className="p-5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">هدفك اليوم ({targets.goalLabel})</div>
            <div className="flex items-center gap-1.5 text-[11px] text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full">
              <Droplets className="w-3.5 h-3.5" />
              اشربي مي طول اليوم 💧
            </div>
          </div>

          <NutrientBar
            icon={<Dumbbell className="w-3.5 h-3.5 text-primary" />}
            label="البروتين"
            consumed={todayProtein}
            target={targets.proteinTarget}
            unit="غ"
            colorClass="gradient-primary"
          />

          {targets.showCalories && (
            <div>
              <NutrientBar
                icon={<Flame className="w-3.5 h-3.5 text-orange-500" />}
                label="السعرات"
                consumed={todayCalories}
                target={targets.calorieTarget}
                unit="سعرة"
                colorClass="bg-orange-400"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                * رقم السعرات تقديري وقد يتغيّر حسب نشاطك وتمارينك اليومية، ركّزي بشكل أساسي على تحقيق هدف البروتين
              </p>
            </div>
          )}
        </Card>
      )}

      {!loading && !targets && (
        <Card className="p-4 rounded-2xl border-dashed text-center text-xs text-muted-foreground">
          أكملي بياناتك الجسدية (الوزن والطول) من صفحة ملفك عشان نحسبلك احتياجك اليومي من السعرات والبروتين بدقة
        </Card>
      )}

      <div className="glass p-3 rounded-2xl flex items-center justify-between text-sm">
        <span className="font-semibold">
          الخطة النشطة: {currentType === "trainer" ? "مدربة" : currentType === "personal" ? "شخصية" : "—"}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setBrowseOpen(true)} className="rounded-xl text-primary">
          خطط المدربات
        </Button>
      </div>

      {loading && <Skeleton className="h-40 rounded-3xl" />}

      {!loading && currentType === "trainer" && trainerPlan && (
        <MealsView plan={trainerPlan} userId={user!.id} sourceType="trainer" sourceId={trainerPlan.id} onLogged={onMealLogged} />
      )}
      {!loading && currentType === "personal" && activePersonal && (
        <MealsView plan={activePersonal} userId={user!.id} sourceType="personal" sourceId={activePersonal.id} onLogged={onMealLogged} />
      )}

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

      {/* قسم الوصفات الغذائية */}
      <RecipesSection />

      <NewNutritionDialog open={newOpen} onClose={() => setNewOpen(false)} userId={user?.id ?? ""} onSaved={load} />
      <BrowseTrainerNutritionDialog
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        userId={user?.id ?? ""}
        activeId={active?.nutrition_plan_id}
        currentSelection={active}
        onAdopted={() => { setBrowseOpen(false); load(); }}
      />

      <ProteinCelebration triggerKey={celebrationKey} />
    </div>
  );
}

// ================== عرض خطة الوجبات المعتمدة ==================

function MealsView({ plan, userId, sourceType, sourceId, onLogged }: any) {
  return (
    <div className="space-y-3">
      <Card className="p-5 rounded-3xl gradient-blush border-none">
        <h2 className="text-xl font-extrabold">{plan.name}</h2>
        {plan.description && <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>}
      </Card>
      {(plan.meals ?? []).map((m: any, i: number) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
          <MealRow meal={m} userId={userId} sourceType={sourceType} sourceId={sourceId} onLogged={onLogged} />
        </motion.div>
      ))}
    </div>
  );
}

function MealRow({ meal, userId, sourceType, sourceId, onLogged }: any) {
  const [done, setDone] = useState(false);
  return (
    <Card className="p-4 rounded-2xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          disabled={done}
          onClick={async () => {
            const protein = Number(meal.protein) || 0;
            const calories = Number(meal.calories) || 0;
            await mealLogsTable().insert({
              user_id: userId,
              source_type: sourceType,
              source_id: sourceId,
              meal_name: meal.name,
              calories,
              protein,
            });
            setDone(true);
            onLogged?.(calories, protein);
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
      <div className="flex flex-col items-end gap-1">
        {meal.calories ? <span className="text-[10px] font-bold bg-secondary px-2 py-0.5 rounded-full">{meal.calories} سعرة</span> : null}
        {meal.protein ? <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{meal.protein} غ بروتين</span> : null}
      </div>
    </Card>
  );
}

function NewNutritionDialog({ open, onClose, userId, onSaved }: any) {
  const [name, setName] = useState("");
  const [meals, setMeals] = useState<any[]>([{ meal: "فطور", name: "", calories: 0, protein: 0 }]);
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
              <div key={i} className="rounded-xl border border-border p-2 space-y-2">
                <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                  <Input value={m.meal} onChange={(e) => { const c = [...meals]; c[i].meal = e.target.value; setMeals(c); }} className="rounded-xl" placeholder="نوع" />
                  <Input value={m.name} onChange={(e) => { const c = [...meals]; c[i].name = e.target.value; setMeals(c); }} className="rounded-xl" placeholder="الوجبة" />
                  <button onClick={() => setMeals(meals.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                    <Input
                      type="number"
                      value={m.calories}
                      onChange={(e) => { const c = [...meals]; c[i].calories = +e.target.value; setMeals(c); }}
                      className="rounded-xl text-center h-9"
                      placeholder="سعرات"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-primary shrink-0" />
                    <Input
                      type="number"
                      value={m.protein}
                      onChange={(e) => { const c = [...meals]; c[i].protein = +e.target.value; setMeals(c); }}
                      className="rounded-xl text-center h-9"
                      placeholder="بروتين (غ)"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setMeals([...meals, { meal: "سناك", name: "", calories: 0, protein: 0 }])} className="rounded-xl w-full">
              <Plus className="w-4 h-4 ml-1" /> إضافة وجبة
            </Button>
          </div>
          <Button onClick={async () => {
            if (!name) return toast.error("اكتبي اسم الخطة");
            await supabase.from("user_nutrition_plans").insert({ user_id: userId, name, meals: meals.filter(m => m.name) });
            toast.success("تم الحفظ"); onClose(); onSaved();
            setName(""); setMeals([{ meal: "فطور", name: "", calories: 0, protein: 0 }]);
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
      .eq("is_public", true)
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

// ================== قسم الوصفات الغذائية ==================

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein: number | null;
  category: string | null;
  image_url: string | null;
  video_url: string | null;
};

function RecipeVideoDialog({ open, onClose, youtubeId, title }: { open: boolean; onClose: () => void; youtubeId: string | null; title: string }) {
  if (!youtubeId) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-w-lg p-0 overflow-hidden">
        <div className="w-full aspect-video bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-4">
          <div className="font-bold text-sm">{title}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// مودال زجاجي لعرض الوصف الكامل للوصفة
function RecipeDescriptionOverlay({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {recipe && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-xl flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass max-w-sm w-full rounded-3xl p-6 space-y-3 border border-white/30 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">{recipe.name}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              {recipe.calories ? (
                <span className="text-[11px] font-bold bg-orange-400/20 text-orange-600 px-2.5 py-1 rounded-full">
                  {recipe.calories} سعرة
                </span>
              ) : null}
              {recipe.protein ? (
                <span className="text-[11px] font-bold bg-primary/15 text-primary px-2.5 py-1 rounded-full">
                  {recipe.protein} غ بروتين
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {recipe.description || "ما في وصف مضاف لهاي الوصفة بعد."}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RecipeCard({
  recipe,
  editorMode,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  editorMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const youtubeId = getYouTubeId(recipe.video_url);
  const thumbnail = recipe.image_url || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : null);

  const shortDesc = recipe.description
    ? recipe.description.length > 70
      ? recipe.description.slice(0, 70).trim() + "..."
      : recipe.description
    : "";

  return (
    <>
      <Card className="w-64 shrink-0 snap-start rounded-2xl overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={() => youtubeId && setVideoOpen(true)}
          className="relative w-full h-32 bg-muted shrink-0"
        >
          {thumbnail ? (
            <img src={thumbnail} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Apple className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          {youtubeId && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="w-4 h-4 fill-primary text-primary" />
              </div>
            </div>
          )}
          {editorMode && (
            <div className="absolute top-1.5 left-1.5 flex gap-1">
              <span
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"
              >
                <Pencil className="w-3.5 h-3.5 text-primary" />
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </span>
            </div>
          )}
        </button>

        <div className="p-3 flex-1 flex flex-col gap-2">
          <div className="font-bold text-sm truncate">{recipe.name}</div>
          <div className="flex gap-1.5">
            {recipe.calories ? (
              <span className="text-[10px] font-bold bg-orange-400/15 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Flame className="w-3 h-3" /> {recipe.calories}
              </span>
            ) : null}
            {recipe.protein ? (
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Dumbbell className="w-3 h-3" /> {recipe.protein}غ
              </span>
            ) : null}
            {recipe.category ? (
              <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {recipe.category}
              </span>
            ) : null}
          </div>
          {shortDesc && (
            <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">{shortDesc}</p>
          )}
          {recipe.description && (
            <button
              onClick={() => setDescOpen(true)}
              className="text-[11px] font-bold text-primary self-start flex items-center gap-0.5"
            >
              عرض المزيد <ChevronLeft className="w-3 h-3" />
            </button>
          )}
        </div>
      </Card>

      <RecipeVideoDialog open={videoOpen} onClose={() => setVideoOpen(false)} youtubeId={youtubeId} title={recipe.name} />
      {descOpen && <RecipeDescriptionOverlay recipe={recipe} onClose={() => setDescOpen(false)} />}
    </>
  );
}

function RecipeEditDialog({
  open,
  onClose,
  recipe,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState<number>(0);
  const [protein, setProtein] = useState<number>(0);
  const [category, setCategory] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(recipe?.name ?? "");
    setDescription(recipe?.description ?? "");
    setCalories(recipe?.calories ?? 0);
    setProtein(recipe?.protein ?? 0);
    setCategory(recipe?.category ?? "");
    setVideoUrl(recipe?.video_url ?? "");
    setImageUrl(recipe?.image_url ?? "");
  }, [open, recipe]);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("اكتبي اسم الوصفة");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        calories: calories || 0,
        protein: protein || 0,
        category: category.trim() || null,
        video_url: videoUrl.trim() || null,
        image_url: imageUrl.trim() || null,
      };
      if (recipe?.id) {
        const { error } = await recipesTable().update(payload).eq("id", recipe.id);
        if (error) throw error;
        toast.success("تم تحديث الوصفة");
      } else {
        const { error } = await recipesTable().insert(payload);
        if (error) throw error;
        toast.success("تم إضافة الوصفة");
      }
      onClose();
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{recipe ? "تعديل الوصفة" : "إضافة وصفة جديدة"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم الوصفة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> السعرات</Label>
              <Input type="number" value={calories} onChange={(e) => setCalories(+e.target.value)} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Dumbbell className="w-3.5 h-3.5" /> البروتين (غ)</Label>
              <Input type="number" value={protein} onChange={(e) => setProtein(+e.target.value)} className="rounded-xl mt-1" />
            </div>
          </div>
          <div>
            <Label>التصنيف (فطور / غداء / عشاء / سناك / مشروب)</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Youtube className="w-3.5 h-3.5" /> رابط فيديو يوتيوب (اختياري)</Label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="rounded-xl mt-1" placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div>
            <Label className="text-xs">رابط صورة مخصصة (اختياري، وإلا رح ناخذ صورة الفيديو تلقائياً)</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label>الوصف الكامل</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl mt-1 min-h-24" />
          </div>
          <Button disabled={saving} onClick={handleSave} className="w-full rounded-2xl gradient-primary">
            {saving ? "جاري الحفظ..." : recipe ? "تحديث الوصفة" : "حفظ الوصفة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecipesSection() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorMode, setEditorMode] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await recipesTable().select("*").order("created_at", { ascending: true });
    if (error) {
      console.error("recipes load error:", error);
      toast.error("تعذّر تحميل الوصفات: " + error.message);
      setRecipes([]);
    } else {
      setRecipes(data ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (recipe: Recipe) => {
    if (!confirm(`حذف وصفة "${recipe.name}"؟`)) return;
    const { error } = await recipesTable().delete().eq("id", recipe.id);
    if (error) return toast.error(error.message);
    toast.success("تم حذف الوصفة");
    load();
  };

  return (
    <div className="pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">وصفات غذائية</h2>
        <button
          onClick={() => setEditorMode((v) => !v)}
          className={`text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition ${
            editorMode ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          {editorMode ? "وضع التعديل مفعّل" : "وضع تعديل الوصفات"}
        </button>
      </div>

      {editorMode && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setEditingRecipe(null); setEditDialogOpen(true); }}
          className="rounded-xl w-full"
        >
          <Plus className="w-4 h-4 ml-1" /> إضافة وصفة جديدة
        </Button>
      )}

      {loading && <Skeleton className="h-48 rounded-2xl" />}

      {!loading && recipes.length === 0 && (
        <Card className="p-6 text-center rounded-2xl border-dashed">
          <Apple className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد وصفات مضافة بعد</p>
        </Card>
      )}

      {!loading && recipes.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              editorMode={editorMode}
              onEdit={() => { setEditingRecipe(r); setEditDialogOpen(true); }}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}

      <RecipeEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        recipe={editingRecipe}
        onSaved={load}
      />
    </div>
  );
}