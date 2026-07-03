import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Flame, Target, TrendingUp, Dumbbell, Apple, MessageCircle, Sparkles, ArrowUpRight } from "lucide-react";
import { GOAL_LABELS, bmiCategory } from "@/lib/workout-rules";

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


  

  const getGreeting = () => {
  const hour = new Date().getHours();

  const periods = [
    { limit: 12, text: "صباح الخير" },
    { limit: 18, text: "مساء النور" },
    { limit: 24, text: "مساؤك ورد" },
  ];

  return periods.find(p => hour < p.limit)?.text || "أهلاً بك";
};

const greeting = getGreeting();


  return (
    <div className="relative space-y-7 pb-4">
      {/* توهجات خلفية عائمة — الطبقة الجوية للصفحة */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-fuchsia-400/25 blur-[90px]" />
        <div className="absolute top-1/3 -left-20 w-64 h-64 rounded-full bg-violet-400/20 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full bg-rose-300/25 blur-[80px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-muted-foreground text-sm tracking-wide">{greeting} 🌸</p>
        <h1 className="text-3xl font-extrabold mt-1 tracking-tight">{profile?.full_name ?? "أهلاً"}</h1>
      </motion.div>

      {role === "user" && (
        <>
          {loading ? (
            <div className="h-44 w-full rounded-[28px] bg-white/40 backdrop-blur-xl border border-white/60 animate-pulse" />
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-[28px] p-6 bg-white/30 backdrop-blur-2xl border border-white/50 shadow-[0_8px_40px_-8px_rgba(190,60,140,0.25)]"
            >
              {/* توهج داخلي */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-gradient-to-br from-fuchsia-400/40 to-violet-400/0 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-sm font-medium text-fuchsia-700/80">
                  <Sparkles className="w-4 h-4" /> هدفك الحالي
                </div>
                <h2 className="text-2xl font-extrabold mt-1.5 tracking-tight bg-gradient-to-l from-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
                  {fp ? GOAL_LABELS[fp.goal as keyof typeof GOAL_LABELS] : "—"}
                </h2>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <StatMini label="BMI" value={fp?.bmi ?? "—"} />
                  <StatMini label="التصنيف" value={fp?.bmi ? bmiCategory(fp.bmi) : "—"} />
                  <StatMini label="أيام/أسبوع" value={fp?.frequency ?? "—"} />
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Flame className="w-5 h-5" />} value={streak} label="أيام متتالية" accent="from-orange-400/30 to-rose-400/10" />
            <StatCard icon={<Dumbbell className="w-5 h-5" />} value={workoutsCount} label="إجمالي التمارين" accent="from-violet-400/30 to-fuchsia-400/10" />
            <StatCard icon={<Target className="w-5 h-5" />} value={fp?.frequency ?? 0} label="هدف/أسبوع" accent="from-emerald-400/30 to-teal-400/10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <QuickAction to="/workouts" icon={<Dumbbell className="w-5 h-5" />} title="تمرين اليوم" />
            <QuickAction to="/nutrition" icon={<Apple className="w-5 h-5" />} title="خطة التغذية" />
            <QuickAction to="/trainers" icon={<TrendingUp className="w-5 h-5" />} title="اكتشفي مدربات" />
            <QuickAction to="/chat" icon={<MessageCircle className="w-5 h-5" />} title="الشات" />
          </div>
        </>
      )}

      {role === "trainer" && <TrainerHome userId={user!.id} />}
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white/40 backdrop-blur-md rounded-2xl py-3 border border-white/40">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function StatCard({ icon, value, label, accent }: { icon: React.ReactNode; value: any; label: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 bg-white/35 backdrop-blur-xl border border-white/50 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.1)]">
      <div className={`absolute -top-6 -right-6 w-20 h-20 bg-gradient-to-br ${accent} rounded-full blur-xl`} />
      <div className="relative">
        <div className="text-foreground/70 mb-2">{icon}</div>
        <div className="text-2xl font-extrabold tracking-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, title }: { to: any; icon: React.ReactNode; title: string }) {
  return (
    <Link to={to}>
      <motion.div
        whileTap={{ scale: 0.96 }}
        whileHover={{ y: -2 }}
        className="group relative overflow-hidden p-5 rounded-2xl bg-white/35 backdrop-blur-xl border border-white/50 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] hover:bg-white/50 hover:border-fuchsia-300/50 transition-all duration-300"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 text-fuchsia-700 flex items-center justify-center">
            {icon}
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-fuchsia-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
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
        <StatCard icon={<TrendingUp className="w-5 h-5" />} value={subs} label="مشتركات" accent="from-fuchsia-400/30 to-violet-400/10" />
        <StatCard icon={<Sparkles className="w-5 h-5" />} value={posts} label="منشورات" accent="from-amber-400/30 to-orange-400/10" />
      </div>
      <Link to="/profile" className="block">
        <motion.div
          whileHover={{ y: -2 }}
          className="relative overflow-hidden p-5 rounded-2xl bg-white/35 backdrop-blur-xl border border-white/50 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
        >
          <div className="font-bold">اذهبي إلى ملفك لإدارة المنشورات</div>
          <div className="text-sm text-muted-foreground mt-1">شاركي محتوى ملهم مع مشتركاتك</div>
        </motion.div>
      </Link>
    </>
  );
}