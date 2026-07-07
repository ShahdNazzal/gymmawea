//C:\Users\lenovo\Downloads\jammawia-main (1)\jammawia-main\src\routes\_authenticated\_app.ai-coach.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, CheckCircle2, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { chatbotHandler } from "@/lib/chatbot";
import type { ChatTurn } from "@/lib/chatbot";

export const Route = createFileRoute("/_authenticated/_app/ai-coach")({
  component: AICoachPage,
});

const VALID_GOALS = ["lose_weight", "gain_muscle", "fitness", "tone"] as const;
const VALID_ACTIVITY = ["sedentary", "light", "moderate", "high"] as const;
const VALID_EQUIPMENT = ["home", "gym", "none"] as const;

type Goal = (typeof VALID_GOALS)[number];
type ActivityLevel = (typeof VALID_ACTIVITY)[number];
type Equipment = (typeof VALID_EQUIPMENT)[number];

type ExerciseItem = {
  name: string;
  instruction: string;
  tips: string;
  sets: number;
  reps: number;
};

type PlanDay = {
  name: string;
  items: ExerciseItem[];
};

type Plan = {
  name: string;
  description: string;
  goal: Goal;
  activity_level: ActivityLevel;
  equipment: Equipment;
  min_frequency: number;
  exercises: PlanDay[];
};

type ChatMessage =
  | { role: "user"; kind: "text"; text: string }
  | { role: "assistant"; kind: "text"; text: string }
  | { role: "assistant"; kind: "plan"; plan: Plan; saved: boolean };

function normalizePlan(raw: any): Plan | null {
  if (!raw || !Array.isArray(raw.exercises)) return null;

  const goal: Goal = (VALID_GOALS as readonly string[]).includes(raw.goal) ? raw.goal : "fitness";
  const activity_level: ActivityLevel = (VALID_ACTIVITY as readonly string[]).includes(raw.activity_level) ? raw.activity_level : "moderate";
  const equipment: Equipment = (VALID_EQUIPMENT as readonly string[]).includes(raw.equipment) ? raw.equipment : "gym";
  const min_frequency = Number.isFinite(+raw.min_frequency) && +raw.min_frequency > 0 ? +raw.min_frequency : 3;

  const exercises: PlanDay[] = raw.exercises.map((day: any, di: number) => ({
    name: typeof day?.name === "string" && day.name.trim() ? day.name.trim() : `اليوم ${di + 1}`,
    items: Array.isArray(day?.items)
      ? day.items
          .filter((it: any) => it?.name?.trim())
          .map((it: any) => ({
            name: it.name.trim(),
            instruction: typeof it.instruction === "string" ? it.instruction.trim() : "",
            tips: typeof it.tips === "string" ? it.tips.trim() : "",
            sets: Number.isFinite(+it.sets) ? +it.sets : 3,
            reps: Number.isFinite(+it.reps) ? +it.reps : 10,
          }))
      : [],
  }));

  if (exercises.length === 0 || exercises.every((d) => d.items.length === 0)) return null;

  return {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "خطة من المدرب الذكي",
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    goal,
    activity_level,
    equipment,
    min_frequency,
    exercises,
  };
}

