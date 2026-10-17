// Checkout rules shared by the browser (display) and the server (the amount actually charged).
//
// Delivery is location-based. TODO: fill shippingByStatePaise with the real per-state rates
// (and confirm/remove freeShippingOverPaise) before launch. Until then every state uses the
// placeholder defaultShippingPaise.
export const shopConfig = {
  defaultShippingPaise: 9900,       // placeholder ₹99
  shippingByStatePaise: {
    // "Maharashtra": 6000,
    // "Kerala": 12000,
  },
  freeShippingOverPaise: 99900,     // placeholder: free delivery from ₹999 (set to null to disable)
  maxQuantityPerItem: 20,
  maxLinesPerOrder: 30,
};

// Returns paise, or null when the state isn't known yet (cart page: "calculated at checkout").
export function shippingFor(subtotalPaise, state) {
  if (subtotalPaise <= 0) return 0;
  if (shopConfig.freeShippingOverPaise != null && subtotalPaise >= shopConfig.freeShippingOverPaise) return 0;
  if (!state) return null;
  return shopConfig.shippingByStatePaise[state] ?? shopConfig.defaultShippingPaise;
}

export const indianStates = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];
