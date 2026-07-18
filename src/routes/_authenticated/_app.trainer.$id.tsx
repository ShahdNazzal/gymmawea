import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, ArrowRight, Grid3x3, Rows3, Dumbbell, Apple, UserPlus, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/trainer/$id")({
  head: () => ({ meta: [{ title: "المدربة — EVOLVA" }] }),
  component: TrainerProfile,
});

function TrainerProfile() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trainer, setTrainer] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [nutrition, setNutrition] = useState<any[]>([]);
  const [tab, setTab] = useState<"posts" | "workouts" | "nutrition">("posts");
  const [view, setView] = useState<"grid" | "feed">("feed");
  const [following, setFollowing] = useState(false);
  const [likes, setLikes] = useState<Set<string>>(new Set());

  const load = async () => {
    const [{ data: t }, { data: p }, { data: ps }, { data: ws }, { data: ns }] = await Promise.all([
      supabase.from("trainer_profiles").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("posts").select("*").eq("author_id", id).order("created_at", { ascending: false }),
      supabase.from("workouts").select("*").eq("trainer_id", id).order("created_at", { ascending: false }),
      supabase.from("nutrition_plans").select("*").eq("trainer_id", id).order("created_at", { ascending: false }),
    ]);
    setTrainer(t); setProfile(p); setPosts(ps ?? []); setWorkouts(ws ?? []); setNutrition(ns ?? []);
    if (user) {
      const { data: fav } = await supabase.from("trainer_favorites").select("trainer_id").eq("user_id", user.id).eq("trainer_id", id).maybeSingle();
      setFollowing(!!fav);
      const { data: ls } = await supabase.from("post_likes").select("post_id").eq("user_id", user.id);
      setLikes(new Set((ls ?? []).map((x) => x.post_id)));
    }
  };
  useEffect(() => { load(); }, [id, user]);

  const toggleFollow = async () => {
    if (!user) return;
    if (following) {
      await supabase.from("trainer_favorites").delete().eq("user_id", user.id).eq("trainer_id", id);
      setFollowing(false);
    } else {
      await supabase.from("trainer_favorites").insert({ user_id: user.id, trainer_id: id });
      toast.success("تمت المتابعة 💖");
      setFollowing(true);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;
    if (likes.has(postId)) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      const s = new Set(likes); s.delete(postId); setLikes(s);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
      setLikes(new Set([...likes, postId]));
    }
  };

  const adoptWorkout = async (workoutId: string) => {
    if (!user) return;
    const { data: cur } = await supabase.from("active_plan_selection").select("*").eq("user_id", user.id).maybeSingle();
    await supabase.from("active_plan_selection").upsert({
      user_id: user.id,
      workout_plan_type: "trainer",
      workout_plan_id: workoutId,
      nutrition_plan_type: cur?.nutrition_plan_type,
      nutrition_plan_id: cur?.nutrition_plan_id,
    });
    toast.success("تم اعتماد الخطة");
  };

  const adoptNutrition = async (nId: string) => {
    if (!user) return;
    const { data: cur } = await supabase.from("active_plan_selection").select("*").eq("user_id", user.id).maybeSingle();
    await supabase.from("active_plan_selection").upsert({
      user_id: user.id,
      workout_plan_type: cur?.workout_plan_type,
      workout_plan_id: cur?.workout_plan_id,
      nutrition_plan_type: "trainer",
      nutrition_plan_id: nId,
    });
    toast.success("تم اعتماد خطة التغذية");
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate({ to: "/trainers" })} className="rounded-xl -mr-2"><ArrowRight className="w-4 h-4 ml-1" /> رجوع</Button>

      <Card className="p-6 rounded-3xl gradient-blush border-none">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="w-20 h-20 rounded-3xl object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-3xl gradient-primary text-primary-foreground flex items-center justify-center text-3xl font-extrabold shrink-0">
              {profile?.full_name?.[0]}
            </div>
          )}
          {/* min-w-0 + truncate عشان الاسم/التخصص الطويل ما يكسر التصميم عالموبايل */}
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-xl truncate">{profile?.full_name}</div>
            <div className="text-xs text-primary font-semibold truncate">{trainer?.specialization}</div>
            <div className="text-xs text-muted-foreground mt-1">{trainer?.experience_years} سنوات خبرة</div>
          </div>
        </div>
        {trainer?.bio && <p className="text-sm mt-4 leading-relaxed">{trainer.bio}</p>}
        {user?.id !== id && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button onClick={toggleFollow} variant={following ? "outline" : "default"} className="rounded-2xl gradient-primary">
              {following ? <><UserCheck className="w-4 h-4 ml-1" /> متابَعة</> : <><UserPlus className="w-4 h-4 ml-1" /> متابعة</>}
            </Button>
            {/* بدل ما نودّي على قائمة الشات، منروح مباشرة عالمحادثة مع هالمدربة */}
            <Button
              onClick={() => {
                // TODO: احذفي هالسطر بعد ما تتأكدي إنه الرابط عم يتولد صح
                console.log("[debug trainer] كبست رسالة، id المدربة =", id, "→ رايحين لـ /chat?with=" + id);
                navigate({ to: "/chat", search: { with: id } });
              }}
              variant="outline"
              className="rounded-2xl"
            >
              <MessageCircle className="w-4 h-4 ml-1" /> رسالة
            </Button>
          </div>
        )}
      </Card>

      <div className="flex gap-2 p-1 bg-muted rounded-2xl">
        {(["posts", "workouts", "nutrition"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition truncate px-1 ${tab === k ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
            {k === "posts" ? `منشورات (${posts.length})` : k === "workouts" ? `تمارين (${workouts.length})` : `تغذية (${nutrition.length})`}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        <>
          <div className="flex items-center justify-end">
            <div className="flex bg-muted rounded-xl p-1">
              <button onClick={() => setView("feed")} className={`p-1.5 rounded-lg ${view === "feed" ? "bg-card" : ""}`}><Rows3 className="w-4 h-4" /></button>
              <button onClick={() => setView("grid")} className={`p-1.5 rounded-lg ${view === "grid" ? "bg-card" : ""}`}><Grid3x3 className="w-4 h-4" /></button>
            </div>
          </div>
          {posts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد منشورات</p>}
          {view === "grid" ? (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((p) => (
                <div key={p.id} className="aspect-square rounded-xl bg-muted overflow-hidden">
                  {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <div className="p-2 text-xs">{p.content.slice(0, 60)}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((p, i) => (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} key={p.id}>
                  <Card className="rounded-2xl overflow-hidden">
                    {p.image_url && <img src={p.image_url} className="w-full aspect-square object-cover" />}
                    {p.content && <p className="text-sm p-4">{p.content}</p>}
                    <div className="flex items-center gap-3 p-3 pt-0">
                      <button onClick={() => toggleLike(p.id)} className="flex items-center gap-1 text-xs">
                        <Heart className={`w-4 h-4 ${likes.has(p.id) ? "fill-primary text-primary" : ""}`} />
                        {likes.has(p.id) ? "معجبة" : "إعجاب"}
                      </button>
                      <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar")}</span>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* تمارين — تخطيط عمودي (كل عنصر فوق التاني) عشان يبين كامل بعرض الشاشة بدون ما يتزاحم يمين/شمال */}
      {tab === "workouts" && (
        <div className="grid gap-3">
          {workouts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد خطط تمارين</p>}
          {workouts.map((w) => (
            <Card key={w.id} className="p-4 rounded-2xl">
              <div className="flex flex-col items-center text-center gap-2">
                {w.image_url ? (
                  <img src={w.image_url} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center"><Dumbbell className="w-6 h-6" /></div>
                )}
                <div className="w-full">
                  <div className="font-bold break-words">{w.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(Array.isArray(w.exercises) ? w.exercises : []).length} يوم • {w.min_frequency}+/أسبوع
                  </div>
                </div>
              </div>
              {w.description && <p className="text-xs text-muted-foreground mt-3 text-center leading-relaxed">{w.description}</p>}
              {user?.id !== id && (
                <Button size="sm" onClick={() => adoptWorkout(w.id)} className="rounded-xl gradient-primary w-full mt-3">اعتماد</Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* تغذية — نفس مبدأ التخطيط العمودي */}
      {tab === "nutrition" && (
        <div className="grid gap-3">
          {nutrition.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد خطط تغذية</p>}
          {nutrition.map((n) => (
            <Card key={n.id} className="p-4 rounded-2xl">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center"><Apple className="w-6 h-6" /></div>
                <div className="w-full">
                  <div className="font-bold break-words">{n.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {n.min_calories}–{n.max_calories} سعرة • {(Array.isArray(n.meals) ? n.meals : []).length} وجبات
                  </div>
                </div>
              </div>
              {user?.id !== id && (
                <Button size="sm" onClick={() => adoptNutrition(n.id)} className="rounded-xl gradient-primary w-full mt-3">اعتماد</Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
