// Placeholder catalogue until Phase 2 moves products into Supabase. Read it through
// src/lib/catalog.js, not directly, so pages don't change when the source does.
//
// - categorySlug must match a slug in categories.js
// - price is in paise (45000 = ₹450), ready for Razorpay
// - images: any number; the first is the cover. Upload to Cloudinary under
//   maati-living/products/<slug>/<nn>
// - featured: shown in "The Maati Edit" on the home page
export const products = [
  {
    id: "ml-001",
    slug: "terracotta-diya-set-of-6",
    name: "Terracotta Diya Set of 6",
    categorySlug: "diyas",
    price: 45000,
    stock: 40,
    shortDescription: "Hand-thrown clay diyas for Diwali, puja or a quiet evening glow.",
    sourcingNote: "Wheel-thrown by potters in Rajasthan",
    images: [
      { publicId: "maati-living/products/terracotta-diya-set-of-6/01", alt: "Six hand-thrown terracotta diyas with cotton wicks" },
      { publicId: "maati-living/products/terracotta-diya-set-of-6/02", alt: "Lit terracotta diyas lined along a windowsill" },
      { publicId: "maati-living/products/terracotta-diya-set-of-6/03", alt: "Close-up of the hand-finished rim of a terracotta diya" },
    ],
    materials: ["Natural terracotta clay", "Cotton wick"],
    artisan: "Family pottery workshop",
    region: "Molela, Rajasthan",
    care: "Wipe clean with a dry cloth. Soak in water for a few minutes before first use so the clay absorbs less oil.",
    available: true,
    featured: true,
    sku: "ML-DIY-001",
  },
  {
    id: "ml-002",
    slug: "coconut-shell-hanging-planter",
    name: "Coconut Shell Hanging Planter",
    categorySlug: "coconut-shell",
    price: 54900,
    stock: 25,
    shortDescription: "A polished half-shell planter on jute rope, for small greens and succulents.",
    sourcingNote: "Shaped from discarded shells in Kerala",
    images: [
      { publicId: "maati-living/products/coconut-shell-hanging-planter/01", alt: "Polished coconut shell planter hanging from jute rope" },
      { publicId: "maati-living/products/coconut-shell-hanging-planter/02", alt: "Coconut shell planter with a small succulent, seen from above" },
    ],
    materials: ["Upcycled coconut shell", "Jute rope", "Natural lacquer finish"],
    artisan: "Women-led coconut craft collective",
    region: "Thrissur, Kerala",
    care: "Keep out of standing water; wipe the outside with a damp cloth. Re-oil with coconut oil if it looks dry.",
    available: true,
    featured: true,
    sku: "ML-CSP-002",
  },
  {
    id: "ml-003",
    slug: "coconut-shell-agarbatti-stand",
    name: "Coconut Shell Agarbatti Stand",
    categorySlug: "coconut-shell",
    price: 29900,
    stock: 30,
    shortDescription: "A hand-carved stand that holds incense upright and catches the ash.",
    sourcingNote: "Hand carved by coconut-shell artisans",
    images: [
      { publicId: "maati-living/products/coconut-shell-agarbatti-stand/01", alt: "Hand-carved coconut shell agarbatti stand with ash catcher" },
      { publicId: "maati-living/products/coconut-shell-agarbatti-stand/02", alt: "Agarbatti stand in use with a lit incense stick" },
    ],
    materials: ["Upcycled coconut shell", "Natural lacquer finish"],
    artisan: "Independent shell carver",
    region: "Kozhikode, Kerala",
    care: "Empty ash after each use and wipe with a dry cloth.",
    available: true,
    featured: true,
    sku: "ML-CSA-003",
  },
];
