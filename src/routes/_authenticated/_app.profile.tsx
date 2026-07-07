//C:\Users\lenovo\Downloads\jammawia-main (1)\jammawia-main\src\routes\_authenticated\_app.profile.tsx
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Settings as SettingsIcon, TrendingUp, Camera, ImagePlus, Calendar, ImageOff, X } from "lucide-react";
import { toast } from "sonner";
import { GOAL_LABELS } from "@/lib/workout-rules";
import { uploadFile } from "@/lib/upload";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/_app/profile")({
  head: () => ({ meta: [{ title: "ملفي — جمّاوية" }] }),
  component: ProfilePage,
});

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// خطة "أسبوع ثابت" (خطط شخصية أنشأناها من صفحة التمارين): مصفوفة 7 عناصر بالظبط، كل عنصر فيه day_of_week رقمي
function isFixedWeekPlan(plan: any): boolean {
  const days = Array.isArray(plan?.exercises) ? plan.exercises : [];
  return days.length === 7 && days.every((d: any) => typeof d?.day_of_week === "number");
}

// نحاول نطابق اسم اليوم (زي "الأحد - صدر وترايسبس") مع أحد أيام الأسبوع، ونستخرج اسم العضلة المستهدفة بعد الفاصل
function parseDayName(dayName: string): { dayIndex: number | null; muscle: string } {
  const trimmed = (dayName ?? "").trim();
  for (let i = 0; i < DAYS.length; i++) {
    if (trimmed.startsWith(DAYS[i])) {
      const rest = trimmed.slice(DAYS[i].length).replace(/^[\s-–—:]+/, "").trim();
      return { dayIndex: i, muscle: rest };
    }
  }
  return { dayIndex: null, muscle: trimmed };
}

type WeekSlot = { label: string; isRest: boolean; subtitle?: string };

// نبني عرض 7 أيام من الخطة المعتمدة حالياً، بغض النظر عن نوعها
function buildWeekSlots(plan: any): WeekSlot[] {
  if (!plan) return DAYS.map((label) => ({ label, isRest: true }));

  const rawDays: any[] = Array.isArray(plan.exercises) ? plan.exercises : [];

  // حالة 1: خطة شخصية بأيام ثابتة (day_of_week رقمي) — منشأة من صفحة التمارين
  if (isFixedWeekPlan(plan)) {
    const sorted = [...rawDays].sort((a, b) => a.day_of_week - b.day_of_week);
    return sorted.map((d) => {
      const itemsCount = Array.isArray(d.items) ? d.items.length : 0;
      return {
        label: DAYS[d.day_of_week],
        isRest: !!d.is_rest || itemsCount === 0,
        subtitle: !d.is_rest && itemsCount > 0 ? `${itemsCount} تمارين` : undefined,
      };
    });
  }

  // حالة 2: خطة بأيام حرة (مدربة / شاتبوت)، أسماء الأيام فيها قد تحوي اسم اليوم الحقيقي + العضلة المستهدفة
  const parsed = rawDays.map((d: any) => ({ ...parseDayName(String(d?.name ?? "")), raw: d }));
  const anyMatchedByName = parsed.some((p) => p.dayIndex !== null);

  if (anyMatchedByName) {
    return DAYS.map((label, i) => {
      const match = parsed.find((p) => p.dayIndex === i);
      if (!match) return { label, isRest: true };
      return { label, isRest: false, subtitle: match.muscle || plan.name };
    });
  }

  // حالة 3: ما في تطابق اسمي إطلاقاً (مثلاً "اليوم 1"، "اليوم 2") — نعرضها بترتيبها بدءاً من الأحد
  return DAYS.map((label, i) => {
    const d = rawDays[i];
    if (!d) return { label, isRest: true };
    const dayLabel = typeof d?.name === "string" && d.name.trim() ? d.name.trim() : plan.name;
    return { label, isRest: false, subtitle: dayLabel };
  });
}

