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
import { Plus, Settings as SettingsIcon, TrendingUp, Camera, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { GOAL_LABELS } from "@/lib/workout-rules";
import { uploadFile } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/_app/profile")({
  head: () => ({ meta: [{ title: "ملفي — جمّاوية" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [fp, setFp] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const avatarInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: f }, { data: pr }, { data: ps }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_fitness_profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("progress_logs").select("*").eq("user_id", user.id).order("logged_at"),
      supabase.from("posts").select("*").eq("author_id", user.id).order("created_at", { ascending: false }),
    ]);
    setProfile(p); setFp(f); setProgress(pr ?? []); setPosts(ps ?? []);
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

      <Card className="p-6 rounded-3xl gradient-blush border-none">
        <div className="flex items-center gap-4">
          <button onClick={() => avatarInput.current?.click()} className="relative">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="w-20 h-20 rounded-3xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center text-3xl font-extrabold text-primary-foreground shadow-soft">
                {profile?.full_name?.[0] ?? "؟"}
              </div>
            )}
            <div className="absolute -bottom-1 -left-1 bg-white rounded-full p-1.5 shadow-soft"><Camera className="w-3.5 h-3.5" /></div>
            <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
          </button>
          <div>
            <div className="font-extrabold text-xl">{profile?.full_name}</div>
            <div className="text-xs text-primary font-semibold mt-0.5">
              {role === "trainer" ? "مدربة معتمدة" : "عضوة"}
            </div>
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

      <Card className="p-5 rounded-3xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold">منشوراتي</div>
          <Button size="sm" onClick={() => setNewPostOpen(true)} className="rounded-xl gradient-primary">
            <ImagePlus className="w-4 h-4 ml-1" /> منشور
          </Button>
        </div>
        {posts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">لا توجد منشورات</p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((p) => (
              <div key={p.id} className="aspect-square rounded-xl bg-muted overflow-hidden relative">
                {p.image_url ? (
                  <img src={p.image_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="p-2 text-xs">{p.content.slice(0, 60)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

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
