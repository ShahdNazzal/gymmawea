import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/search")({
  head: () => ({ meta: [{ title: "بحث — جمّاوية" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [trainerIds, setTrainerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "trainer")
      .then(({ data }) => {
        setTrainerIds(new Set((data ?? []).map((r) => r.user_id)));
      });
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio")
        .limit(30);

      if (q.trim()) query = query.ilike("full_name", `%${q}%`);

      const { data } = await query;
      setResults(data ?? []);
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  // ✅ فصل البيانات
  const trainers = results.filter((p) => trainerIds.has(p.id));
  const members = results.filter((p) => !trainerIds.has(p.id));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">بحث</h1>

      <div className="relative">
        <SearchIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحثي عن اسم..."
          className="rounded-2xl pr-10 h-12"
        />
      </div>

      {/* 🟣 المدربات */}
      {trainers.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-primary">coaches</h2>

          <div className="grid gap-2">
            {trainers.map((p) => (
              <Link
                key={p.id}
                to="/trainer/$id"
                params={{ id: p.id }}
              >
                <Card className="p-3 rounded-2xl flex items-center gap-3">
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      className="w-12 h-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-extrabold">
                      {p.full_name?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{p.full_name}</div>
                    <div className="text-xs text-primary">مدربة</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 🌸 الأعضاء */}
      {members.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">muscle mommies</h2>

          <div className="grid gap-2">
            {members.map((p) => (
              <Link
                key={p.id}
                to="/u/$id"
                params={{ id: p.id }}
              >
                <Card className="p-3 rounded-2xl flex items-center gap-3">
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      className="w-12 h-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-extrabold">
                      {p.full_name?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">عضوة</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ❌ لا نتائج */}
      {results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          لا نتائج
        </p>
      )}
    </div>
  );
}