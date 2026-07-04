import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Flame, Target, TrendingUp, Dumbbell, Apple, MessageCircle, Sparkles } from "lucide-react";
import { GOAL_LABELS, bmiCategory } from "@/lib/workout-rules";
import { Skeleton } from "@/components/ui/skeleton";

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
    })();
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
            <QuickAction to="/chat" icon={<MessageCircle className="w-6 h-6" />} title="الشات" />
          </div>
        </>
      )}

      {role === "trainer" && <TrainerHome userId={user!.id} />}
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

function QuickAction({ to, icon, title }: { to: any; icon: React.ReactNode; title: string }) {
  return (
    <Link to={to}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="p-5 rounded-2xl bg-card border border-border shadow-soft hover:border-primary/40 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-secondary text-primary flex items-center justify-center mb-3">{icon}</div>
        <div className="font-bold text-sm">{title}</div>
      </motion.div>
    </Link>
  );
}

function TrainerHome({ userId }: { userId: string }) {
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
      <Link to="/profile" className="block">
        <Card className="p-5 rounded-2xl border-none shadow-soft">
          <div className="font-bold">اذهبي إلى ملفك لإدارة المنشورات</div>
          <div className="text-sm text-muted-foreground mt-1">شاركي محتوى ملهم مع مشتركاتك</div>
        </Card>
      </Link>
    </>
  );
}
