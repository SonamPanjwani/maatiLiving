"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/browser";

// First name of the signed-in customer (from their profile, else their email), or null when signed out.
// Sign-in/out happen in server actions, so re-check whenever the page changes.
export default function useAccountName() {
  const [name, setName] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const supabase = getSupabaseBrowserClient();
    let active = true;

    const load = async (session) => {
      const user = session?.user;
      if (!user) { if (active) setName(null); return; }
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const full = data?.full_name?.trim() || user.email?.split("@")[0] || "";
      if (active) setName(full.split(/\s+/)[0] || null);
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { load(session); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [pathname]);

  return name;
}
