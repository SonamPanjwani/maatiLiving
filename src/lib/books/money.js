// Rupee text ⇄ integer paise, without floating-point maths.

// "1,23,456.5" → 12345650. Returns null for blank, NaN for anything that isn't a money amount.
export function rupeesToPaise(value, { allowNegative = false } = {}) {
  const raw = String(value ?? "").trim().replace(/[,\s₹]/g, "");
  if (raw === "") return null;
  const match = raw.match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!match || (match[1] && !allowNegative)) return NaN;
  const paise = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(paise)) return NaN;
  return match[1] ? -paise : paise;
}

// 12345650 → "123456.50" (for form inputs); null → "".
export function paiseToRupeeInput(paise) {
  if (paise == null) return "";
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}${rupees}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}
