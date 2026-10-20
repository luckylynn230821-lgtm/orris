export type SeedVariant = {
  id: string;
  sku: string;
  title: string;
  option1Name: string | null;
  option1Value: string | null;
  option2Name: string | null;
  option2Value: string | null;
  priceCents: number;
  costCents: number;
  inventory: number;
};

export type SeedProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  story: string;
  categoryId: string;
  tags: string[];
  image: string;
  alt: string;
  publishedDaysAgo: number;
  seoTitle: string;
  seoDescription: string;
  variants: SeedVariant[];
  weight: number;
  recentBoost: number;
  oldOnly?: boolean;
};

export const SEED_CATEGORIES = [
  { id: "cat_textiles", name: "Rest", slug: "rest", description: "Beds for the room you are already in.", sort: 1 },
  { id: "cat_apparel", name: "Wear", slug: "wear", description: "Coats and knits with garment labels, not breed charts.", sort: 2 },
  { id: "cat_ceramic", name: "Feed", slug: "feed", description: "Bowls with a wide foot.", sort: 3 },
  { id: "cat_scent", name: "Care", slug: "care", description: "Everyday grooming. Nothing medical.", sort: 4 },
  { id: "cat_leather", name: "Walk", slug: "walk", description: "A leash and a carry tote for animals who already know the routine.", sort: 5 },
  { id: "cat_objects", name: "Play", slug: "play", description: "One toy, meant to be thrown and put away.", sort: 6 },
];

