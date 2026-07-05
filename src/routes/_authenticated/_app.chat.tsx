import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

// نستخدم هاد المتغير بكل استعلامات عمود "read" لأنه ملف الأنواع التلقائي تبع Supabase
// لسا ما تحدّث ليعرف بعمود read الجديد بجدول messages.
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/_app/chat")({
  head: () => ({ meta: [{ title: "الشات — جمّاوية" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { user, role } = useAuth();
  const [convs, setConvs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      if (role === "trainer") {
        // المدربة: بتشوف كل الأعضاء (أو تقدري تعدليها لاحقًا لتعرض بس اللي راسلوها)
        const { data: trainerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "trainer");
        const trainerIds = new Set((trainerRoles ?? []).map((r) => r.user_id));

        const { data: allProfiles } = await supabase.from("profiles").select("*");
        const members = (allProfiles ?? []).filter(
          (p) => p.id !== user.id && !trainerIds.has(p.id)
        );
        setConvs(members);
      } else {
        // العضوة: بتشوف كل المدربات مباشرة
        const { data: trainerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "trainer");
        const trainerIds = (trainerRoles ?? []).map((r) => r.user_id);

        if (trainerIds.length === 0) {
          setConvs([]);
        } else {
          const { data: profs } = await supabase
            .from("profiles")
            .select("*")
            .in("id", trainerIds);
          setConvs(profs ?? []);
        }
      }

      setLoading(false);
    })();
  }, [user, role]);

  if (selected) return <ChatView userId={user!.id} otherId={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">الشات</h1>

      {loading && <p className="text-sm text-muted-foreground text-center py-8">جارِ التحميل...</p>}

      {!loading && convs.length === 0 && (
        <Card className="p-8 text-center rounded-3xl border-dashed">
          <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {role === "trainer" ? "لا يوجد أعضاء بعد" : "لا يوجد مدربات مسجلات بعد"}
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {convs.map((c) => (
          <button key={c.id} onClick={() => setSelected(c.id)} className="w-full text-right">
            <Card className="p-4 rounded-2xl flex items-center gap-3 hover:shadow-soft transition">
              <div className="w-12 h-12 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center font-extrabold">
                {c.full_name?.[0] ?? "؟"}
              </div>
              <div className="flex-1">
                <div className="font-bold">{c.full_name}</div>
                <div className="text-xs text-muted-foreground">اضغطي لبدء المحادثة</div>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatView({ userId, otherId, onBack }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [other, setOther] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const markAsRead = async () => {
    const { error } = await db
      .from("messages")
      .update({ read: true })
      .eq("recipient_id", userId)
      .eq("sender_id", otherId)
      .eq("read", false);
    if (error) console.error("markAsRead error:", error);
  };

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      setOther(o);
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
        .order("created_at");
      setMessages(msgs ?? []);

      // نعلّم كل الرسائل الجاية من هالشخص كـ "مقروءة" بمجرد ما نفتح المحادثة
      await markAsRead();
    })();

    const channel = supabase
      .channel(`chat-${userId}-${otherId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as any;
        if ((m.sender_id === userId && m.recipient_id === otherId) || (m.sender_id === otherId && m.recipient_id === userId)) {
          setMessages((prev) => [...prev, m]);
          // إذا الرسالة الجديدة وصلت وأنا فاتحة نفس المحادثة، بنعلّمها مقروءة فوراً
          if (m.recipient_id === userId && m.sender_id === otherId) {
            markAsRead();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, otherId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    const { error } = await supabase.from("messages").insert({ sender_id: userId, recipient_id: otherId, content: text });
    if (error) return toast.error("لم يتم الإرسال");
    setText("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center gap-3 pb-3 border-b">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold">
          {other?.full_name?.[0]}
        </div>
        <div className="font-bold">{other?.full_name}</div>
      </div>
      <div className="flex-1 overflow-y-auto py-4 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${mine ? "gradient-primary text-primary-foreground rounded-bl-sm" : "bg-muted rounded-br-sm"}`}>
                {m.content}
                <div className={`text-[10px] mt-1 ${mine ? "opacity-80" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 pt-2 border-t">
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="اكتبي رسالة..." className="rounded-2xl" />
        <Button onClick={send} className="rounded-2xl gradient-primary">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}