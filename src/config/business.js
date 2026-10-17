// Business and policy details used by the legal, contact and about pages.
// Anything starting with "TODO" is shown highlighted on the site and flagged by
// `npm run check:launch`. Fill these in before launch.
export const business = {
  tradeName: "Maati Living",
  legalName: "TODO: registered business or proprietor name",
  address: {
    line1: "TODO: street address",
    city: "TODO: city",
    state: "TODO: state",
    pincode: "TODO: PIN",
  },
  gstin: null, // e.g. "27ABCDE1234F1Z5" once registered; leave null if not registered
  jurisdictionCity: "TODO: city for courts (usually where the business is registered)",
  // Required for Indian e-commerce (Consumer Protection (E-Commerce) Rules, 2020).
  grievanceOfficer: {
    name: "TODO: name of the person who handles complaints",
    email: null, // null → the contact email from siteConfig
  },
  policies: {
    effectiveDate: "TODO: date these policies take effect, e.g. 1 December 2026",
    dispatchWithinDays: 3,         // working days to pack and hand to the courier
    deliveryDays: "4–10",          // after dispatch, typical range within India
    damageReportWithinHours: 48,   // to report breakage/damage, with photos
    returnWindowDays: 7,           // days after delivery
    changeOfMindReturns: false,    // true = unused items may be returned for any reason
    refundWithinDays: 7,           // working days to issue an approved refund
  },
  founders: [
    { name: "TODO: first founder's name", role: "Co-founder", bio: "TODO: a few lines in her own words." },
    { name: "TODO: second founder's name", role: "Co-founder", bio: "TODO: a few lines in her own words." },
  ],
};

export const isTodo = (value) => typeof value === "string" && value.startsWith("TODO");

// Every TODO value in the business config, as "path: value" strings.
export function listTodos(value = business, path = "business") {
  if (isTodo(value)) return [`${path}: ${value}`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => listTodos(child, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`));
  }
  return [];
}
