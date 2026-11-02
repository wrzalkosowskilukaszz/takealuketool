/** Groups of companies whose career pages are watched. */
export const SECTORS = [
  "ai_creative",
  "product_warsaw",
  "agency",
  "in_house",
  "real_estate",
  "sales_saas",
  "other",
] as const;
export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABEL: Record<Sector, string> = {
  ai_creative: "AI and creative tools",
  product_warsaw: "Product companies in Poland",
  agency: "Agencies and studios",
  in_house: "Brands with in-house teams",
  real_estate: "Real estate",
  sales_saas: "SaaS with sales teams",
  other: "Other",
};
