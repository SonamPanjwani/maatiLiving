import { defaultShippingSettings } from "@/src/config/shop";
import { isSupabaseConfigured } from "./supabase/config";
import { getSupabasePublicClient } from "./supabase/public";

// Normalises whatever is stored so callers always get { defaultPaise, freeOverPaise, byStatePaise }.
export function normaliseShipping(value) {
  const toPaise = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
  const byStatePaise = {};
  for (const [state, paise] of Object.entries(value?.byStatePaise ?? {})) {
    if (toPaise(paise) != null) byStatePaise[state] = paise;
  }
  return {
    defaultPaise: toPaise(value?.defaultPaise) ?? defaultShippingSettings.defaultPaise,
    freeOverPaise: value && "freeOverPaise" in value ? toPaise(value.freeOverPaise) : defaultShippingSettings.freeOverPaise,
    byStatePaise,
  };
}

// Public read (RLS allows anyone); used by the cart, checkout and the server-side quote.
export async function getShippingSettings() {
  if (!isSupabaseConfigured) return defaultShippingSettings;
  const { data, error } = await getSupabasePublicClient().from("settings").select("value").eq("key", "shipping").maybeSingle();
  if (error) {
    // Table missing (0004 not run yet) → fall back rather than break checkout.
    console.error("Shipping settings:", error.message);
    return defaultShippingSettings;
  }
  return normaliseShipping(data?.value);
}
