// Business and policy details used by the legal, contact and about pages.
// Anything starting with "TODO" is shown highlighted on the site and flagged by
// `npm run check:launch`. Fill these in before launch.
export const business = {
  tradeName: "Maati Living",
  legalName: "Maati Living",
  address: {
    line1: "Panjwani Heights, Behind Hotel Babylon Inn, Jail Road, Sai Nagar",
    city: "Raipur",
    state: "Chhattisgarh",
    pincode: "492001",
  },
  gstin: null, // e.g. "27ABCDE1234F1Z5" once registered; leave null if not registered
  jurisdictionCity: "Raipur",
  techSupportEmail: "tech.maatiliving@gmail.com", // problems with the website itself (login, checkout, pages)
  // Required for Indian e-commerce (Consumer Protection (E-Commerce) Rules, 2020).
  grievanceOfficer: {
    name: "Sonam Panjwani",
    email: null, // null → the contact email from siteConfig
  },
  policies: {
    effectiveDate: "21 August 2026",
    dispatchWithinDays: 3, // working days to pack and hand to the courier
    deliveryDays: "4–10", // after dispatch, typical range within India
    damageReportWithinHours: 48, // to report breakage/damage, with photos
    returnWindowDays: 7, // days after delivery
    changeOfMindReturns: false, // true = unused items may be returned for any reason
    refundWithinDays: 7, // working days to issue an approved refund
  },
  // From the "About Maati Living" brochure. bio = paragraphs.
  founders: [
    {
      name: "Shruti",
      role: "Co-founder",
      bio: [
        "Finance is my world. I've spent years working with businesses and entrepreneurs, helping them understand numbers, funding and the practical side of making a business work.",
        "At Maati Living, I'm the one asking, \u201cDoes this actually make sense?\u201d, from sourcing and pricing to finding the right people to work with.",
      ],
    },
    {
      name: "Sonam",
      role: "Co-founder",
      bio: [
        "I'm an engineer turned technology professional, with experience in software development and training.",
        "At Maati Living, I bring curiosity, creativity and a problem-solving mindset to building something meaningful \u2014 always asking, \u201cHow can we make this better?\u201d",
        "For me, innovation isn't just about building something new \u2014 it's about making something that truly matters.",
      ],
    },
    {
      name: "Ankita",
      role: "Co-founder",
      bio: [
        "With a postgraduate degree in education and a love for teaching little children, I've learned to appreciate creativity, patience and the beauty in everyday moments.",
        "At Maati Living, I help shape product ideas and choices, focusing on creating thoughtful, practical products that bring warmth and meaning to everyday living.",
      ],
    },
  ],
};

export const isTodo = (value) =>
  typeof value === "string" && value.startsWith("TODO");

// Every TODO value in the business config, as "path: value" strings.
export function listTodos(value = business, path = "business") {
  if (isTodo(value)) return [`${path}: ${value}`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      listTodos(
        child,
        Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`,
      ),
    );
  }
  return [];
}
