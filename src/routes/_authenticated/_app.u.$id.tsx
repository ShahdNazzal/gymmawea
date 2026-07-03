import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Dumbbell } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/_app/u/$id")({
  head: () => ({ meta: [{ title: "الملف الشخصي — جمّاوية" }] }),
  component: PublicUserProfile,
});

function PublicUserProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: ps }, { data: r }, { data: ws }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("posts").select("*").eq("author_id", id).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle(),
        supabase.from("workouts").select("*").eq("owner_user_id", id).eq("is_public", true).order("created_at", { ascending: false }),
      ]);
      setProfile(p); setPosts(ps ?? []); setWorkouts(ws ?? []);
      setIsTrainer(r?.role === "trainer");
    })();
  }, [id]);

  if (isTrainer) {
    // redirect to trainer view
    if (typeof window !== "undefined") window.location.replace(`/trainer/${id}`);
    return null;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate({ to: "/search" })} className="rounded-xl -mr-2"><ArrowRight className="w-4 h-4 ml-1" /> رجوع</Button>

      <Card className="p-6 rounded-3xl gradient-blush border-none flex items-center gap-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} className="w-20 h-20 rounded-3xl object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center text-primary-foreground text-3xl font-extrabold">{profile?.full_name?.[0]}</div>
        )}
        <div>
          <div className="font-extrabold text-xl">{profile?.full_name}</div>
          <div className="text-xs text-primary font-semibold">عضوة</div>
          {profile?.bio && <p className="text-sm mt-1">{profile.bio}</p>}
        </div>
      </Card>

      <h2 className="font-bold">المنشورات</h2>
      {posts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد منشورات</p>}
      <div className="space-y-3">
        {posts.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="rounded-2xl overflow-hidden">
              {p.image_url && <img src={p.image_url} className="w-full aspect-square object-cover" />}
              {p.content && <div className="p-4 text-sm">{p.content}</div>}
              <div className="px-4 pb-3 text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar")}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {workouts.length > 0 && (
        <>
          <h2 className="font-bold pt-2">الخطط العامة</h2>
          <div className="grid gap-2">
            {workouts.map((w) => (
              <Card key={w.id} className="p-4 rounded-2xl flex items-center gap-3">
                {w.image_url ? (
                  <img src={w.image_url} className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center"><Dumbbell className="w-5 h-5 text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{w.name}</div>
                  <div className="text-xs text-muted-foreground">{(Array.isArray(w.exercises) ? w.exercises : []).length} يوم</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