function ProfilePage() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [fp, setFp] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [openPost, setOpenPost] = useState<any>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: f }, { data: pr }, { data: ps }, { data: sel }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_fitness_profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("progress_logs").select("*").eq("user_id", user.id).order("logged_at"),
      supabase.from("posts").select("*").eq("author_id", user.id).order("created_at", { ascending: false }),
      supabase.from("active_plan_selection").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setProfile(p); setFp(f); setProgress(pr ?? []); setPosts(ps ?? []);

    setActivePlan(null);
    if (sel?.workout_plan_type && sel?.workout_plan_id) {
      const { data: w } = await supabase.from("workouts").select("*").eq("id", sel.workout_plan_id).maybeSingle();
      setActivePlan(w ?? null);
    }
  };
  useEffect(() => { load(); }, [user, role]);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const url = await uploadFile(file, user.id, "avatars");
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      toast.success("تم تحديث الصورة");
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const chartData = progress.map((p) => ({ date: new Date(p.logged_at).toLocaleDateString("ar", { day: "numeric", month: "short" }), weight: +p.weight }));

  const imagePosts = posts.filter((p) => !!p.image_url);
  const textPosts = posts.filter((p) => !p.image_url);

  const weekSlots = buildWeekSlots(activePlan);
  const scheduledDaysCount = weekSlots.filter((s) => !s.isRest).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">ملفي</h1>
        <div className="flex gap-2">
          {user && <Link to="/u/$id" params={{ id: user.id }} className="text-xs text-primary font-semibold self-center">عرض للعامة</Link>}
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/settings" })} className="rounded-xl">
            <SettingsIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* بطاقة البروفايل بشكل أقرب لانستقرام */}
      <Card className="rounded-3xl border-none shadow-soft overflow-hidden">
        <div className="h-16 gradient-primary" />
        <div className="p-6 pt-0 -mt-10">
          <div className="flex items-end gap-4">
            <button onClick={() => avatarInput.current?.click()} className="relative shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-24 h-24 rounded-3xl object-cover border-4 border-background shadow-soft" />
              ) : (
                <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center text-4xl font-extrabold text-primary-foreground border-4 border-background shadow-soft">
                  {profile?.full_name?.[0] ?? "؟"}
                </div>
              )}
              <div className="absolute -bottom-1 -left-1 bg-white rounded-full p-1.5 shadow-soft"><Camera className="w-3.5 h-3.5" /></div>
              <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
            </button>
            <div className="pb-1">
              <div className="font-extrabold text-xl">{profile?.full_name}</div>
              <div className="text-xs text-primary font-semibold mt-0.5">
                {role === "trainer" ? "مدربة معتمدة" : "عضوة"}
              </div>
            </div>
          </div>

          {profile?.bio && <p className="text-sm mt-4 leading-relaxed text-muted-foreground">{profile.bio}</p>}

          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="font-extrabold text-lg">{posts.length}</div>
              <div className="text-[11px] text-muted-foreground">منشور</div>
            </div>
            <div className="text-center">
              <div className="font-extrabold text-lg">{scheduledDaysCount}</div>
              <div className="text-[11px] text-muted-foreground">أيام مجدولة</div>
            </div>
            {role === "user" && fp && (
              <div className="text-center">
                <div className="font-extrabold text-lg">{fp.weight} كغ</div>
                <div className="text-[11px] text-muted-foreground">الوزن الحالي</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {role === "user" && fp && (
        <>
          <Card className="p-5 rounded-3xl">
            <div className="text-sm font-bold mb-3">بياناتك</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <MiniStat label="الوزن" value={`${fp.weight} كغ`} />
              <MiniStat label="الطول" value={`${fp.height} سم`} />
              <MiniStat label="BMI" value={fp.bmi} />
              <MiniStat label="الهدف" value={GOAL_LABELS[fp.goal as keyof typeof GOAL_LABELS]} />
              <MiniStat label="العمر" value={fp.age} />
              <MiniStat label="أيام/أسبوع" value={fp.frequency} />
            </div>
          </Card>

          <Card className="p-5 rounded-3xl">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> تطور الوزن</div>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="rounded-xl">
                <Plus className="w-4 h-4 ml-1" /> تسجيل
              </Button>
            </div>
            {chartData.length < 2 ? (
              <p className="text-xs text-muted-foreground text-center py-6">سجّلي وزنك مرتين على الأقل لرؤية المخطط</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </>
      )}

      {/* الجدول الأسبوعي - المصدر الوحيد هلأ هو الخطة المعتمدة حالياً */}
      <Card className="p-5 rounded-3xl">
        <div className="flex items-center justify-between mb-5">
          <div className="font-bold text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" /> جدولي الأسبوعي
          </div>
          <Link to="/workouts" className="text-xs text-primary font-semibold">
            تعديل
          </Link>
        </div>

        {!activePlan ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            ما في خطة معتمدة حالياً — اعتمدي خطة من صفحة التمارين ليظهر جدولك هون تلقائياً
          </p>
        ) : (
          <>
            {/* عرض اللابتوب/الشاشات الكبيرة: صف واحد أفقي كامل، بنفس التصميم الأصلي */}
            <div className="hidden sm:block relative">
              <div className="absolute top-6 left-0 right-0 h-[2px] bg-border z-0" />
              <div className="flex justify-between gap-2 relative z-10">
                {weekSlots.map((slot, i) => (
                  <WeekDayCell key={i} slot={slot} isToday={new Date().getDay() === i} />
                ))}
              </div>
            </div>

            {/* عرض الموبايل: صفين (4 + 3) لأنه الشاشة عمودية الشكل */}
            <div className="sm:hidden grid grid-cols-4 gap-3">
              {weekSlots.map((slot, i) => (
                <WeekDayCell key={i} slot={slot} isToday={new Date().getDay() === i} />
              ))}
            </div>
          </>
        )}
      </Card>

      {/* لايتبوكس بسيط لعرض المنشور موسّعاً */}
      <AnimatePresence>
        {openPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpenPost(null)}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-3xl overflow-hidden max-w-sm w-full max-h-[85vh] overflow-y-auto"
            >
              <div className="relative">
                <img src={openPost.image_url} className="w-full aspect-square object-cover" />
                <button
                  onClick={() => setOpenPost(null)}
                  className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              {openPost.content && <div className="p-4 text-sm leading-relaxed">{openPost.content}</div>}
              <div className="px-4 pb-4 text-[10px] text-muted-foreground">{new Date(openPost.created_at).toLocaleDateString("ar")}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button variant="outline" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }} className="w-full rounded-2xl">
        تسجيل الخروج
      </Button>

      <AddWeightDialog open={addOpen} onClose={() => setAddOpen(false)} userId={user?.id ?? ""} onSaved={load} />
      <NewPostDialog open={newPostOpen} onClose={() => setNewPostOpen(false)} userId={user?.id ?? ""} onSaved={load} />
    </div>
  );
}

