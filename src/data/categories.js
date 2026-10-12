// Placeholder categories until Phase 2 moves the catalogue into Supabase.
// parentSlug is optional — set it to nest a category (e.g. "planters" under "coconut-shell").
export const categories = [
  {
    slug: "diyas",
    name: "Diyas",
    description: "Hand-thrown terracotta diyas for festivals, puja and quiet evenings.",
    parentSlug: null,
    image: { publicId: "maati-living/categories/diyas", alt: "Terracotta diyas glowing in the evening" },
    sortOrder: 1,
  },
  {
    slug: "coconut-shell",
    name: "Coconut shell",
    description: "Planters, stands and everyday pieces shaped from discarded coconut shells.",
    parentSlug: null,
    image: { publicId: "maati-living/categories/coconut-shell", alt: "Polished coconut shell products on a wooden table" },
    sortOrder: 2,
  },
];
