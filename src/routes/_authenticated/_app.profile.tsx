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

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function ProfilePage() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [fp, setFp] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [openPost, setOpenPost] = useState<any>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: f }, { data: pr }, { data: ps }, { data: ws }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_fitness_profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("progress_logs").select("*").eq("user_id", user.id).order("logged_at"),
      supabase.from("posts").select("*").eq("author_id", user.id).order("created_at", { ascending: false }),
      supabase.from("weekly_schedules").select("*, workouts(name, image_url)").eq("user_id", user.id).order("day_of_week"),
    ]);
    setProfile(p); setFp(f); setProgress(pr ?? []); setPosts(ps ?? []); setSchedule(ws ?? []);
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
              <div className="font-extrabold text-lg">{schedule.length}</div>
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

      {/* الجدول الأسبوعي الخاص بالمستخدم */}
      <Card className="p-5 rounded-3xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-sm flex items-center gap-2"><Calendar className="w-4 h-4" /> جدولي الأسبوعي</div>
          <Link to="/workouts" className="text-xs text-primary font-semibold">تعديل</Link>
        </div>

        {schedule.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">لسا ما عملتي جدول أسبوعي — من صفحة "التمارين" فيكِ تحددي خطتك لكل يوم</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center mb-3">
              {DAYS.map((d, i) => {
                const item = schedule.find((s) => s.day_of_week === i);
                return (
                  <div key={i} className={`p-2 rounded-xl text-[10px] ${item ? "gradient-primary text-primary-foreground" : "bg-muted"}`}>
                    <div className="font-bold">{d.slice(0, 3)}</div>
                    <div className="mt-1 truncate">{item?.title ?? "—"}</div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5">
              {schedule.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl bg-muted/50">
                  <div className="w-14 text-[11px] font-bold text-primary shrink-0">{DAYS[s.day_of_week]}</div>
                  <div className="flex-1 min-w-0 text-xs font-semibold truncate">{s.title}</div>
                  {s.workouts?.name && (
                    <div className="text-[10px] text-muted-foreground truncate shrink-0 max-w-[100px]">{s.workouts.name}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* المنشورات بشكل شبكة على طريقة انستقرام */}
      <Card className="p-5 rounded-3xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold">منشوراتي</div>
          <Button size="sm" onClick={() => setNewPostOpen(true)} className="rounded-xl gradient-primary">
            <ImagePlus className="w-4 h-4 ml-1" /> منشور
          </Button>
        </div>

        {posts.length === 0 && (
          <div className="text-center py-8">
            <ImageOff className="w-9 h-9 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">لا توجد منشورات بعد</p>
          </div>
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
                <img src={p.image_url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
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
          <div className="space-y-2 mt-3">
            {textPosts.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="rounded-2xl p-3 gradient-blush">
                  <p className="text-sm leading-relaxed">{p.content}</p>
                  <div className="text-[10px] text-muted-foreground mt-1.5">{new Date(p.created_at).toLocaleDateString("ar")}</div>
                </div>
              </motion.div>
            ))}
          </div>
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