function WeekDayCell({ slot, isToday }: { slot: WeekSlot; isToday: boolean }) {
  return (
    <div className="flex flex-col items-center flex-1">
      <div
        className={`w-14 h-14 flex items-center justify-center rounded-full text-[10px] font-bold text-center leading-tight px-1
        ${slot.isRest ? "bg-muted text-muted-foreground" : "gradient-primary text-white"}
        ${isToday ? "ring-2 ring-primary scale-110" : ""}
      `}
      >
        {slot.label}
      </div>

      <div
        className={`mt-3 w-full text-center px-2 py-2 rounded-xl text-[11px] leading-tight
        ${slot.isRest ? "text-muted-foreground" : "bg-primary/10 text-primary font-semibold"}`}
      >
        {slot.isRest ? "راحة" : (slot.subtitle ?? "تمرين")}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: any) {
  return (
    <div className="p-3 rounded-2xl bg-muted">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-bold text-sm mt-1">{value}</div>
    </div>
  );
}

function AddWeightDialog({ open, onClose, userId, onSaved }: any) {
  const [weight, setWeight] = useState<number>(60);
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle>تسجيل الوزن</DialogTitle></DialogHeader>
        <Label>الوزن (كغ)</Label>
        <Input type="number" value={weight} onChange={(e) => setWeight(+e.target.value)} className="rounded-xl" />
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
        <Button onClick={async () => {
          await supabase.from("progress_logs").insert({ user_id: userId, weight, notes: notes || null });
          toast.success("تم التسجيل");
          onClose(); onSaved();
        }} className="rounded-2xl gradient-primary">حفظ</Button>
      </DialogContent>
    </Dialog>
  );
}

function NewPostDialog({ open, onClose, userId, onSaved }: any) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle>منشور جديد</DialogTitle></DialogHeader>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="rounded-xl min-h-24" placeholder="اكتبي كابشن..." />
        <Label className="text-xs">صورة (اختياري)</Label>
        <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-xl" />
        {file && <div className="text-xs text-muted-foreground">{file.name}</div>}
        <Button
          disabled={saving}
          onClick={async () => {
            if (!content && !file) return toast.error("أضيفي نصاً أو صورة");
            setSaving(true);
            try {
              let image_url: string | null = null;
              if (file) image_url = await uploadFile(file, userId, "posts");
              const { error } = await supabase.from("posts").insert({ author_id: userId, trainer_id: userId, content: content || "", image_url });
              if (error) throw error;
              toast.success("تم النشر");
              setContent(""); setFile(null); onClose(); onSaved();
            } catch (err: any) { toast.error(err.message); }
            finally { setSaving(false); }
          }}
          className="rounded-2xl gradient-primary"
        >{saving ? "جاري النشر..." : "نشر"}</Button>
      </DialogContent>
    </Dialog>
  );
}