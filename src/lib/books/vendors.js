import { clean, isValidEmail, isValidPhone, normalisePhone } from "../validation.js";
import { rupeesToPaise } from "./money.js";

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;

const upper = (value, max) => clean(value, max).toUpperCase().replace(/\s+/g, "");

// Form input → vendors row (DB column names), or { error }. Mirrors the DB checks so errors are friendly.
export function validateVendor(input) {
  const phone = normalisePhone(input?.phone);
  const whatsapp = normalisePhone(input?.whatsapp) || phone;
  const row = {
    name: clean(input?.name, 120),
    contact_person: clean(input?.contactPerson, 120) || null,
    phone: phone || null,
    whatsapp: whatsapp || null,
    email: clean(input?.email, 160).toLowerCase() || null,
    city: clean(input?.city, 80) || null,
    state: clean(input?.state, 80) || null,
    address: clean(input?.address, 300) || null,
    gstin: upper(input?.gstin, 15) || null,
    pan: upper(input?.pan, 10) || null,
    upi_id: clean(input?.upiId, 120) || null,
    bank_account_name: clean(input?.bankAccountName, 120) || null,
    bank_account_number: clean(input?.bankAccountNumber, 30).replace(/\s+/g, "") || null,
    bank_ifsc: upper(input?.bankIfsc, 11) || null,
    supplies: clean(input?.supplies, 300) || null,
    notes: String(input?.notes ?? "").trim().slice(0, 2000) || null,
    rating: input?.rating ? Number(input.rating) : null,
    payment_terms_days: input?.paymentTermsDays === undefined || input?.paymentTermsDays === "" ? 0 : Number(input.paymentTermsDays),
    opening_balance_paise: rupeesToPaise(input?.openingBalance, { allowNegative: true }) ?? 0,
  };

  if (row.name.length < 2) return { error: "Please enter the vendor's name." };
  if (row.phone && !isValidPhone(row.phone)) return { error: "Phone must be a 10-digit Indian mobile number." };
  if (row.whatsapp && !isValidPhone(row.whatsapp)) return { error: "WhatsApp must be a 10-digit Indian mobile number." };
  if (row.email && !isValidEmail(row.email)) return { error: "Please enter a valid email, or leave it blank." };
  if (row.gstin && !GSTIN_RE.test(row.gstin)) return { error: "GSTIN should be 15 characters, e.g. 22AAAAA0000A1Z5 — or leave it blank." };
  if (row.pan && !PAN_RE.test(row.pan)) return { error: "PAN should look like ABCDE1234F — or leave it blank." };
  if (row.upi_id && !UPI_RE.test(row.upi_id)) return { error: "UPI ID should look like name@bank — or leave it blank." };
  if (row.bank_account_number && !/^[0-9]{9,18}$/.test(row.bank_account_number)) return { error: "Bank account number should be 9–18 digits." };
  if (row.bank_ifsc && !IFSC_RE.test(row.bank_ifsc)) return { error: "IFSC should look like HDFC0001234." };
  if (row.rating !== null && !(Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5)) return { error: "Rating must be 1 to 5." };
  if (!Number.isInteger(row.payment_terms_days) || row.payment_terms_days < 0 || row.payment_terms_days > 365) return { error: "Payment terms must be 0–365 days." };
  if (Number.isNaN(row.opening_balance_paise)) return { error: "Opening balance must be an amount in rupees, e.g. 2500 or 2500.50." };
  return { row };
}
