import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Heart, Search, Users, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/_app/trainers")({
  head: () => ({ meta: [{ title: "المدربات — جمّاوية" }] }),
  component: TrainersPage,
});

function TrainersPage() {
  const { user } = useAuth();
  const [trainers, setTrainers] = useState<any[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
     
      







const { data: trainers } = await supabase
  .from("trainer_profiles")
  .select("*");

const ids = trainers?.map(t => t.user_id) ?? [];

const { data: profiles } = await supabase
  .from("profiles")
  .select("id, full_name, avatar_url")
  .in("id", ids);

const merged = (trainers ?? []).map(t => ({
  ...t,
  profiles: profiles?.find(p => p.id === t.user_id)
}));

setTrainers(merged);
setLoading(false);




      
      if (user) {
        const { data: f } = await supabase.from("trainer_favorites").select("trainer_id").eq("user_id", user.id);
        setFavs(new Set((f ?? []).map((x) => x.trainer_id)));
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = trainers.filter(
    (t) =>
      !q ||
      t.specialization?.toLowerCase().includes(q.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(q.toLowerCase())
  );

  const toggleFav = async (trainerId: string) => {
    if (!user) return;
    const isFav = favs.has(trainerId);
    if (isFav) {
      await supabase.from("trainer_favorites").delete().eq("user_id", user.id).eq("trainer_id", trainerId);
      const s = new Set(favs); s.delete(trainerId); setFavs(s);
    } else {
      await supabase.from("trainer_favorites").insert({ user_id: user.id, trainer_id: trainerId });
      setFavs(new Set([...favs, trainerId]));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">اكتشفي مدربات</h1>
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحثي بالتخصص أو الاسم" className="rounded-2xl pr-10 h-12" />
      </div>

      {loading && <Skeleton className="h-32 rounded-3xl" />}

      {!loading && filtered.length === 0 && (
        <Card className="p-8 rounded-3xl text-center border-dashed">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد مدربات بعد. سجلي مدربة لتظهر هنا.</p>
        </Card>
      )}

      <div className="grid gap-3">
        {filtered.map((t, i) => (
          <motion.div key={t.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="p-4 rounded-3xl flex items-center gap-3 hover:shadow-elegant transition">
              <Link to="/trainer/$id" params={{ id: t.user_id }} className="flex items-center gap-3 flex-1">
                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-extrabold text-lg shrink-0">
                  {t.profiles?.full_name?.[0] ?? "م"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{t.profiles?.full_name ?? "مدربة"}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.specialization}</div>
                  <div className="text-xs text-primary font-semibold mt-0.5 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> {t.experience_years} سنوات خبرة
                  </div>
                </div>
              </Link>
              <button onClick={() => toggleFav(t.user_id)} className="p-2">
                <Heart className={`w-5 h-5 ${favs.has(t.user_id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
