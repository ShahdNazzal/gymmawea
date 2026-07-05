import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowRight, Dumbbell, ChevronDown, ChevronUp, ImageOff, X,
  Heart, MessageCircle, MoreVertical, Send, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// نستخدم هاد المتغير بكل استعلامات الجداول الجديدة (post_likes / post_comments)
// لأنه ملف الأنواع التلقائي تبع Supabase لسا ما تحدث فيهم
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/_app/u/$id")({
  head: () => ({ meta: [{ title: "الملف الشخصي — جمّاوية" }] }),
  component: PublicUserProfile,
});

type PostMeta = { likesCount: number; likedByMe: boolean; commentsCount: number };

function PublicUserProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [postsMeta, setPostsMeta] = useState<Record<string, PostMeta>>({});
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [isTrainer, setIsTrainer] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [openWorkoutId, setOpenWorkoutId] = useState<string | null>(null);
  const [openPost, setOpenPost] = useState<any>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  const isOwnProfile = currentUser?.id === id;

  // نجيب المنشورات + بيانات اللايك/التعليقات، ونعتمد على بروفايل الصفحة نفسه (profileData)
  // بدل أي join معقّد مع جدول profiles
  const loadPosts = async (profileData: any) => {
    setLoadingPosts(true);
    const { data: ps, error } = await supabase
      .from("posts")
      .select("*")
      .eq("author_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadPosts error:", error);
      toast.error("تعذر تحميل المنشورات: " + error.message);
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    const rows = ps ?? [];
    setPosts(rows.map((p: any) => ({ ...p, profiles: profileData })));

    const postIds = rows.map((p: any) => p.id);
    if (postIds.length === 0) {
      setPostsMeta({});
      setLoadingPosts(false);
      return;
    }

    const [{ data: likes, error: likesErr }, { data: comments, error: commentsErr }] = await Promise.all([
      db.from("post_likes").select("post_id, user_id").in("post_id", postIds),
      db.from("post_comments").select("post_id").in("post_id", postIds),
    ]);

    if (likesErr) console.error("likes error:", likesErr);
    if (commentsErr) console.error("comments error:", commentsErr);

    const meta: Record<string, PostMeta> = {};
    for (const p of rows) {
      const postLikes = (likes ?? []).filter((l: any) => l.post_id === p.id);
      meta[p.id] = {
        likesCount: postLikes.length,
        likedByMe: postLikes.some((l: any) => l.user_id === currentUser?.id),
        commentsCount: (comments ?? []).filter((c: any) => c.post_id === p.id).length,
      };
    }
    setPostsMeta(meta);
    setLoadingPosts(false);
  };

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: r }, { data: ws }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle(),
        supabase.from("workouts").select("*").eq("owner_user_id", id).eq("is_public", true).order("created_at", { ascending: false }),
      ]);
      setProfile(p);
      setWorkouts(ws ?? []);
      setIsTrainer(r?.role === "trainer");
      await loadPosts(p);
    })();
  }, [id]);

  if (isTrainer) {
    if (typeof window !== "undefined") window.location.replace(`/trainer/${id}`);
    return null;
  }

  const toggleWorkout = (workoutId: string) => {
    setOpenWorkoutId((prev) => (prev === workoutId ? null : workoutId));
  };

  const toggleLike = async (post: any) => {
    if (!currentUser) return;
    const meta = postsMeta[post.id] ?? { likesCount: 0, likedByMe: false, commentsCount: 0 };
    if (meta.likedByMe) {
      setPostsMeta((prev) => ({ ...prev, [post.id]: { ...meta, likedByMe: false, likesCount: Math.max(0, meta.likesCount - 1) } }));
      const { error } = await db.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUser.id);
      if (error) { toast.error("تعذر إلغاء اللايك"); setPostsMeta((prev) => ({ ...prev, [post.id]: meta })); }
    } else {
      setPostsMeta((prev) => ({ ...prev, [post.id]: { ...meta, likedByMe: true, likesCount: meta.likesCount + 1 } }));
      const { error } = await db.from("post_likes").insert({ post_id: post.id, user_id: currentUser.id });
      if (error) { toast.error("تعذر تسجيل اللايك"); setPostsMeta((prev) => ({ ...prev, [post.id]: meta })); }
    }
  };

  const deletePost = async (post: any) => {
    if (!confirm("حذف المنشور؟")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return toast.error("تعذر حذف المنشور");
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    toast.success("تم حذف المنشور");
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={() => navigate({ to: "/search" })} className="rounded-xl -mr-2">
        <ArrowRight className="w-4 h-4 ml-1" /> رجوع
      </Button>

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



















{/* الخطط العامة */}
      {workouts.length > 0 && (
        <div>
          <h2 className="font-bold mb-3 pt-2">الخطط العامة</h2>
          <div className="grid gap-2">
            {workouts.map((w) => {
              const isOpen = openWorkoutId === w.id;
              const days = Array.isArray(w.exercises) ? w.exercises : [];

              return (
                <Card key={w.id} className="rounded-2xl overflow-hidden">
                  <button type="button" onClick={() => toggleWorkout(w.id)} className="w-full p-4 flex items-center gap-3 text-right">
                    {w.image_url ? (
                      <img src={w.image_url} className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center"><Dumbbell className="w-5 h-5 text-muted-foreground" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{days.length} يوم</div>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                  </button>

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
                          {w.description && <p className="text-sm text-muted-foreground">{w.description}</p>}
                          {days.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد تفاصيل تمارين</p>}
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

















      {/* المنشورات - فيد على طريقة انستقرام */}
      <div className="space-y-4">
        <h2 className="font-bold">المنشورات</h2>

        {loadingPosts && <p className="text-xs text-muted-foreground text-center py-4">جاري التحميل...</p>}

        {!loadingPosts && posts.length === 0 && (
          <Card className="p-8 text-center rounded-3xl border-dashed">
            <ImageOff className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد منشورات بعد</p>
          </Card>
        )}

        {posts.map((post, i) => {
          const meta = postsMeta[post.id] ?? { likesCount: 0, likedByMe: false, commentsCount: 0 };
          return (
            <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="rounded-2xl overflow-hidden border-none shadow-soft p-2">
                <div className="flex items-center gap-2.5 p-3">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                      {profile?.full_name?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{profile?.full_name}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(post.created_at).toLocaleDateString("ar")}</div>
                  </div>
                  {isOwnProfile && (
                    <button onClick={() => deletePost(post)} className="p-1.5 text-muted-foreground hover:text-destructive">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {post.image_url && (
                  <button type="button" onClick={() => setOpenPost(post)} className="block w-full">
                    <img src={post.image_url} className="w-full aspect-square object-cover" />
                  </button>
                )}

                <div className="flex items-center gap-4 px-3 pt-2.5">
                  <button onClick={() => toggleLike(post)} className="flex items-center gap-1.5">
                    <Heart className={`w-6 h-6 transition ${meta.likedByMe ? "fill-primary text-primary" : "text-foreground"}`} />
                  </button>
                  <button onClick={() => setCommentsPostId(post.id)} className="flex items-center gap-1.5">
                    <MessageCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="px-3 pt-1.5 flex items-center gap-3 text-xs font-semibold">
                  <span>{meta.likesCount} إعجاب</span>
                  <button onClick={() => setCommentsPostId(post.id)} className="text-muted-foreground">
                    عرض التعليقات ({meta.commentsCount})
                  </button>
                </div>

                {post.content && (
                  <div className="px-3 pt-1.5 pb-3 text-sm leading-relaxed">
                    <span className="font-bold ml-1">{profile?.full_name}</span>
                    {post.content}
                  </div>
                )}
                {!post.content && <div className="pb-2" />}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* لايتبوكس بسيط لعرض صورة المنشور موسّعة */}
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

      

      {/* ديالوج التعليقات (بدون ردود متشعبة - تعليقات مباشرة فقط) */}
      <CommentsDialog
        postId={commentsPostId}
        open={!!commentsPostId}
        onClose={() => setCommentsPostId(null)}
        currentUserId={currentUser?.id ?? null}
        postAuthorId={id}
        onCountChange={(postId: string, count: number) =>
          setPostsMeta((prev) => ({ ...prev, [postId]: { ...(prev[postId] ?? { likesCount: 0, likedByMe: false, commentsCount: 0 }), commentsCount: count } }))
        }
      />
    </div>
  );
}

function CommentsDialog({ postId, open, onClose, currentUserId, postAuthorId, onCountChange }: any) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    if (!postId) return;
    setLoading(true);
    const { data, error } = await db
      .from("post_comments")
      .select("*, profiles(full_name, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) console.error("comments load error:", error);
    setComments(data ?? []);
    onCountChange?.(postId, (data ?? []).length);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    else setText("");
  }, [open, postId]);

  const submit = async () => {
    if (!text.trim() || !currentUserId || !postId) return;
    setPosting(true);
    try {
      const { error } = await db.from("post_comments").insert({
        post_id: postId,
        user_id: currentUserId,
        content: text.trim(),
      });
      if (error) throw error;
      setText("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "تعذر إضافة التعليق");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (comment: any) => {
    if (!confirm("حذف التعليق؟")) return;
    const { error } = await db.from("post_comments").delete().eq("id", comment.id);
    if (error) return toast.error("تعذر حذف التعليق");
    await load();
  };

  const canDelete = (comment: any) => currentUserId && (comment.user_id === currentUserId || postAuthorId === currentUserId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle>التعليقات</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {loading && <p className="text-xs text-muted-foreground text-center py-6">جاري التحميل...</p>}
          {!loading && comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">لا توجد تعليقات بعد — كوني أول من يعلق</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="mt-3">
              <div className="flex items-start gap-2">
                {comment.profiles?.avatar_url ? (
                  <img src={comment.profiles.avatar_url} className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-[11px] font-bold shrink-0">
                    {comment.profiles?.full_name?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/60 rounded-2xl px-3 py-2">
                    <div className="text-xs font-bold">{comment.profiles?.full_name}</div>
                    <div className="text-sm leading-relaxed">{comment.content}</div>
                  </div>
                  <div className="flex items-center gap-3 mt-1 px-1 text-[10px] text-muted-foreground">
                    <span>{new Date(comment.created_at).toLocaleDateString("ar")}</span>
                    {canDelete(comment) && (
                      <button onClick={() => remove(comment)} className="flex items-center gap-1 font-semibold text-destructive">
                        <Trash2 className="w-3 h-3" /> حذف
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتبي تعليقاً..."
            className="flex-1 rounded-2xl border border-input bg-background px-3 h-10 text-sm"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button size="icon" disabled={posting || !text.trim()} onClick={submit} className="rounded-full gradient-primary shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}