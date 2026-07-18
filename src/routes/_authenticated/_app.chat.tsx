import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  head: () => ({ meta: [{ title: "الشات — EVOLVA" }] }),
  // بندعم رابط مباشر لمحادثة معينة: /chat?with=USER_ID
  // هيك لما نكبس "رسالة" من بروفايل حدا، منروح عالشات معه مباشرة
  // بدل ما نطلع على قائمة كل المحادثات.
  // ملاحظة مهمة: لازم نرجّع "with" كمفتاح اختياري (with?) مش كقيمة ممكن تكون undefined，
  // وإلا TypeScript بيصير يطلب تمرير search بكل مكان فيه Link/navigate لـ /chat حتى لو مش لازم.
  validateSearch: (search: Record<string, unknown>): { with?: string } => {
    const withId = typeof search.with === "string" ? search.with : undefined;
    return withId ? { with: withId } : {};
  },
  component: ChatPage,
});

type ConvMeta = {
  lastMessage: string;
  lastAt: string;
  fromMe: boolean;
  unread: boolean;
};

function ChatPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { with: directId } = Route.useSearch();
  const [convs, setConvs] = useState<any[]>([]);
  const [convsMeta, setConvsMeta] = useState<Record<string, ConvMeta>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // نجيب آخر رسالة + حالة القراءة لكل محادثة، عشان نرتّب حسب الأحدث ونعرض معاينة الرسالة
  const loadConvsMeta = async (userId: string, otherIds: string[]) => {
    if (otherIds.length === 0) return;
    const { data: msgs, error } = await db
      .from("messages")
      .select("sender_id, recipient_id, content, created_at, read")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadConvsMeta error:", error);
      return;
    }

    const meta: Record<string, ConvMeta> = {};
    for (const m of msgs ?? []) {
      const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id;
      if (!otherIds.includes(otherId)) continue;
      if (meta[otherId]) continue; // أول ظهور = أحدث رسالة لأنه مرتبة تنازلياً أصلاً
      meta[otherId] = {
        lastMessage: m.content,
        lastAt: m.created_at,
        fromMe: m.sender_id === userId,
        unread: m.sender_id !== userId && m.read === false,
      };
    }
    setConvsMeta(meta);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      let members: any[] = [];

      if (role === "trainer") {
        // المدربة: بتشوف كل الأعضاء (أو تقدري تعدليها لاحقًا لتعرض بس اللي راسلوها)
        const { data: trainerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "trainer");
        const trainerIds = new Set((trainerRoles ?? []).map((r) => r.user_id));

        const { data: allProfiles } = await supabase.from("profiles").select("*");
        members = (allProfiles ?? []).filter(
          (p) => p.id !== user.id && !trainerIds.has(p.id)
        );
      } else {
        // العضوة: صار فيها تراسل أي حدا مسجّل بالتطبيق (مدربات وأعضاء)، مش بس المدربات متل قبل
        const { data: allProfiles } = await supabase.from("profiles").select("*");
        members = (allProfiles ?? []).filter((p) => p.id !== user.id);
      }

      setConvs(members);
      await loadConvsMeta(user.id, members.map((m) => m.id));
      setLoading(false);
    })();
  }, [user, role]);

  // تحديث فوري لما توصل/تنقرأ رسائل والمستخدم واقف على قائمة المحادثات
  useEffect(() => {
    if (!user || convs.length === 0) return;
    const otherIds = convs.map((c) => c.id);

    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          const m = payload.new;
          if (m.sender_id === user.id || m.recipient_id === user.id) {
            loadConvsMeta(user.id, otherIds);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload: any) => {
          const m = payload.new;
          if (m.sender_id === user.id || m.recipient_id === user.id) {
            loadConvsMeta(user.id, otherIds);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, convs]);

  // ترتيب المحادثات: الأحدث رسالة فوق، واللي ما بعتلهم/منهم أي رسالة لسا ينزلوا تحت
  const sortedConvs = useMemo(() => {
    return [...convs].sort((a, b) => {
      const metaA = convsMeta[a.id];
      const metaB = convsMeta[b.id];
      if (metaA && metaB) return new Date(metaB.lastAt).getTime() - new Date(metaA.lastAt).getTime();
      if (metaA && !metaB) return -1;
      if (!metaA && metaB) return 1;
      return 0;
    });
  }, [convs, convsMeta]);

  const openConversation = async (otherId: string) => {
    setSelected(otherId);
    // نعلّم المحادثة كمقروءة فوراً بمجرد الفتح عشان تتحدث القائمة لما نرجع
    await db.from("messages").update({ read: true }).eq("recipient_id", user!.id).eq("sender_id", otherId).eq("read", false);
    setConvsMeta((prev) => (prev[otherId] ? { ...prev, [otherId]: { ...prev[otherId], unread: false } } : prev));
  };

  // المحادثة الفعّالة حالياً: إما محادثة اخترناها من القائمة، أو محادثة جاية من رابط مباشر (?with=)
  const activeOtherId = selected ?? directId;

  // TODO: احذفي هالسطر بعد التشخيص. إذا directId طلعت undefined رغم إنه بالـ URL
  // فوق كتوب /chat?with=xxxx، معناها المشكلة بجزء الراوتينغ (routeTree.gen.ts قديم).
  console.log("[debug chat] directId من الرابط =", directId, "| activeOtherId =", activeOtherId);

  const handleBack = () => {
    if (directId) {
      // إذا كنا جايين من رابط مباشر (مثلاً من صفحة بروفايل)، الرجوع لازم يشيل الـ query
      // ويرجعنا لقائمة كل المحادثات، مش يفضل يفتح نفس الشخص من جديد.
      navigate({ to: "/chat" });
      return;
    }
    setSelected(null);
    // نحدّث حالة القراءة/المعاينة لما نرجع من المحادثة
    if (user) loadConvsMeta(user.id, convs.map((c) => c.id));
  };

  if (activeOtherId) return <ChatView userId={user!.id} otherId={activeOtherId} onBack={handleBack} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">الشات</h1>

      {loading && <p className="text-sm text-muted-foreground text-center py-8">جارِ التحميل...</p>}

      {!loading && convs.length === 0 && (
        <Card className="p-8 text-center rounded-3xl border-dashed">
          <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {role === "trainer" ? "لا يوجد أعضاء بعد" : "لا يوجد أعضاء أو مدربات مسجلات بعد"}
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {sortedConvs.map((c) => {
          const meta = convsMeta[c.id];
          const preview = meta ? `${meta.fromMe ? "أنتِ: " : ""}${meta.lastMessage}` : "اضغطي لبدء المحادثة";
          const isUnread = !!meta?.unread;

          return (
            <button key={c.id} onClick={() => openConversation(c.id)} className="w-full text-right">
              <Card className="p-4 rounded-2xl flex items-center gap-3 hover:shadow-soft transition">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center font-extrabold">
                    {c.full_name?.[0] ?? "؟"}
                  </div>
                  {isUnread && (
                    <div className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-destructive border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`truncate ${isUnread ? "font-extrabold" : "font-bold"}`}>{c.full_name}</div>
                  <div className={`text-xs truncate mt-0.5 ${isUnread ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                    {preview}
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
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