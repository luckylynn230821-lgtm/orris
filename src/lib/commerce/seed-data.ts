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
  { id: "cat_textiles", name: "Textiles", slug: "textiles", description: "Throws, cloth and house shoes meant to be used.", sort: 1 },
  { id: "cat_apparel", name: "Apparel", slug: "apparel", description: "Coats and linen cut without noise.", sort: 2 },
  { id: "cat_ceramic", name: "Ceramic", slug: "ceramic", description: "Stoneware from a small kiln.", sort: 3 },
  { id: "cat_scent", name: "Scent", slug: "scent", description: "A quiet fragrance for one room.", sort: 4 },
  { id: "cat_leather", name: "Leather", slug: "leather", description: "Vegetable-tanned goods that mark with use.", sort: 5 },
  { id: "cat_objects", name: "Objects", slug: "objects", description: "Small brass for a table or an entry.", sort: 6 },
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
    name: "Ivory Cashmere Throw",
    slug: "ivory-cashmere-throw",
    description: "A heavy ivory cashmere throw, knitted in a two-end finish that sits quietly on a sofa or a bed.",
    story: "Knitted in a short seasonal run. The edge is finished by hand. Air it between uses, and dry clean when it needs more than that.",
    categoryId: "cat_textiles",
    tags: ["cashmere", "ivory", "home"],
    image: "/catalog/throw.jpg",
    alt: "Folded ivory cashmere throw on a warm paper background",
    publishedDaysAgo: 140,
    seoTitle: "Ivory Cashmere Throw",
    seoDescription: "A heavy ivory cashmere throw for the sofa or the bed, knitted in a short run.",
    variants: single("v_throw", "OR-THR-IV", 48000, 18600, 18),
    weight: 8,
    recentBoost: 1.4,
  },
  {
    id: "p_pitcher",
    name: "Stoneware Pitcher",
    slug: "stoneware-pitcher",
    description: "A matte oatmeal pitcher for water, stems or a single branch. The lip is pulled by hand.",
    story: "Each piece pours a little differently. Dishwasher safe, though the matte surface prefers a soft cloth.",
    categoryId: "cat_ceramic",
    tags: ["stoneware", "table"],
    image: "/catalog/pitcher.jpg",
    alt: "Matte oatmeal stoneware pitcher",
    publishedDaysAgo: 120,
    seoTitle: "Stoneware Pitcher",
    seoDescription: "Handmade matte stoneware pitcher for water or flowers.",
    variants: single("v_pitcher", "OR-PIT-ST", 16800, 4200, 24),
    weight: 4,
    recentBoost: 1,
  },
  {
    id: "p_journal",
    name: "Field Journal",
    slug: "field-journal",
    description: "Vegetable-tanned leather that darkens where your hands hold it. One hundred and ninety-two pages of cream laid paper.",
    story: "The cover is unlined on purpose. A cotton ribbon marks the page. Paper is uncoated, so a pencil is kinder than a heavy marker.",
    categoryId: "cat_leather",
    tags: ["leather", "paper"],
    image: "/catalog/journal.jpg",
    alt: "Tan leather journal closed with a cotton ribbon",
    publishedDaysAgo: 160,
    seoTitle: "Field Journal",
    seoDescription: "A slim vegetable-tanned leather journal with cream laid paper.",
    variants: single("v_journal", "OR-JRN-TN", 9600, 2800, 42),
    weight: 5,
    recentBoost: 1,
  },
  {
    id: "p_coat",
    name: "Charcoal Wool Coat",
    slug: "charcoal-wool-coat",
    description: "An unlined charcoal wool coat with a clean shoulder and a hidden placket. Cut long, without hardware that shouts.",
    story: "The cloth is a dry wool with a little weight. It is not waterproof. Shake it, brush it, and let it rest on a wide hanger.",
    categoryId: "cat_apparel",
    tags: ["wool", "outerwear"],
    image: "/catalog/coat.jpg",
    alt: "Charcoal wool coat on an oak hanger",
    publishedDaysAgo: 90,
    seoTitle: "Charcoal Wool Coat",
    seoDescription: "Unlined charcoal wool coat, cut long with a hidden placket.",
    variants: [
      ["v_coat_xs", "OR-COT-XS", "XS", 2],
      ["v_coat_s", "OR-COT-S", "S", 2],
      ["v_coat_m", "OR-COT-M", "M", 3],
      ["v_coat_l", "OR-COT-L", "L", 1],
    ].map(([id, sku, size, qty]) => ({
      id: id as string,
      sku: sku as string,
      title: size as string,
      option1Name: "Size",
      option1Value: size as string,
      option2Name: null,
      option2Value: null,
      priceCents: 89000,
      costCents: 34000,
      inventory: Number(qty),
    })),
    weight: 5,
    recentBoost: 2.2,
  },
  {
    id: "p_candle",
    name: "Orris Root Candle",
    slug: "orris-root-candle",
    description: "Orris root, fig leaf and a little cedar, poured into a reusable ceramic vessel. It burns for about forty-five hours.",
    story: "Trim the wick to a short quarter-inch. Let the wax pool to the edge on the first burn. The vessel is meant to be kept.",
    categoryId: "cat_scent",
    tags: ["candle", "orris"],
    image: "/catalog/candle.jpg",
    alt: "Cream ceramic candle vessel",
    publishedDaysAgo: 110,
    seoTitle: "Orris Root Candle",
    seoDescription: "Orris, fig leaf and cedar in a reusable ceramic vessel.",
    variants: single("v_candle", "OR-CND-OR", 6400, 1400, 70),
    weight: 14,
    recentBoost: 1.2,
  },
  {
    id: "p_shirt",
    name: "Washed Linen Shirt",
    slug: "washed-linen-shirt",
    description: "Washed linen, cut straight, with a soft collar that does not need a tie. It wrinkles. That is the cloth.",
    story: "Woven in Belgium and washed before cutting so the first wear is not the stiff one. Machine wash cold and hang. Do not chase the creases.",
    categoryId: "cat_apparel",
    tags: ["linen", "shirt"],
    image: "/catalog/shirt.jpg",
    alt: "Folded ivory washed linen shirt",
    publishedDaysAgo: 70,
    seoTitle: "Washed Linen Shirt",
    seoDescription: "A straight washed linen shirt with a soft collar.",
    variants: [
      ["v_shirt_s", "OR-SHT-IV-S", "S", 9],
      ["v_shirt_m", "OR-SHT-IV-M", "M", 11],
      ["v_shirt_l", "OR-SHT-IV-L", "L", 7],
    ].map(([id, sku, size, qty]) => ({
      id: id as string,
      sku: sku as string,
      title: `Ivory / ${size}`,
      option1Name: "Color",
      option1Value: "Ivory",
      option2Name: "Size",
      option2Value: size as string,
      priceCents: 22000,
      costCents: 6800,
      inventory: Number(qty),
    })),
    weight: 1,
    recentBoost: 1,
  },
  {
    id: "p_brass",
    name: "Brass Catchall",
    slug: "brass-catchall",
    description: "A shallow unlacquered brass dish for a bedside or an entry. It will mark. We consider that finished.",
    story: "Cast and turned, then left without lacquer. A little wax will slow the patina if you want it quieter. We do not polish returns back to new.",
    categoryId: "cat_objects",
    tags: ["brass", "desk"],
    image: "/catalog/brass.jpg",
    alt: "Small unlacquered brass catchall",
    publishedDaysAgo: 80,
    seoTitle: "Brass Catchall",
    seoDescription: "A shallow unlacquered brass dish for keys and a bedside.",
    variants: single("v_brass", "OR-BRS-CA", 12800, 3600, 4),
    weight: 4,
    recentBoost: 2.4,
  },
  {
    id: "p_slip",
    name: "Merino House Slippers",
    slug: "merino-house-slippers",
    description: "Boiled merino with a thin leather sole for indoors. No logo and no contrast stitch.",
    story: "The sole is not for the street. If the felt flattens, a cold steam and a day's rest brings some of the loft back.",
    categoryId: "cat_textiles",
    tags: ["merino", "slippers"],
    image: "/catalog/slippers.jpg",
    alt: "Pair of oatmeal merino house slippers",
    publishedDaysAgo: 200,
    seoTitle: "Merino House Slippers",
    seoDescription: "Boiled merino house slippers with a thin leather sole.",
    variants: single("v_slip", "OR-SLP-OA", 14500, 4800, 64),
    weight: 4,
    recentBoost: 0,
    oldOnly: true,
  },
  {
    id: "p_tote",
    name: "Saddle Travel Tote",
    slug: "saddle-travel-tote",
    description: "A cognac travel tote in firm vegetable-tanned leather. One compartment and a pocket for papers.",
    story: "The straps are long enough for the shoulder. Leather will scuff at the corners. That cost is high relative to the price — the books should show it.",
    categoryId: "cat_leather",
    tags: ["leather", "bag"],
    image: "/catalog/tote.jpg",
    alt: "Cognac leather travel tote",
    publishedDaysAgo: 100,
    seoTitle: "Saddle Travel Tote",
    seoDescription: "Cognac vegetable-tanned leather travel tote.",
    variants: single("v_tote", "OR-TOT-CG", 24000, 18800, 16),
    weight: 3,
    recentBoost: 1,
  },
];

