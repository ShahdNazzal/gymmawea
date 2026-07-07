import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Flame, Target, TrendingUp, Dumbbell, Apple, MessageCircle, Sparkles } from "lucide-react";
import { GOAL_LABELS, bmiCategory } from "@/lib/workout-rules";
import { Skeleton } from "@/components/ui/skeleton";

// نستخدم هاد المتغير بكل استعلامات عمود "read" لأنه ملف الأنواع التلقائي تبع Supabase
// لسا ما تحدّث ليعرف بعمود read الجديد بجدول messages. هيك بنتفادى أخطاء TypeScript.
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/_app/home")({
  head: () => ({ meta: [{ title: "الرئيسية — جمّاوية" }] }),
  component: HomePage,
});

function HomePage() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [fp, setFp] = useState<any>(null);
  const [workoutsCount, setWorkoutsCount] = useState(0);
  const [streak, setStreak] = useState(0);
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
      const [{ data: p }, { data: f }, { data: logs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_fitness_profile").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("workout_logs").select("completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }),
      ]);
      setProfile(p);
      setFp(f);
      setWorkoutsCount(logs?.length ?? 0);
      // simple streak: count consecutive days back from today
      if (logs && logs.length) {
        const days = new Set(logs.map((l) => new Date(l.completed_at).toDateString()));
        let s = 0;
        const d = new Date();
        while (days.has(d.toDateString())) {
          s++;
          d.setDate(d.getDate() - 1);
        }
        setStreak(s);
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
          // أي تحديث على حالة القراءة (مثلاً فتح المحادثة بصفحة الشات) بنعيد حساب القائمة كاملة
          loadUnread(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const greeting = new Date().getHours() < 12 ? "صباح الخير" : new Date().getHours() < 18 ? "مساء النور" : "مساؤك ورد";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-muted-foreground text-sm">{greeting} </p>
        <h1 className="text-3xl font-extrabold mt-1">{profile?.full_name ?? "أهلاً"}</h1>
      </motion.div>

      {role === "user" && (
        <>
          {loading ? (
            <Skeleton className="h-40 w-full rounded-3xl" />
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-3xl p-6 gradient-primary text-primary-foreground shadow-elegant"
            >
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 opacity-90 text-sm">
                  <Sparkles className="w-4 h-4" /> هدفك الحالي
                </div>
                <h2 className="text-2xl font-extrabold mt-1">{fp ? GOAL_LABELS[fp.goal as keyof typeof GOAL_LABELS] : "—"}</h2>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <StatMini label="BMI" value={fp?.bmi ?? "—"} />
                  <StatMini label="التصنيف" value={fp?.bmi ? bmiCategory(fp.bmi) : "—"} />
                  <StatMini label="أيام/أسبوع" value={fp?.frequency ?? "—"} />
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Flame />} value={streak} label="أيام متتالية" />
            <StatCard icon={<Dumbbell />} value={workoutsCount} label="إجمالي التمارين" />
            <StatCard icon={<Target />} value={fp?.frequency ?? 0} label="هدف/أسبوع" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <QuickAction to="/workouts" icon={<Dumbbell className="w-6 h-6" />} title="تمرين اليوم" />
            <QuickAction to="/nutrition" icon={<Apple className="w-6 h-6" />} title="خطة التغذية" />
            <QuickAction to="/trainers" icon={<TrendingUp className="w-6 h-6" />} title="اكتشفي مدربات" />
            <QuickAction to="/chat" icon={<MessageCircle className="w-6 h-6" />} title="الشات" badge={unreadCount} />
          </div>
        </>
      )}

      {role === "trainer" && <TrainerHome userId={user!.id} unreadCount={unreadCount} />}
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white/15 rounded-2xl py-2.5">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[10px] opacity-90">{label}</div>
    </div>
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

function QuickAction({ to, icon, title, badge }: { to: any; icon: React.ReactNode; title: string; badge?: number }) {
  return (
    <Link to={to}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="relative p-5 rounded-2xl bg-card border border-border shadow-soft hover:border-primary/40 transition"
      >
        {!!badge && badge > 0 && (
          <div className="absolute -top-2 -left-2 min-w-[22px] h-[22px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-extrabold flex items-center justify-center shadow-soft">
            {badge > 99 ? "99+" : badge}
          </div>
        )}
        <div className="w-11 h-11 rounded-xl bg-secondary text-primary flex items-center justify-center mb-3">{icon}</div>
        <div className="font-bold text-sm">{title}</div>
      </motion.div>
    </Link>
  );
}

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