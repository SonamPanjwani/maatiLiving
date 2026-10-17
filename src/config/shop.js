// Checkout rules shared by the browser (display) and the server (the amount actually charged).
export const shopConfig = {
  maxQuantityPerItem: 20,
  maxLinesPerOrder: 30,
};

// Delivery charges are edited in /admin/settings (stored in the `settings` table, key "shipping").
// These defaults apply until that row exists or when Supabase isn't configured.
export const defaultShippingSettings = {
  defaultPaise: 9900,       // any state without its own rate
  freeOverPaise: 99900,     // free delivery from this subtotal; null = never free
  byStatePaise: {},         // { "Kerala": 12000, … }
};

// Returns paise, or null when the state isn't known yet (cart page: "calculated at checkout").
export function shippingFor(subtotalPaise, state, settings = defaultShippingSettings) {
  if (subtotalPaise <= 0) return 0;
  if (settings.freeOverPaise != null && subtotalPaise >= settings.freeOverPaise) return 0;
  if (!state) return null;
  return settings.byStatePaise?.[state] ?? settings.defaultPaise;
}

export const indianStates = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];