const single = (
  id: string,
  sku: string,
  priceCents: number,
  costCents: number,
  inventory: number,
): SeedVariant[] => [
  {
    id,
    sku,
    title: "One size",
    option1Name: null,
    option1Value: null,
    option2Name: null,
    option2Value: null,
    priceCents,
    costCents,
    inventory,
  },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: "p_throw",
    name: "Studio Bowl",
    slug: "studio-bowl",
    description: "A low matte ceramic bowl for meals or water. The foot is wide so it stays put on a hard floor.",
    story: "Demonstration piece. Wash by hand if you want to keep the matte surface. It suits dogs and cats; choose it by how they eat, not by a breed chart.",
    categoryId: "cat_ceramic",
    tags: ["dog", "cat", "featured", "bowl"],
    image: "/catalog/bowl.jpg",
    alt: "Matte oatmeal ceramic pet bowl on a butter studio ground",
    publishedDaysAgo: 140,
    seoTitle: "Studio Bowl",
    seoDescription: "A low matte ceramic bowl with a wide foot for dogs and cats.",
    variants: single("v_throw", "MU-BOWL-01", 4200, 1400, 18),
    weight: 8,
    recentBoost: 1.4,
  },
  {
    id: "p_pitcher",
    name: "Quiet Water Bowl",
    slug: "quiet-water-bowl",
    description: "A slightly deeper bowl for dogs who splash. Same matte clay, with a heavier base.",
    story: "Demonstration piece. Refill it as they drink. It is not a measured hydration guide.",
    categoryId: "cat_ceramic",
    tags: ["dog", "bowl"],
    image: "/catalog/water.jpg",
    alt: "Deeper matte ceramic water bowl",
    publishedDaysAgo: 120,
    seoTitle: "Quiet Water Bowl",
    seoDescription: "A deeper matte bowl with a heavy base for dogs who splash.",
    variants: single("v_pitcher", "MU-WATER-01", 3800, 1200, 24),
    weight: 4,
    recentBoost: 1,
  },
  {
    id: "p_journal",
    name: "Cotton Leash",
    slug: "cotton-leash",
    description: "A cotton leash with a simple clasp. Long enough for a city block, light enough to coil into a bag.",
    story: "Demonstration piece. Check the stitching before you clip it on. The clasp is ordinary hardware, not a climbing rating.",
    categoryId: "cat_leather",
    tags: ["dog", "featured", "walk"],
    image: "/catalog/leash.jpg",
    alt: "Coiled cotton leash with a simple clasp",
    publishedDaysAgo: 160,
    seoTitle: "Cotton Leash",
    seoDescription: "A light cotton leash with a simple clasp.",
    variants: single("v_journal", "MU-LEASH-01", 5600, 1600, 42),
    weight: 5,
    recentBoost: 1,
  },
  {
    id: "p_coat",
    name: "Weather Coat",
    slug: "weather-coat",
    description: "An unlined wool coat for a dog, with a clean shoulder and no logo. Sizes are garment labels, not a breed chart.",
    story: "Demonstration piece. XS through L are the labels on this sample. Compare them with a coat your dog already wears. It is not waterproof.",
    categoryId: "cat_apparel",
    tags: ["dog", "featured", "wear"],
    image: "/catalog/coat-dog.jpg",
    alt: "Unlined charcoal wool dog coat laid flat",
    publishedDaysAgo: 90,
    seoTitle: "Weather Coat",
    seoDescription: "An unlined wool dog coat in garment sizes XS to L.",
    variants: [
      ["v_coat_xs", "MU-COAT-XS", "XS", 2],
      ["v_coat_s", "MU-COAT-S", "S", 2],
      ["v_coat_m", "MU-COAT-M", "M", 3],
      ["v_coat_l", "MU-COAT-L", "L", 1],
    ].map(([id, sku, size, qty]) => ({
      id: id as string,
      sku: sku as string,
      title: size as string,
      option1Name: "Size",
      option1Value: size as string,
      option2Name: null,
      option2Value: null,
      priceCents: 12800,
      costCents: 4200,
      inventory: Number(qty),
    })),
    weight: 5,
    recentBoost: 2.2,
  },
  {
    id: "p_candle",
    name: "Everyday Brush",
    slug: "everyday-brush",
    description: "A short brush with a beech handle and soft pins. For a minute of grooming, not a salon.",
    story: "Demonstration piece. Stop if the skin looks irritated. This is not a medical tool.",
    categoryId: "cat_scent",
    tags: ["dog", "cat", "care"],
    image: "/catalog/brush.jpg",
    alt: "Short grooming brush with a pale wooden handle",
    publishedDaysAgo: 110,
    seoTitle: "Everyday Brush",
    seoDescription: "A short grooming brush for dogs and cats.",
    variants: single("v_candle", "MU-BRUSH-01", 2400, 700, 70),
    weight: 14,
    recentBoost: 1.2,
  },
  {
    id: "p_shirt",
    name: "Cloud Knit",
    slug: "cloud-knit",
    description: "A light knit for a cat who already tolerates clothing. Sizes are garment labels.",
    story: "Demonstration piece. If they freeze, fight the neck, or stop moving normally, take it off. S, M and L are labels on this sample, not a body chart.",
    categoryId: "cat_apparel",
    tags: ["cat", "wear"],
    image: "/catalog/knit.jpg",
    alt: "Cloud-grey knit pet sweater laid flat",
    publishedDaysAgo: 70,
    seoTitle: "Cloud Knit",
    seoDescription: "A light knit sweater for a cat, in garment sizes S to L.",
    variants: [
      ["v_shirt_s", "MU-KNIT-S", "S", 9],
      ["v_shirt_m", "MU-KNIT-M", "M", 11],
      ["v_shirt_l", "MU-KNIT-L", "L", 7],
    ].map(([id, sku, size, qty]) => ({
      id: id as string,
      sku: sku as string,
      title: `Cloud / ${size}`,
      option1Name: "Color",
      option1Value: "Cloud",
      option2Name: "Size",
      option2Value: size as string,
      priceCents: 6400,
      costCents: 2100,
      inventory: Number(qty),
    })),
    weight: 1,
    recentBoost: 1,
  },
  {
    id: "p_brass",
    name: "Arc Toss",
    slug: "arc-toss",
    description: "One solid coral arc, meant to be thrown and found. No squeaker.",
    story: "Demonstration piece. Supervise play and retire it if a piece comes off. It is not an unsupervised chew.",
    categoryId: "cat_objects",
    tags: ["dog", "featured", "play"],
    image: "/catalog/toy.jpg",
    alt: "Coral arc-shaped toss toy",
    publishedDaysAgo: 80,
    seoTitle: "Arc Toss",
    seoDescription: "A solid coral toss toy with no squeaker.",
    variants: single("v_brass", "MU-TOSS-01", 2200, 600, 4),
    weight: 4,
    recentBoost: 2.4,
  },
  {
    id: "p_slip",
    name: "Day Bed",
    slug: "day-bed",
    description: "A low linen bed with a removable cushion. For a nap in the room you are already in.",
    story: "Demonstration piece. The cover washes cold and air dries. It is not an orthopedic or veterinary bed.",
    categoryId: "cat_textiles",
    tags: ["dog", "cat", "featured", "rest"],
    image: "/catalog/bed.jpg",
    alt: "Low oatmeal linen pet bed",
    publishedDaysAgo: 200,
    seoTitle: "Day Bed",
    seoDescription: "A low linen pet bed with a removable cushion.",
    variants: single("v_slip", "MU-BED-01", 9600, 3400, 64),
    weight: 4,
    recentBoost: 0,
    oldOnly: true,
  },
  {
    id: "p_tote",
    name: "Carry Tote",
    slug: "carry-tote",
    description: "A structured cotton tote with a firm base, for a small dog who already rides calmly. Not a crate and not a car restraint.",
    story: "Demonstration piece. This does not replace a travel crate or a seatbelt harness. Use it only for an animal who is comfortable being carried.",
    categoryId: "cat_leather",
    tags: ["dog", "walk"],
    image: "/catalog/carry.jpg",
    alt: "Structured cotton carry tote",
    publishedDaysAgo: 100,
    seoTitle: "Carry Tote",
    seoDescription: "A cotton tote for carrying a small dog who is already calm.",
    variants: single("v_tote", "MU-TOTE-01", 7800, 2600, 16),
    weight: 3,
    recentBoost: 1,
  },
];

