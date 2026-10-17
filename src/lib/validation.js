import { indianStates } from "@/src/config/shop";

export const clean = (value, max = 200) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);

export function normalisePhone(value) {
  return clean(value, 20).replace(/[\s-]/g, "").replace(/^(\+?91)(?=\d{10}$)/, "");
}

export const isValidPhone = (phone) => /^[6-9]\d{9}$/.test(phone);
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Indian delivery address. Returns { address } (DB column names) or { error }.
export function validateAddress(input) {
  const address = {
    name: clean(input?.name, 120),
    phone: normalisePhone(input?.phone),
    line1: clean(input?.addressLine1),
    line2: clean(input?.addressLine2) || null,
    city: clean(input?.city, 80),
    state: clean(input?.state, 80),
    pincode: clean(input?.pincode, 6),
  };
  if (address.name.length < 2) return { error: "Please enter the full name." };
  if (!isValidPhone(address.phone)) return { error: "Please enter a 10-digit Indian mobile number." };
  if (address.line1.length < 3) return { error: "Please enter the street address." };
  if (address.city.length < 2) return { error: "Please enter the city." };
  if (!indianStates.includes(address.state)) return { error: "Please choose the state." };
  if (!/^[1-9]\d{5}$/.test(address.pincode)) return { error: "Please enter a 6-digit PIN code." };
  return { address };
}
