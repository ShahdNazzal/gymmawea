import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      navigate({ to: data.session ? "/home" : "/auth", replace: true });
    })();
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center gradient-blush">
      <div className="w-12 h-12 rounded-3xl gradient-primary animate-pulse" />
    </div>
  );
}
