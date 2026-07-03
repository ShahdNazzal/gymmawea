import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, Plus, CheckCircle2, Timer, X, Calendar, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uploadFile } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/_app/workouts")({
  head: () => ({ meta: [{ title: "التمارين — جمّاوية" }] }),
  component: WorkoutsPage,
});

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function WorkoutsPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<any>(null);
  const [trainerPlan, setTrainerPlan] = useState<any>(null);
  const [personalPlans, setPersonalPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedule, setSchedule] = useState<any[]>([]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: sel } = await supabase.from("active_plan_selection").select("*").eq("user_id", user.id).maybeSingle();
    setActive(sel);
    setTrainerPlan(null);
    if (sel?.workout_plan_type === "trainer" && sel?.workout_plan_id) {
      const { data: w } = await supabase.from("workouts").select("*").eq("id", sel.workout_plan_id).maybeSingle();
      setTrainerPlan(w);
    }
    const { data: up } = await supabase.from("workouts").select("*").eq("owner_user_id", user.id).order("created_at", { ascending: false });
    setPersonalPlans(up ?? []);
    const { data: ws } = await supabase.from("weekly_schedules").select("*, workouts(name, image_url)").eq("user_id", user.id).order("day_of_week");
    setSchedule(ws ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user]);

  const activePersonal = personalPlans.find((p) => p.id === active?.workout_plan_id);
  const currentType = active?.workout_plan_type;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">تمارينك</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)} className="rounded-xl">
            <Calendar className="w-4 h-4 ml-1" /> الأسبوع
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTimerOpen(true)} className="rounded-xl">
            <Timer className="w-4 h-4 ml-1" /> مؤقت
          </Button>
        </div>
      </div>

      <div className="glass p-3 rounded-2xl flex items-center justify-between text-sm">
        <span className="font-semibold">
          البرنامج النشط: {currentType === "trainer" ? "مدربة" : currentType === "personal" ? "شخصي" : "—"}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setSwitchOpen(true)} className="rounded-xl text-primary">
          تبديل
        </Button>
      </div>

      {loading && <Skeleton className="h-40 w-full rounded-3xl" />}

      {!loading && currentType === "trainer" && trainerPlan && (
        <PlanView plan={trainerPlan} userId={user!.id} sourceType="trainer" sourceId={trainerPlan.id} />
      )}

      {!loading && currentType === "personal" && activePersonal && (
        <PlanView plan={activePersonal} userId={user!.id} sourceType="personal" sourceId={activePersonal.id} />
      )}

      {schedule.length > 0 && (
        <Card className="p-4 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-sm flex items-center gap-2"><Calendar className="w-4 h-4" /> جدولك الأسبوعي</div>
            <button onClick={() => setScheduleOpen(true)} className="text-xs text-primary">تعديل</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map((d, i) => {
              const item = schedule.find((s) => s.day_of_week === i);
              return (
                <div key={i} className={`p-2 rounded-xl text-[10px] ${item ? "gradient-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="font-bold">{d.slice(0, 3)}</div>
                  <div className="mt-1 truncate">{item?.title ?? "—"}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">خططي الشخصية</h2>
          <Button size="sm" onClick={() => setNewPlanOpen(true)} className="rounded-xl gradient-primary">
            <Plus className="w-4 h-4 ml-1" /> إنشاء
          </Button>
        </div>
        {personalPlans.length === 0 && (
          <Card className="p-6 text-center rounded-2xl border-dashed">
            <Dumbbell className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد خطط شخصية بعد</p>
          </Card>
        )}
        <div className="grid gap-2">
          {personalPlans.map((p) => (
            <Card key={p.id} className="p-3 rounded-2xl flex items-center gap-3">
              {p.image_url ? (
                <img src={p.image_url} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><Dumbbell className="w-4 h-4" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {(Array.isArray(p.exercises) ? p.exercises : []).length} يوم • {p.is_public ? "عام" : "خاص"}
                </div>
              </div>
              <Button
                size="sm"
                variant={active?.workout_plan_id === p.id ? "default" : "outline"}
                onClick={async () => {
                  await supabase.from("active_plan_selection").upsert({
                    user_id: user!.id,
                    workout_plan_type: "personal",
                    workout_plan_id: p.id,
                    nutrition_plan_type: active?.nutrition_plan_type,
                    nutrition_plan_id: active?.nutrition_plan_id,
                  });
                  toast.success("تم تفعيل الخطة");
                  loadAll();
                }}
                className="rounded-xl"
              >
                {active?.workout_plan_id === p.id ? "نشطة" : "تفعيل"}
              </Button>
              <button onClick={async () => {
                if (!confirm("حذف الخطة؟")) return;
                await supabase.from("workouts").delete().eq("id", p.id);
                loadAll();
              }} className="p-1 text-destructive"><Trash2 className="w-4 h-4" /></button>
            </Card>
          ))}
        </div>
      </div>

      <SwitchDialog
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        userId={user?.id ?? ""}
        activeId={active?.workout_plan_id}
        onSwitched={() => { setSwitchOpen(false); loadAll(); }}
        currentSelection={active}
      />
      <NewPlanDialog open={newPlanOpen} onClose={() => setNewPlanOpen(false)} userId={user?.id ?? ""} onSaved={loadAll} />
      <RestTimerDialog open={timerOpen} onClose={() => setTimerOpen(false)} />
      <WeeklyScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        userId={user?.id ?? ""}
        schedule={schedule}
        allPlans={[...personalPlans, ...(trainerPlan ? [trainerPlan] : [])]}
        onSaved={loadAll}
      />
    </div>
  );
}

function PlanView({ plan, userId, sourceType, sourceId }: { plan: any; userId: string; sourceType: "trainer" | "personal"; sourceId: string }) {
  const days = Array.isArray(plan.exercises) ? plan.exercises : plan.schedule ? Object.values(plan.schedule) : [];
  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border-none shadow-soft overflow-hidden">
        {plan.image_url && <img src={plan.image_url} className="w-full h-40 object-cover" />}
        <div className="p-5 gradient-blush">
          <div className="text-xs text-muted-foreground mb-1">البرنامج الحالي</div>
          <h2 className="text-xl font-extrabold">{plan.name}</h2>
          {plan.description && <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>}
        </div>
      </Card>
      {days.map((d: any, i: number) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="p-4 rounded-2xl">
            <div className="font-bold mb-3">{d.name ?? `اليوم ${d.day ?? i + 1}`}</div>
            <ul className="space-y-2">
              {(d.items ?? []).map((ex: any, j: number) => (
                <ExerciseRow key={j} name={ex.name} sets={ex.sets} reps={ex.reps} userId={userId} sourceType={sourceType} sourceId={sourceId} />
              ))}
            </ul>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function ExerciseRow({ name, sets, reps, userId, sourceType, sourceId }: any) {
  const [done, setDone] = useState(false);
  return (
    <li className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            await supabase.from("workout_logs").insert({
              user_id: userId,
              source_type: sourceType,
              source_id: sourceId,
              exercise_name: name,
              sets, reps,
            });
            setDone(true);
            toast.success("تم تسجيل التمرين");
          }}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${done ? "gradient-primary border-primary" : "border-border"}`}
        >
          {done && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
        </button>
        <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{name}</span>
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{sets} × {reps}</span>
    </li>
  );
}

function SwitchDialog({ open, onClose, userId, activeId, onSwitched, currentSelection }: any) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("workouts")
      .select("*, profiles!workouts_trainer_id_fkey(full_name)")
      .select("*").eq("is_public", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setPlans(data ?? []); setLoading(false); });
  }, [open]);

  const adopt = async (id: string) => {
    await supabase.from("active_plan_selection").upsert({
      user_id: userId,
      workout_plan_type: "trainer",
      workout_plan_id: id,
      nutrition_plan_type: currentSelection?.nutrition_plan_type,
      nutrition_plan_id: currentSelection?.nutrition_plan_id,
    });
    toast.success("تم اعتماد الخطة");
    onSwitched();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>خطط المدربات</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">اختاري خطة من المدربات لاعتمادها كبرنامجك الحالي.</p>
        {loading && <Skeleton className="h-24 rounded-2xl" />}
        {!loading && plans.length === 0 && (
          <Card className="p-6 text-center rounded-2xl border-dashed">
            <Dumbbell className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد خطط منشورة بعد</p>
          </Card>
        )}
        <div className="grid gap-2">
          {plans.map((p) => (
            <Card key={p.id} className="p-3 rounded-2xl flex items-center gap-2">
              {p.image_url ? (
                <img src={p.image_url} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><Dumbbell className="w-4 h-4" /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {p.profiles?.full_name && `${p.profiles.full_name} • `}
                  {(Array.isArray(p.exercises) ? p.exercises : []).length} يوم
                </div>
              </div>
              <Button size="sm" variant={activeId === p.id ? "default" : "outline"} onClick={() => adopt(p.id)} className="rounded-xl shrink-0">
                {activeId === p.id ? "نشطة" : "اعتماد"}
              </Button>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewPlanDialog({ open, onClose, userId, onSaved }: any) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [exercises, setExercises] = useState<any[]>([{ name: "", sets: 3, reps: 12 }]);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>خطة تمرين شخصية</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم الخطة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-2"><ImagePlus className="w-4 h-4" /> صورة الخطة (اختياري)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="rounded-xl mt-1" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4" />
            جعل الخطة عامة (يستطيع الآخرون رؤيتها في ملفك)
          </label>
          <div>
            <Label>تمارين اليوم 1</Label>
            <div className="space-y-2 mt-2">
              {exercises.map((ex, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_60px_auto] gap-2 items-center">
                  <Input value={ex.name} onChange={(e) => { const c = [...exercises]; c[i].name = e.target.value; setExercises(c); }} placeholder="اسم التمرين" className="rounded-xl" />
                  <Input type="number" value={ex.sets} onChange={(e) => { const c = [...exercises]; c[i].sets = +e.target.value; setExercises(c); }} className="rounded-xl text-center" />
                  <Input type="number" value={ex.reps} onChange={(e) => { const c = [...exercises]; c[i].reps = +e.target.value; setExercises(c); }} className="rounded-xl text-center" />
                  <button onClick={() => setExercises(exercises.filter((_, j) => j !== i))} className="p-1"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setExercises([...exercises, { name: "", sets: 3, reps: 12 }])} className="rounded-xl w-full">
                <Plus className="w-4 h-4 ml-1" /> إضافة تمرين
              </Button>
            </div>
          </div>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!name.trim()) return toast.error("اكتبي اسم الخطة");
              const items = exercises.filter((e) => e.name?.trim());
              if (items.length === 0) return toast.error("أضيفي تمريناً واحداً على الأقل");
              setSaving(true);
              try {
                let image_url: string | null = null;
                if (imageFile) image_url = await uploadFile(imageFile, userId, "workouts");
                const { error } = await supabase.from("workouts").insert({
                  owner_user_id: userId,
                  name,
                  goal: "fitness",
                  activity_level: "moderate",
                  equipment: "home",
                  min_frequency: 3,
                  exercises: [{ name: "اليوم 1", items }],
                  is_public: isPublic,
                  image_url,
                });
                if (error) throw error;
                toast.success("تم الحفظ");
                setName(""); setImageFile(null); setIsPublic(false);
                setExercises([{ name: "", sets: 3, reps: 12 }]);
                onClose(); onSaved();
              } catch (err: any) { toast.error(err.message); }
              finally { setSaving(false); }
            }}
            className="w-full rounded-2xl gradient-primary"
          >
            {saving ? "جاري الحفظ..." : "حفظ الخطة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RestTimerDialog({ open, onClose }: any) {
  const [sec, setSec] = useState(60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || sec <= 0) return;
    const t = setInterval(() => setSec((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [running, sec]);
  useEffect(() => { if (sec === 0 && running) { setRunning(false); toast.success("انتهى وقت الراحة"); } }, [sec, running]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl text-center">
        <DialogHeader><DialogTitle>مؤقت الراحة</DialogTitle></DialogHeader>
        <div className="text-6xl font-extrabold gradient-primary bg-clip-text text-transparent">{sec}</div>
        <div className="flex gap-2 justify-center">
          {[30, 60, 90].map((v) => (
            <Button key={v} variant="outline" onClick={() => { setSec(v); setRunning(false); }} className="rounded-xl">{v}s</Button>
          ))}
        </div>
        <Button onClick={() => setRunning(!running)} className="rounded-2xl gradient-primary">
          {running ? "إيقاف" : "ابدئي"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function WeeklyScheduleDialog({ open, onClose, userId, schedule, allPlans, onSaved }: any) {
  const [local, setLocal] = useState<Record<number, { title: string; workout_id: string | null }>>({});

  useEffect(() => {
    if (!open) return;
    const map: any = {};
    for (const s of schedule) map[s.day_of_week] = { title: s.title, workout_id: s.workout_id };
    setLocal(map);
  }, [open, schedule]);

  const save = async () => {
    await supabase.from("weekly_schedules").delete().eq("user_id", userId);
    const rows = Object.entries(local)
      .filter(([, v]) => v.title.trim())
      .map(([day, v]) => ({ user_id: userId, day_of_week: +day, title: v.title, workout_id: v.workout_id }));
    if (rows.length) await supabase.from("weekly_schedules").insert(rows);
    toast.success("تم حفظ الجدول");
    onClose(); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>الجدول الأسبوعي</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {DAYS.map((d, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr] gap-2 items-center">
              <div className="text-sm font-semibold">{d}</div>
              <div className="grid gap-1">
                <Input
                  placeholder="مثال: تمرين صدر"
                  value={local[i]?.title ?? ""}
                  onChange={(e) => setLocal({ ...local, [i]: { title: e.target.value, workout_id: local[i]?.workout_id ?? null } })}
                  className="rounded-xl h-9"
                />
                <select
                  value={local[i]?.workout_id ?? ""}
                  onChange={(e) => setLocal({ ...local, [i]: { title: local[i]?.title ?? "", workout_id: e.target.value || null } })}
                  className="rounded-xl h-9 border border-input bg-background px-2 text-xs"
                >
                  <option value="">— بدون خطة —</option>
                  {allPlans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={save} className="w-full rounded-2xl gradient-primary">حفظ الجدول</Button>
      </DialogContent>
    </Dialog>
  );
}
