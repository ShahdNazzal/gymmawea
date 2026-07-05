import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Dumbbell, ChevronDown, ChevronUp, ImageOff, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

  // معرف الخطة المفتوحة حالياً (null يعني ما في خطة مفتوحة)
  const [openWorkoutId, setOpenWorkoutId] = useState<string | null>(null);
  // المنشور المفتوح حالياً بشكل موسّع (لايتبوكس بسيط)
  const [openPost, setOpenPost] = useState<any>(null);

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

  const toggleWorkout = (workoutId: string) => {
    setOpenWorkoutId((prev) => (prev === workoutId ? null : workoutId));
  };

  const imagePosts = posts.filter((p) => !!p.image_url);
  const textPosts = posts.filter((p) => !p.image_url);

  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={() => navigate({ to: "/search" })} className="rounded-xl -mr-2"><ArrowRight className="w-4 h-4 ml-1" /> رجوع</Button>

      {/* بطاقة البروفايل */}
      <Card className="rounded-3xl border-none shadow-soft overflow-hidden">
        <div className="h-16 gradient-primary" />
        <div className="p-6 pt-0 -mt-10">
          <div className="flex items-end gap-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-24 h-24 rounded-3xl object-cover border-4 border-background shadow-soft" />
            ) : (
              <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center text-primary-foreground text-4xl font-extrabold border-4 border-background shadow-soft">
                {profile?.full_name?.[0]}
              </div>
            )}
            <div className="pb-1">
              <div className="font-extrabold text-xl">{profile?.full_name}</div>
              <div className="text-xs text-primary font-semibold">عضوة</div>
            </div>
          </div>

          {profile?.bio && <p className="text-sm mt-4 leading-relaxed text-muted-foreground">{profile.bio}</p>}

          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="font-extrabold text-lg">{posts.length}</div>
              <div className="text-[11px] text-muted-foreground">منشور</div>
            </div>
            <div className="text-center">
              <div className="font-extrabold text-lg">{workouts.length}</div>
              <div className="text-[11px] text-muted-foreground">خطة تمرين</div>
            </div>
          </div>
        </div>
      </Card>

      {/* المنشورات - شكل شبكة على طريقة انستقرام */}
      <div>
        <h2 className="font-bold mb-3">المنشورات</h2>

        {posts.length === 0 && (
          <Card className="p-8 text-center rounded-3xl border-dashed">
            <ImageOff className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد منشورات بعد</p>
          </Card>
        )}

        {imagePosts.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {imagePosts.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => setOpenPost(p)}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="relative aspect-square rounded-2xl overflow-hidden group"
              >
                <img
                  src={p.image_url}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {p.content && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-2">
                    <p className="text-[11px] text-white/95 line-clamp-2 text-right leading-snug">{p.content}</p>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {textPosts.length > 0 && (
          <div className="space-y-3 mt-3">
            {textPosts.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="rounded-2xl p-4 gradient-blush border-none">
                  <p className="text-sm leading-relaxed">{p.content}</p>
                  <div className="text-[10px] text-muted-foreground mt-2">{new Date(p.created_at).toLocaleDateString("ar")}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* لايتبوكس بسيط لعرض المنشور موسّعاً بدون مغادرة الصفحة */}
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

      {/* الخطط العامة */}
      {workouts.length > 0 && (
        <div>
          <h2 className="font-bold mb-3 pt-2">الخطط العامة</h2>
          <div className="grid gap-2">
            {workouts.map((w) => {
              const isOpen = openWorkoutId === w.id;
              // نفس بنية البيانات المستخدمة بصفحة التمارين: مصفوفة أيام، كل يوم فيه name و items
              const days = Array.isArray(w.exercises) ? w.exercises : [];

              return (
                <Card key={w.id} className="rounded-2xl overflow-hidden">
                  {/* رأس الكارد - قابل للضغط لفتح/إغلاق التفاصيل بدون أي انتقال لصفحة أخرى */}
                  <button
                    type="button"
                    onClick={() => toggleWorkout(w.id)}
                    className="w-full p-4 flex items-center gap-3 text-right"
                  >
                    {w.image_url ? (
                      <img src={w.image_url} className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center"><Dumbbell className="w-5 h-5 text-muted-foreground" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{days.length} يوم</div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {/* تفاصيل التمارين تظهر هون بنفس الصفحة لما تكون الخطة مفتوحة */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-4 border-t pt-3">
                          {w.description && (
                            <p className="text-sm text-muted-foreground">{w.description}</p>
                          )}

                          {days.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">لا توجد تفاصيل تمارين</p>
                          )}

                          {days.map((d: any, dayIdx: number) => (
                            <div key={dayIdx} className="space-y-2">
                              <div className="text-sm font-bold text-primary">{d.name ?? `اليوم ${d.day ?? dayIdx + 1}`}</div>
                              <ul className="space-y-2">
                                {(d.items ?? []).map((ex: any, exIdx: number) => (
                                  <li key={exIdx} className="bg-muted/50 rounded-xl p-3 flex items-center justify-between gap-2">
                                    <span className="font-semibold text-sm">{ex?.name ?? `تمرين ${exIdx + 1}`}</span>
                                    <span className="text-xs font-semibold text-muted-foreground shrink-0">{ex?.sets} × {ex?.reps}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}