export const SEED_SETTINGS = {
  brandName: "MU",
  tagline: "A studio for the animals at home.",
  announcement: "Complimentary shipping on studio orders over $120",
  supportEmail: "luckylynn230821@gmail.com",
  shippingFlatCents: 800,
  expressShippingCents: 1800,
  freeShippingThresholdCents: 12000,
  lowStockThreshold: 8,
  slowCoverDays: 90,
  replenishCoverDays: 14,
  minViews: 20,
  highMarginBps: 5500,
  lowMarginBps: 2500,
  lowConversionBps: 250,
  judgementDays: 21,
  hero: {
    eyebrow: "Playful studio",
    title: "Small hours, big company.",
    subtitle: "Everyday objects for dogs and cats. Shaped in a quiet studio, and sold only with the stock we actually have.",
    ctaLabel: "Shop the studio",
    ctaHref: "/shop",
    image: "/catalog/studio-hero.jpg",
  },
  benefits: [
    { title: "Objects, not costumes", body: "A bowl, a bed, a leash, a coat. Each one does one job. We do not print certifications this sample cannot support." },
    { title: "Labels, not breed charts", body: "Where a garment has a size, it is the label on the piece. Compare it with something your animal already wears." },
    { title: "No ship-date promise", body: "This demonstration studio does not promise a delivery date. Nothing is sent until the desk records a shipment on the order." },
  ],
  editorial: {
    eyebrow: "Little joys",
    title: "The hour after the walk.",
    body: "A bed on the floor, a bowl that does not tip, a toy that goes back in the basket. The studio is built around those minutes.",
    image: "/catalog/studio-joy.jpg",
  },
  footerBlurb: "MU is a demonstration studio for dogs and cats. The name is a placeholder in settings, so it can be replaced.",
  socials: [
    { label: "About the studio", href: "/about" },
  ],
};

export const SEED_PEOPLE: [string, string][] = [
  ["A. Moreau", "a.moreau@example.com"],
  ["J. Ellis", "j.ellis@example.com"],
  ["S. Adler", "s.adler@example.com"],
  ["M. Chen", "m.chen@example.com"],
  ["R. Okonkwo", "r.okonkwo@example.com"],
  ["L. Berger", "l.berger@example.com"],
  ["N. Patel", "n.patel@example.com"],
  ["H. Ito", "h.ito@example.com"],
];
