// Checkout rules shared by the browser (display) and the server (the amount actually charged).
// TODO: confirm shipping charges with the team before launch.
export const shopConfig = {
  shippingFlatPaise: 9900,          // ₹99 delivery
  freeShippingOverPaise: 99900,     // free delivery from ₹999
  maxQuantityPerItem: 20,
  maxLinesPerOrder: 30,
};

export function shippingFor(subtotalPaise) {
  if (subtotalPaise <= 0 || subtotalPaise >= shopConfig.freeShippingOverPaise) return 0;
  return shopConfig.shippingFlatPaise;
}

export const indianStates = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];