function AICoachPage() {
  const { user } = useAuth();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // نبني تاريخ المحادثة (نص فقط) عشان نرسله للذكاء الاصطناعي، حتى يقدر يعدّل على خطة سابقة
  function buildHistory(currentMessages: ChatMessage[]): ChatTurn[] {
    return currentMessages.map((m): ChatTurn => {
      if (m.kind === "plan") {
        return { role: "assistant", content: JSON.stringify(m.plan) };
      }
      return { role: m.role, content: m.text };
    });
  }

  async function sendMessage() {
    if (!message.trim()) return;

    const userMessage = message;
    const historyWithUser: ChatMessage[] = [...messages, { role: "user", kind: "text", text: userMessage }];
    setMessages(historyWithUser);
    setMessage("");
    setLoading(true);

    try {
      const apiHistory = buildHistory(historyWithUser);
      const reply = await chatbotHandler(apiHistory);

      let parsed: any = null;
      try {
        const clean = reply.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = null;
      }

      const plan = normalizePlan(parsed);

      if (plan) {
        setMessages((prev) => [...prev, { role: "assistant", kind: "plan", plan, saved: false }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", kind: "text", text: reply }]);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", kind: "text", text: "حدث خطأ أثناء التواصل مع المدرب الذكي، جرّبي مرة ثانية." }]);
    }

    setLoading(false);
  }

  async function approvePlan(index: number) {
    const msg = messages[index];
    if (msg.kind !== "plan" || msg.saved) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("workouts").insert({
        owner_user_id: user?.id,
        name: msg.plan.name,
        description: msg.plan.description || null,
        goal: msg.plan.goal,
        activity_level: msg.plan.activity_level,
        equipment: msg.plan.equipment,
        min_frequency: msg.plan.min_frequency,
        exercises: msg.plan.exercises,
        is_public: false,
      });

      if (error) throw error;

      setMessages((prev) => {
        const copy = [...prev];
        copy[index] = { ...(copy[index] as any), saved: true };
        copy.push({ role: "assistant", kind: "text", text: "🎉 تم حفظ الخطة بنجاح في تمارينك الشخصية، فيكِ تشوفيها من صفحة التمارين." });
        return copy;
      });
    } catch (e: any) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", kind: "text", text: "تعذر حفظ الخطة، جرّبي مرة ثانية." }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold flex gap-2 items-center">
        <Bot /> المدرب الذكي
      </h1>

      <Card className="rounded-3xl p-4 min-h-[400px] space-y-3">
        {messages.map((m, i) => {
          if (m.kind === "text") {
            return (
              <div
                key={i}
                className={m.role === "user" ? "bg-primary text-primary-foreground rounded-2xl p-3 mr-10" : "bg-muted rounded-2xl p-3 ml-10"}
              >
                {m.text}
              </div>
            );
          }

          // معاينة الخطة
          return (
            <div key={i} className="bg-muted rounded-2xl p-4 ml-4 space-y-3">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                <div className="font-extrabold text-sm">{m.plan.name}</div>
              </div>
              {m.plan.description && <p className="text-xs text-muted-foreground">{m.plan.description}</p>}

              <div className="space-y-3">
                {m.plan.exercises.map((day, di) => (
                  <div key={di} className="space-y-1.5">
                    <div className="text-xs font-bold text-primary">{day.name}</div>
                    <div className="space-y-1.5">
                      {day.items.map((ex, ei) => (
                        <div key={ei} className="bg-background rounded-xl px-3 py-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold">{ex.name}</span>
                            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{ex.sets} × {ex.reps}</span>
                          </div>
                          {ex.instruction && <p className="text-[11px] text-muted-foreground leading-relaxed">{ex.instruction}</p>}
                          {ex.tips && <p className="text-[11px] text-primary leading-relaxed">💡 {ex.tips}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {m.saved ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <CheckCircle2 className="w-4 h-4" /> تم اعتماد هذه الخطة
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Button size="sm" disabled={saving} onClick={() => approvePlan(i)} className="w-full rounded-xl gradient-primary">
                    {saving ? "جاري الحفظ..." : "✅ اعتماد الخطة وحفظها"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    ولو بدك تعديل عليها، اكتبيه كرسالة عادية بالأسفل (مثال: "بدّلي التمرين الأول ليوم الأربعاء")
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {loading && <div className="text-sm text-muted-foreground">المدرب يبني الخطة...</div>}
      </Card>

      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          placeholder="اطلب خطة تدريب..."
          className="rounded-xl"
        />
        <Button onClick={sendMessage} disabled={loading} className="rounded-xl">
          <Send />
        </Button>
      </div>
    </div>
  );
}