export const SEED_SETTINGS = {
  brandName: "ORRIS",
  tagline: "Objects for a considered life.",
  announcement: "Complimentary standard shipping on orders over $250",
  supportEmail: "atelier@orris.example",
  shippingFlatCents: 1800,
  expressShippingCents: 2800,
  freeShippingThresholdCents: 25000,
  lowStockThreshold: 8,
  slowCoverDays: 90,
  replenishCoverDays: 14,
  minViews: 20,
  highMarginBps: 5500,
  lowMarginBps: 2500,
  lowConversionBps: 250,
  judgementDays: 21,
  hero: {
    eyebrow: "Autumn edit",
    title: "Objects for a quieter room.",
    subtitle: "Cashmere, stoneware, linen and brass. Short runs, made to be kept rather than replaced.",
    ctaLabel: "Shop the collection",
    ctaHref: "/shop",
    image: "/catalog/hero.jpg",
  },
  benefits: [
    { title: "Short runs", body: "Fewer pieces, with mills and studios we can name. When a run is gone, we do not quietly remake it elsewhere." },
    { title: "Two-day dispatch", body: "In-stock orders leave the atelier within two business days. You will see the movement in your order, not a fake tracking page." },
    { title: "Repair before replace", body: "Write to us before you discard a textile or a leather good. Most of what we sell can be mended." },
  ],
  editorial: {
    eyebrow: "From the journal",
    title: "A throw should earn its place.",
    body: "We knit the ivory cashmere heavy enough to stay on a chair without sliding into a costume. It is not a seasonal color story. It is a cloth you already know how to live with.",
    image: "/catalog/editorial.jpg",
  },
  footerBlurb: "ORRIS is a single-house shop for goods you can reorder, repair and account for.",
  socials: [
    { label: "Instagram", href: "https://instagram.com" },
    { label: "Journal", href: "/about" },
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
