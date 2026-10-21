"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/browser";

// { name, isAdmin } for the signed-in visitor: first name (from their profile, else their email) or null when signed
// out, and whether the server says they're an admin (/api/admin-status; never decided in the browser).
// Sign-in/out happen in server actions, so re-check whenever the page changes.
export default function useAccountName() {
  const [account, setAccount] = useState({ name: null, isAdmin: false });
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const supabase = getSupabaseBrowserClient();
    let active = true;

    const load = async (session) => {
      const user = session?.user;
      if (!user) { if (active) setAccount({ name: null, isAdmin: false }); return; }
      const [{ data }, status] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        fetch("/api/admin-status", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { admin: false })).catch(() => ({ admin: false })),
      ]);
      const full = data?.full_name?.trim() || user.email?.split("@")[0] || "";
      if (active) setAccount({ name: full.split(/\s+/)[0] || null, isAdmin: status.admin === true });
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { load(session); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [pathname]);

  return account;
}
