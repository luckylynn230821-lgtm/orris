export type PublicVariant = {
  id: string;
  sku: string;
  title: string;
  option1Name: string | null;
  option1Value: string | null;
  option2Name: string | null;
  option2Value: string | null;
  priceCents: number;
  compareAtCents: number | null;
  inventoryQty: number;
};

export type PublicImage = { id: string; url: string; alt: string; isCover: boolean };

export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  story: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  tags: string[];
  images: PublicImage[];
  variants: PublicVariant[];
  priceCents: number;
  compareAtCents: number | null;
  inventoryQty: number;
  soldOut: boolean;
  seoTitle: string;
  seoDescription: string;
};

export type HeroContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
};

export type Benefit = { title: string; body: string };

export type Editorial = {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
};

export type SocialLink = { label: string; href: string };

export type PublicSettings = {
  brandName: string;
  tagline: string;
  announcement: string;
  supportEmail: string;
  currency: string;
  shippingFlatCents: number;
  expressShippingCents: number;
  freeShippingThresholdCents: number;
  hero: HeroContent;
  benefits: Benefit[];
  editorial: Editorial;
  footerBlurb: string;
  socials: SocialLink[];
};

export type CategoryCard = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  alt: string;
};

export const DEMO_CHECKOUT_COPY =
  "Demonstration checkout. No card is charged. Placing the order reserves stock and leaves it unpaid. Confirm payment from your customer page before the house can ship.";
