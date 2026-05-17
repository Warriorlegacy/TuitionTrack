"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function useRealtimeRefresh(tables: string[]) {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured() || tables.length === 0) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`portal-refresh:${tables.join(":")}`);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh(),
      );
    });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, tables]);
}
