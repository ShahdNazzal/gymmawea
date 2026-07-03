import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav, DesktopSidebar } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).maybeSingle();
      if (!r) {
        navigate({ to: "/onboarding" });
        return;
      }
      if (r.role === "user") {
        const { data: fp } = await supabase.from("user_fitness_profile").select("user_id").eq("user_id", u.user.id).maybeSingle();
        if (!fp) {
          navigate({ to: "/onboarding" });
          return;
        }
      } else if (r.role === "trainer") {
        const { data: tp } = await supabase.from("trainer_profiles").select("user_id").eq("user_id", u.user.id).maybeSingle();
        if (!tp) {
          navigate({ to: "/onboarding" });
          return;
        }
      }
      setReady(true);
    })();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen p-4 space-y-3">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:pr-64">
      <DesktopSidebar />
      <main className="pb-28 lg:pb-8 max-w-3xl mx-auto px-4 pt-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
