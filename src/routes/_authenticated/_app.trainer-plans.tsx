import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Dumbbell, Apple, Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_LABELS, ACTIVITY_LABELS, EQUIPMENT_LABELS, type Goal, type ActivityLevel, type Equipment } from "@/lib/workout-rules";
import { uploadFile } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/_app/trainer-plans")({
  head: () => ({ meta: [{ title: "خططي كمدربة — جمّاوية" }] }),
  component: TrainerPlansPage,
});

function TrainerPlansPage() {
  const { user, role, loading } = useAuth();
  const [tab, setTab] = useState<"workout" | "nutrition">("workout");
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [nutrition, setNutrition] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [openW, setOpenW] = useState(false);
  const [openN, setOpenN] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoadingData(true);
    const [{ data: w }, { data: n }] = await Promise.all([
      supabase.from("workouts").select("*").eq("trainer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("nutrition_plans").select("*").eq("trainer_id", user.id).order("created_at", { ascending: false }),
    ]);
    setWorkouts(w ?? []);
    setNutrition(n ?? []);
    setLoadingData(false);
  };
  useEffect(() => { load(); }, [user]);

  if (loading) return <Skeleton className="h-40 rounded-3xl" />;
  if (role !== "trainer") {
    return (
      <Card className="p-8 text-center rounded-3xl">
        <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="font-bold mb-1">هذه الصفحة للمدربات فقط</h2>
        <p className="text-sm text-muted-foreground">إذا كنتِ مدربة، تواصلي مع الإدارة لتفعيل حسابك.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">خططي</h1>
        <Button onClick={() => (tab === "workout" ? setOpenW(true) : setOpenN(true))} className="rounded-xl gradient-primary">
          <Plus className="w-4 h-4 ml-1" /> خطة جديدة
        </Button>
      </div>

      <div className="flex gap-2 p-1 bg-muted rounded-2xl">
        <button onClick={() => setTab("workout")} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${tab === "workout" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
          تمارين ({workouts.length})
        </button>
        <button onClick={() => setTab("nutrition")} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${tab === "nutrition" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
          تغذية ({nutrition.length})
        </button>
      </div>

      {loadingData && <Skeleton className="h-40 rounded-3xl" />}

      {!loadingData && tab === "workout" && (
        <div className="grid gap-2">
          {workouts.length === 0 && (
            <Card className="p-6 text-center rounded-2xl border-dashed">
              <Dumbbell className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد خطط تمارين بعد</p>
            </Card>
          )}
          {workouts.map((w) => (
            <Card key={w.id} className="p-4 rounded-2xl">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold">{w.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {GOAL_LABELS[w.goal as Goal]} • {EQUIPMENT_LABELS[w.equipment as Equipment]} • {ACTIVITY_LABELS[w.activity_level as ActivityLevel]}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(Array.isArray(w.exercises) ? w.exercises : []).length} يوم • من {w.min_frequency} أيام/أسبوع
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm("حذف الخطة؟")) return;
                    await supabase.from("workouts").delete().eq("id", w.id);
                    toast.success("تم الحذف");
                    load();
                  }}
                  className="p-2 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loadingData && tab === "nutrition" && (
        <div className="grid gap-2">
          {nutrition.length === 0 && (
            <Card className="p-6 text-center rounded-2xl border-dashed">
              <Apple className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد خطط تغذية بعد</p>
            </Card>
          )}
          {nutrition.map((p) => (
            <Card key={p.id} className="p-4 rounded-2xl">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {GOAL_LABELS[p.goal as Goal]} • {p.min_calories}–{p.max_calories} سعرة
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(Array.isArray(p.meals) ? p.meals : []).length} وجبات
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm("حذف الخطة؟")) return;
                    await supabase.from("nutrition_plans").delete().eq("id", p.id);
                    toast.success("تم الحذف");
                    load();
                  }}
                  className="p-2 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewWorkoutDialog open={openW} onClose={() => setOpenW(false)} trainerId={user?.id ?? ""} onSaved={load} />
      <NewNutritionDialog open={openN} onClose={() => setOpenN(false)} trainerId={user?.id ?? ""} onSaved={load} />
    </div>
  );
}

function NewWorkoutDialog({ open, onClose, trainerId, onSaved }: any) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState<Goal>("fitness");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [equipment, setEquipment] = useState<Equipment>("home");
  const [minFreq, setMinFreq] = useState(3);
  const [days, setDays] = useState<any[]>([{ name: "اليوم 1", items: [{ name: "", sets: 3, reps: 12 }] }]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setDescription(""); setGoal("fitness"); setActivity("moderate");
    setEquipment("home"); setMinFreq(3); setImageFile(null);
    setDays([{ name: "اليوم 1", items: [{ name: "", sets: 3, reps: 12 }] }]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>خطة تمرين جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم الخطة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label>وصف مختصر</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label>صورة للخطة (اختياري)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="rounded-xl mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>الهدف</Label>
              <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-2 text-sm">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
              </select>
            </div>
            <div>
              <Label>المستوى</Label>
              <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)} className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-2 text-sm">
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
              </select>
            </div>
            <div>
              <Label>المعدات</Label>
              <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)} className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-2 text-sm">
                {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((eq) => <option key={eq} value={eq}>{EQUIPMENT_LABELS[eq]}</option>)}
              </select>
            </div>
            <div>
              <Label>الأيام/أسبوع</Label>
              <Input type="number" min={1} max={7} value={minFreq} onChange={(e) => setMinFreq(+e.target.value)} className="rounded-xl mt-1" />
            </div>
          </div>

          <div className="space-y-3">
            {days.map((d, di) => (
              <Card key={di} className="p-3 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <Input value={d.name} onChange={(e) => { const c = [...days]; c[di].name = e.target.value; setDays(c); }} className="rounded-xl h-9 max-w-40" />
                  <button onClick={() => setDays(days.filter((_, i) => i !== di))} className="text-destructive p-1"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                  {d.items.map((ex: any, ei: number) => (
                    <div key={ei} className="grid grid-cols-[1fr_50px_50px_auto] gap-2 items-center">
                      <Input value={ex.name} onChange={(e) => { const c = [...days]; c[di].items[ei].name = e.target.value; setDays(c); }} placeholder="التمرين" className="rounded-xl h-9" />
                      <Input type="number" value={ex.sets} onChange={(e) => { const c = [...days]; c[di].items[ei].sets = +e.target.value; setDays(c); }} className="rounded-xl h-9 text-center" />
                      <Input type="number" value={ex.reps} onChange={(e) => { const c = [...days]; c[di].items[ei].reps = +e.target.value; setDays(c); }} className="rounded-xl h-9 text-center" />
                      <button onClick={() => { const c = [...days]; c[di].items = c[di].items.filter((_: any, i: number) => i !== ei); setDays(c); }} className="p-1"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => { const c = [...days]; c[di].items.push({ name: "", sets: 3, reps: 12 }); setDays(c); }} className="rounded-xl w-full">
                    <Plus className="w-4 h-4 ml-1" /> تمرين
                  </Button>
                </div>
              </Card>
            ))}
            <Button size="sm" variant="outline" onClick={() => setDays([...days, { name: `اليوم ${days.length + 1}`, items: [{ name: "", sets: 3, reps: 12 }] }])} className="rounded-xl w-full">
              <Plus className="w-4 h-4 ml-1" /> إضافة يوم
            </Button>
          </div>

          <Button
            disabled={saving}
            onClick={async () => {
              if (!name.trim()) return toast.error("اكتبي اسم الخطة");
              const cleanedDays = days
                .map((d) => ({ ...d, items: d.items.filter((x: any) => x.name?.trim()) }))
                .filter((d) => d.items.length > 0);
              if (cleanedDays.length === 0) return toast.error("أضيفي تمريناً واحداً على الأقل");
              setSaving(true);
              try {
                let image_url: string | null = null;
                if (imageFile) image_url = await uploadFile(imageFile, trainerId, "workouts");
                const { error } = await supabase.from("workouts").insert({
                  trainer_id: trainerId,
                  name, description: description || null,
                  goal, activity_level: activity, equipment, min_frequency: minFreq,
                  exercises: cleanedDays,
                  image_url,
                  is_public: true,
                });
                if (error) throw error;
                toast.success("تم النشر");
                reset(); onClose(); onSaved();
              } catch (err: any) { toast.error(err.message); }
              finally { setSaving(false); }
            }}
            className="w-full rounded-2xl gradient-primary"
          >
            {saving ? "جاري النشر..." : "نشر الخطة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewNutritionDialog({ open, onClose, trainerId, onSaved }: any) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState<Goal>("fitness");
  const [minCal, setMinCal] = useState(1400);
  const [maxCal, setMaxCal] = useState(1800);
  const [meals, setMeals] = useState<any[]>([{ meal: "فطور", name: "", calories: 0 }]);

  const reset = () => {
    setName(""); setDescription(""); setGoal("fitness");
    setMinCal(1400); setMaxCal(1800);
    setMeals([{ meal: "فطور", name: "", calories: 0 }]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>خطة تغذية جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم الخطة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label>وصف مختصر</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>الهدف</Label>
              <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-2 text-sm">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
              </select>
            </div>
            <div>
              <Label>سعرات من</Label>
              <Input type="number" value={minCal} onChange={(e) => setMinCal(+e.target.value)} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label>إلى</Label>
              <Input type="number" value={maxCal} onChange={(e) => setMaxCal(+e.target.value)} className="rounded-xl mt-1" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>الوجبات</Label>
            {meals.map((m, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_70px_auto] gap-2 items-center">
                <Input value={m.meal} onChange={(e) => { const c = [...meals]; c[i].meal = e.target.value; setMeals(c); }} className="rounded-xl h-9" placeholder="نوع" />
                <Input value={m.name} onChange={(e) => { const c = [...meals]; c[i].name = e.target.value; setMeals(c); }} className="rounded-xl h-9" placeholder="الوجبة" />
                <Input type="number" value={m.calories} onChange={(e) => { const c = [...meals]; c[i].calories = +e.target.value; setMeals(c); }} className="rounded-xl h-9 text-center" />
                <button onClick={() => setMeals(meals.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setMeals([...meals, { meal: "سناك", name: "", calories: 0 }])} className="rounded-xl w-full">
              <Plus className="w-4 h-4 ml-1" /> إضافة وجبة
            </Button>
          </div>

          <Button
            onClick={async () => {
              if (!name.trim()) return toast.error("اكتبي اسم الخطة");
              const cleaned = meals.filter((m) => m.name?.trim());
              if (cleaned.length === 0) return toast.error("أضيفي وجبة واحدة على الأقل");
              if (minCal > maxCal) return toast.error("نطاق السعرات غير صحيح");
              const { error } = await supabase.from("nutrition_plans").insert({
                trainer_id: trainerId,
                name, description: description || null,
                goal, min_calories: minCal, max_calories: maxCal,
                meals: cleaned,
              });
              if (error) return toast.error(error.message);
              toast.success("تم النشر");
              reset(); onClose(); onSaved();
            }}
            className="w-full rounded-2xl gradient-primary"
          >
            نشر الخطة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
