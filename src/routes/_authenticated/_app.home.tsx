import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Dumbbell,
  Apple,
  MessageCircle,
  Sparkles,
  Clock,
  Users,
  ChevronLeft,
  CalendarDays,
  Moon,
} from "lucide-react";
import { bmiCategory } from "@/lib/workout-rules";
import { Skeleton } from "@/components/ui/skeleton";

// نستخدم هاد المتغير بكل استعلامات عمود "read" لأنه ملف الأنواع التلقائي تبع Supabase
// لسا ما تحدّث ليعرف بعمود read الجديد بجدول messages. هيك بنتفادى أخطاء TypeScript.
const db = supabase as any;

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const Route = createFileRoute("/_authenticated/_app/home")({
  head: () => ({ meta: [{ title: "الرئيسية — جمّاوية" }] }),
  component: HomePage,
});

// خطة "أسبوع ثابت" = مصفوفة من 7 عناصر بالظبط، كل عنصر فيه day_of_week رقمي (نفس البنية المستخدمة بصفحة التمارين)
function isFixedWeekPlan(plan: any): boolean {
  const days = Array.isArray(plan?.exercises) ? plan.exercises : [];
  return days.length === 7 && days.every((d: any) => d?.day_of_week != null);
}

function HomePage() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [fp, setFp] = useState<any>(null);

  const [streak, setStreak] = useState(0);
  const [weeklyDaysTrained, setWeeklyDaysTrained] = useState(0);

  // الخطة النشطة حالياً (شخصية أو من مدربة) — نفس الجدول والمنطق المستخدم بصفحة التمارين
  const [activeWorkout, setActiveWorkout] = useState<any>(null);

  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [nutritionPlan, setNutritionPlan] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  // بنخزن معرفات الأشخاص يلي عندهم رسائل غير مقروءة (مش عدد الرسائل)
  const [unreadSenderIds, setUnreadSenderIds] = useState<Set<string>>(new Set());
  const unreadCount = unreadSenderIds.size;

  const loadUnread = async (userId: string) => {
    const { data, error } = await db
      .from("messages")
      .select("sender_id")
      .eq("recipient_id", userId)
      .eq("read", false);
    if (error) {
      console.error("loadUnread error:", error);
      return;
    }
    setUnreadSenderIds(new Set((data ?? []).map((m: any) => m.sender_id)));
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(now.getDate() - now.getDay());

      const [{ data: p }, { data: f }, { data: logs }, { data: sel }, { data: weights }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_fitness_profile").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("workout_logs").select("completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }),
        supabase.from("active_plan_selection").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("progress_logs")
          .select("weight, logged_at")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(2),
      ]);

      setProfile(p);
      setFp(f);
      setWeightLogs(weights ?? []);

      if (logs && logs.length) {
        // نجمع تواريخ التمارين (يوم واحد بغض النظر عن عدد التمارين المسجّلة فيه)
        const uniqueDays = new Set(logs.map((l) => new Date(l.completed_at).toDateString()));

        // ستريك: عدد الأيام المتتالية اللي فيها تمرين، رجوعًا من اليوم
        let s = 0;
        const d = new Date();
        while (uniqueDays.has(d.toDateString())) {
          s++;
          d.setDate(d.getDate() - 1);
        }
        setStreak(s);

        // عدد الأيام (المختلفة) اللي تمرّنت فيها هالأسبوع — مش عدد التمارين
        const daysThisWeek = [...uniqueDays].filter((ds) => new Date(ds) >= weekStart).length;
        setWeeklyDaysTrained(daysThisWeek);
      }

      // الخطة النشطة: نفس منطق صفحة التمارين بالضبط (workout_plan_type + workout_plan_id)
      if (sel?.workout_plan_id) {
        const { data: w } = await supabase.from("workouts").select("*").eq("id", sel.workout_plan_id).maybeSingle();
        setActiveWorkout(w ?? null);
      } else {
        setActiveWorkout(null);
      }

      // خطة التغذية: نفضّل الخطة المعتمدة صراحة (نفس اختيار active_plan_selection)، وإلا خطة خاصة، وإلا أقرب خطة عامة لهدفها
      if (sel?.nutrition_plan_id) {
        const { data: np } = await supabase.from("nutrition_plans").select("*").eq("id", sel.nutrition_plan_id).maybeSingle();
        setNutritionPlan(np ?? null);
      } else if (f) {
        const { data: myPlan } = await supabase.from("nutrition_plans").select("*").eq("owner_user_id", user.id).maybeSingle();
        if (myPlan) {
          setNutritionPlan(myPlan);
        } else {
          const { data: pubPlan } = await supabase
            .from("nutrition_plans")
            .select("*")
            .eq("goal", f.goal)
            .eq("is_public", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          setNutritionPlan(pubPlan ?? null);
        }
      }

      setLoading(false);
      await loadUnread(user.id);
    })();
  }, [user]);

  // تحديث فوري لعدد الأشخاص أصحاب الرسائل غير المقروءة
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`home-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        (payload: any) => {
          const m = payload.new;
          if (m.read === false) {
            setUnreadSenderIds((prev) => new Set(prev).add(m.sender_id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => {
          loadUnread(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const greeting =
    new Date().getHours() < 12 ? "صباح الخير" : new Date().getHours() < 18 ? "مساء النور" : "مساؤك ورد";

  const todayLabel = `${DAYS[new Date().getDay()]}، ${new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "long",
  }).format(new Date())}`;

  // هدف عدد أيام التمرين بالأسبوع: نفضّل هدف الخطة النشطة نفسها لأنه أدق من هدف عام بالبروفايل
  const weeklyGoal = activeWorkout?.min_frequency ?? fp?.frequency ?? 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-muted-foreground text-sm">
          {greeting} · {todayLabel}
        </p>
        <h1 className="text-3xl font-extrabold mt-1">{profile?.full_name ?? "أهلاً"}</h1>
      </motion.div>

      {role === "user" && (
        <>
          {loading ? (
            <Skeleton className="h-56 w-full rounded-3xl" />
          ) : (
            <TodayWorkoutHero activeWorkout={activeWorkout} />
          )}

          <div className="grid grid-cols-2 gap-3">
            {loading ? (
              <>
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
              </>
            ) : (
              <>
                <WeeklyProgressCard completed={weeklyDaysTrained} goal={weeklyGoal} streak={streak} />
                <BodyStatsCard fp={fp} weightLogs={weightLogs} />
              </>
            )}
          </div>

          {!loading && <NutritionSnippetCard plan={nutritionPlan} fp={fp} />}

          <div className="grid grid-cols-2 gap-3">
            <QuickAction to="/trainers" icon={<Users className="w-5 h-5" />} title="اكتشفي مدربات" />
            <QuickAction to="/chat" icon={<MessageCircle className="w-5 h-5" />} title="الشات" badge={unreadCount} />
          </div>
        </>
      )}

      {role === "trainer" && <TrainerHome userId={user!.id} unreadCount={unreadCount} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* البطل: تمرين اليوم — مبني فعلياً على الخطة المعتمدة بصفحة التمارين     */
/* ------------------------------------------------------------------ */

function TodayWorkoutHero({ activeWorkout }: { activeWorkout: any }) {
  const todayIdx = new Date().getDay();

  // حالة: ما في خطة نشطة أصلاً
  if (!activeWorkout) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl p-6 bg-card border border-border shadow-soft text-center"
      >
        <CalendarDays className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-extrabold">ما في خطة تمرين نشطة حالياً</h2>
        <p className="text-sm text-muted-foreground mt-1">
          اعتمدي خطة شخصية أو خطة من إحدى المدربات عشان تبداي تشوفي هون تمرين كل يوم بالتفصيل
        </p>
        <Link to="/workouts" className="block mt-4">
          <div className="inline-flex items-center gap-2 bg-secondary text-primary font-bold rounded-2xl px-5 py-2.5 text-sm">
            اختاري خطتك <ChevronLeft className="w-4 h-4" />
          </div>
        </Link>
      </motion.div>
    );
  }

  const fixedWeek = isFixedWeekPlan(activeWorkout);
  const rawDays: any[] = Array.isArray(activeWorkout.exercises) ? activeWorkout.exercises : [];
  const todayEntry = fixedWeek ? rawDays.find((d) => Number(d.day_of_week) === todayIdx) : null;
  const isRest = fixedWeek ? !todayEntry || !!todayEntry.is_rest : null; // null = بنية قديمة، ما فينا نحدد
  const items: any[] = Array.isArray(todayEntry?.items) ? todayEntry.items : [];
  const muscleGroup: string | null = todayEntry?.muscle_group || null;

  // واحد كرت موحّد: اسم الخطة + وصفها فوق، وتحته "تمرين اليوم" بخط كبير وواضح
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-3xl p-6 gradient-primary text-primary-foreground shadow-elegant"
    >
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-14 -right-8 w-44 h-44 bg-white/10 rounded-full blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2 opacity-90 text-sm">
          <Dumbbell className="w-4 h-4" /> خطتك الحالية
        </div>
        <h2 className="text-xl font-extrabold mt-1">{activeWorkout.name}</h2>
        {activeWorkout.description && (
          <p className="text-sm opacity-90 mt-1 line-clamp-2">{activeWorkout.description}</p>
        )}

        <div className="mt-4 bg-white/15 rounded-2xl p-4">
          <div className="text-xs opacity-90">تمرين اليوم</div>

          {isRest === null && (
            <div className="text-lg font-extrabold mt-1">افتحي الجدول لمعرفة تفاصيل اليوم</div>
          )}

          {isRest === true && (
            <div className="flex items-center gap-2 mt-1">
              <Moon className="w-6 h-6" />
              <span className="text-2xl font-extrabold">يوم راحة</span>
            </div>
          )}

          {isRest === false && (
            <>
              <div className="text-3xl font-extrabold mt-1">{muscleGroup || "تمرين عام"}</div>
              {items.length > 0 && (
                <div className="flex items-center gap-1 text-xs opacity-90 mt-1.5">
                  <Clock className="w-3.5 h-3.5" /> {items.length} تمارين · ~{items.length * 4} د تقريبًا
                </div>
              )}
            </>
          )}
        </div>

        <Link to="/workouts" className="block mt-4">
          <div className="flex items-center justify-center gap-2 bg-white text-primary font-extrabold rounded-2xl py-3 text-sm shadow-soft active:scale-[0.98] transition">
            افتحي جدولك الأسبوعي <ChevronLeft className="w-4 h-4" />
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* الالتزام الأسبوعي: أيام تمرّنتِ فيها هالأسبوع + الستريك                */
/* (ما في أي رقم "إجمالي عمرك بالتمرين" — هيك أرقام مالها فايدة حقيقية)   */
/* ------------------------------------------------------------------ */

function WeeklyProgressCard({ completed, goal, streak }: { completed: number; goal: number; streak: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((completed / goal) * 100)) : 0;
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <Card className="p-4 rounded-2xl border-none shadow-soft flex flex-col items-center text-center">
      <div className="text-xs font-bold text-muted-foreground mb-2">التزامك هالأسبوع</div>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--secondary))" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-extrabold leading-none">
            {completed}/{goal || "—"}
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5">أيام</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-sm font-bold text-orange-500">
        <Flame className="w-4 h-4" /> {streak} {streak === 1 ? "يوم متتالي" : "أيام متتالية"}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* مؤشراتك — بلغة واضحة مش أرقام مجردة                                  */
/* ------------------------------------------------------------------ */

function BodyStatsCard({ fp, weightLogs }: { fp: any; weightLogs: any[] }) {
  const bmi = fp?.bmi ?? null;
  const category = bmi ? bmiCategory(bmi) : null;

  const latest = weightLogs?.[0]?.weight ?? null;
  const prev = weightLogs?.[1]?.weight ?? null;
  const delta = latest != null && prev != null ? +(latest - prev).toFixed(1) : null;

  // بنحدد إذا الاتجاه "إيجابي" حسب هدفها
  const goal = (fp?.goal ?? "") as string;
  const wantsDown = goal.includes("lose");
  const wantsUp = goal.includes("gain") || goal.includes("muscle");

  let trendIcon = <Minus className="w-3.5 h-3.5" />;
  let trendClass = "text-muted-foreground";
  let trendText = "لا تغيير عن آخر قياس";
  if (delta != null && delta !== 0) {
    const goingDown = delta < 0;
    trendIcon = goingDown ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />;
    const isGood = (goingDown && wantsDown) || (!goingDown && wantsUp);
    trendClass = isGood ? "text-emerald-500" : wantsDown || wantsUp ? "text-orange-500" : "text-muted-foreground";
    trendText = `${goingDown ? "نزل" : "زاد"} ${Math.abs(delta)} كغم عن آخر قياس`;
  }

  return (
    <Card className="p-4 rounded-2xl border-none shadow-soft flex flex-col justify-between">
      <div className="text-xs font-bold text-muted-foreground">مؤشر كتلة الجسم</div>

      {bmi ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold">{bmi}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary text-primary">{category}</span>
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">أكملي ملفك الرياضي لحساب المؤشر</div>
      )}

      <div className="mt-3 pt-3 border-t border-border">
        {latest != null ? (
          <>
            <div className="text-[11px] text-muted-foreground">آخر وزن مسجّل</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-sm font-bold">{latest} كغم</span>
              {delta != null && (
                <span className={`flex items-center gap-1 text-[11px] font-bold ${trendClass}`}>
                  {trendIcon} {trendText}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-[11px] text-muted-foreground">سجّلي وزنك بملفك عشان تتابعي تقدمك بمرور الوقت</div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* خطة التغذية - مصغّرة بمعلومات فعلية                                  */
/* ------------------------------------------------------------------ */

function NutritionSnippetCard({ plan, fp }: { plan: any; fp: any }) {
  // نحسب هدف بروتين اليوم بناءً على وزنها وهدفها (تضخيم يحتاج بروتين أكثر لبناء العضل،
  // وتنشيف/نزول وزن يحتاج بروتين أعلى كمان عشان تحافظي على العضل وقت العجز بالسعرات)
  const goal = (fp?.goal ?? "") as string;
  const isBulking = goal.includes("gain") || goal.includes("muscle") || goal.includes("bulk");
  const isCutting = goal.includes("lose");
  const proteinPerKg = isBulking ? 1.8 : isCutting ? 2.0 : 1.6;
  const proteinGrams = fp?.weight ? Math.round(fp.weight * proteinPerKg) : null;

  let subtitle: string;
  if (plan && proteinGrams) {
    subtitle = `${plan.min_calories}–${plan.max_calories} سعرة و~${proteinGrams} غ بروتين اليوم`;
  } else if (plan) {
    subtitle = `${plan.min_calories}–${plan.max_calories} سعرة حرارية مقترحة اليوم`;
  } else if (proteinGrams) {
    subtitle = `تحتاجي حوالي ${proteinGrams} غ بروتين اليوم بحسب هدفك — كمّلي خطة سعرات لتوصية أدق`;
  } else if (fp) {
    subtitle = "ما في خطة مخصّصة إلك بعد — استعرضي الخطط المتاحة";
  } else {
    subtitle = "أكملي ملفك الرياضي لتوصية مخصّصة إلك";
  }

  return (
    <Link to="/nutrition" className="block">
      <Card className="p-4 rounded-2xl border-none shadow-soft flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
            <Apple className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm">{plan ? plan.name : "خطة التغذية"}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
          </div>
        </div>
        <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* عنصر انتقال سريع (مدربات / شات)                                     */
/* ------------------------------------------------------------------ */

function QuickAction({ to, icon, title, badge }: { to: any; icon: React.ReactNode; title: string; badge?: number }) {
  return (
    <Link to={to}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="relative flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-soft hover:border-primary/40 transition"
      >
        {!!badge && badge > 0 && (
          <div className="absolute -top-2 -left-2 min-w-[22px] h-[22px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-extrabold flex items-center justify-center shadow-soft">
            {badge > 99 ? "99+" : badge}
          </div>
        )}
        <div className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="font-bold text-sm">{title}</div>
      </motion.div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* صفحة المدرّبة                                                       */
/* ------------------------------------------------------------------ */

function TrainerHome({ userId, unreadCount }: { userId: string; unreadCount: number }) {
  const [subs, setSubs] = useState(0);
  const [posts, setPosts] = useState(0);
  useEffect(() => {
    (async () => {
      const [{ count: s }, { count: p }] = await Promise.all([
        supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("trainer_id", userId).eq("status", "active"),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("trainer_id", userId),
      ]);
      setSubs(s ?? 0);
      setPosts(p ?? 0);
    })();
  }, [userId]);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<TrendingUp />} value={subs} label="مشتركات" />
        <StatCard icon={<Sparkles />} value={posts} label="منشورات" />
      </div>

      <Link to="/chat" className="block">
        <Card className="p-5 rounded-2xl border-none shadow-soft flex items-center justify-between">
          <div>
            <div className="font-bold flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> الشات
            </div>
            <div className="text-sm text-muted-foreground mt-1">تابعي محادثاتك مع الأعضاء</div>
          </div>
          {unreadCount > 0 && (
            <div className="min-w-[26px] h-[26px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-extrabold flex items-center justify-center shadow-soft">
              {unreadCount > 99 ? "99+" : unreadCount}
            </div>
          )}
        </Card>
      </Link>

      <Link to="/profile" className="block">
        <Card className="p-5 rounded-2xl border-none shadow-soft">
          <div className="font-bold">اذهبي إلى ملفك لإدارة المنشورات</div>
          <div className="text-sm text-muted-foreground mt-1">شاركي محتوى ملهم مع مشتركاتك</div>
        </Card>
      </Link>
    </>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: any; label: string }) {
  return (
    <Card className="p-4 rounded-2xl border-none shadow-soft">
      <div className="text-primary mb-2">{icon}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </Card>
  );
}