/**
 * Role tracks: which kind of work an offer is, judged from its title (EN + PL), and how far it is from
 * Łukasz's day-to-day design work.
 *
 * - core: Creative Designer, Senior Graphic Designer, AI Designer, Art Director and close relatives.
 * - beyond: roles that use creative and AI skills with less hands-on Figma work (AI Creative Lead,
 *   Creative Technologist, AI product or prompt roles, creative strategy, creative direction).
 * - adjacent: brand and marketing leadership, product, AI consulting and training.
 * - new_field: real estate, sales, partnerships.
 */
import type { ExploreField, Track } from "./types.ts";

export type Pivot = "none" | "small" | "pivot" | "big";
export type FigmaShare = "hands_on" | "mixed" | "direction" | "none";

export const TRACK_LABEL: Record<Track, string> = {
  core: "Core creative",
  beyond: "Beyond Figma",
  adjacent: "Adjacent",
  new_field: "New field",
};

export const TRACK_HINT: Record<Track, string> = {
  core: "Creative Designer, Senior Graphic Designer, AI Designer, Art Director",
  beyond: "AI Creative Lead, Creative Technologist, AI product and prompt roles, creative strategy",
  adjacent: "Brand and marketing lead, product, AI consulting and training",
  new_field: "Real estate, sales, partnerships",
};

export const PIVOT_LABEL: Record<Pivot, string> = {
  none: "No pivot",
  small: "Small pivot",
  pivot: "Pivot",
  big: "Big pivot",
};

export const FIGMA_LABEL: Record<FigmaShare, string> = {
  hands_on: "Mostly hands-on design",
  mixed: "Mix of design and direction",
  direction: "Mostly direction and strategy",
  none: "Little or no Figma",
};

export const FIELD_LABEL: Record<ExploreField, string> = {
  real_estate: "Real estate",
  sales: "Sales",
  partnerships: "Partnerships and business development",
  marketing: "Brand and marketing",
  product: "Product",
  consulting: "AI and creative consulting",
  education: "Training and teaching",
};

type Rule = { track: Track; field?: ExploreField; pivot: Pivot; re: RegExp; label: string };

/**
 * Checked in order; the first title match wins. Beyond-Figma comes before core so that "AI Creative
 * Lead" is not read as a plain designer role, and new-field rules come before adjacent ones so that
 * "Sales Manager" is not read as a marketing manager.
 */
export const RULES: Rule[] = [
  // AI Designer is one of the core targets, so it is checked before the AI rules below.
  {
    track: "core",
    pivot: "none",
    label: "AI design",
    re: /\b(ai|generative ai|genai) (visual |graphic |brand |creative )?designer\b|\bdesigner\b.{0,12}\b(ai|genai)\b/i,
  },
  // Beyond Figma: creative and AI skills, less pixel work.
  {
    track: "beyond",
    pivot: "small",
    label: "AI creative role",
    re: /\b(ai|genai|generative[- ]ai|gen[- ]ai)\b.{0,25}\b(creative|art|artist|content|visual|video|image|producer|production|storytell\w*|brand)\b|\b(creative|content|art|visual|brand)\b.{0,25}\b(ai|genai|generative ai)\b/i,
  },
  {
    track: "beyond",
    pivot: "small",
    label: "Creative technologist",
    re: /\b(creative technolog\w*|design technolog\w*|technical artist|creative (developer|engineer|coder)|prototyp\w* (designer|lead)|innovation (designer|lead))\b/i,
  },
  {
    track: "beyond",
    pivot: "small",
    label: "Prompt and AI content role",
    re: /\b(prompt\w*|llm|ai (trainer|writer|specialist|evaluat\w*|content|experience|interaction|conversation\w*)|conversation(al)? design\w*|ai designer)\b/i,
  },
  {
    track: "beyond",
    pivot: "small",
    label: "AI product role",
    re: /\b(ai|ml|genai)\b.{0,15}\b(product (manager|owner|designer|lead)|pm)\b|\bproduct (manager|owner|lead|designer)\b.{0,15}\b(ai|genai|generative)\b/i,
  },
  {
    track: "beyond",
    pivot: "small",
    label: "Creative strategy",
    re: /\b((creative|brand|communication|content|design) strateg\w*|strategy director|strategic planner|planner|strateg\w* kreatywn\w*|head of strategy)\b/i,
  },
  {
    track: "beyond",
    pivot: "none",
    label: "Creative direction",
    re: /\b(creative director|executive creative|head of creative|creative lead|lead creative|creative manager|dyrektor\w* kreatywn\w*|creative operations|design director|head of design|design lead|lead designer|head of brand design)\b/i,
  },
  // Core creative.
  {
    track: "core",
    pivot: "none",
    label: "Art direction",
    re: /\b(art director|associate creative director|dyrektor\w* artystyczn\w*)\b/i,
  },
  {
    track: "core",
    pivot: "none",
    label: "Creative and graphic design",
    re: /\b((creative|graphic|visual|brand|communication|digital|marketing|presentation|campaign|motion|multimedia|web|social media|content|packaging|key visual|kv|identity)[- ]designer|graphic design\w*|grafik\w*|projektant\w*( graficzn\w*)?|designer graficzn\w*|ilustrator\w*|illustrator|motion graphics)\b/i,
  },
  {
    track: "core",
    pivot: "none",
    label: "Product and UX design",
    re: /\b((product|ux|ui|ux\/ui|ui\/ux|interaction|experience|service)[- ]designer|ux|ui designer|design system\w*)\b/i,
  },
  {
    track: "core",
    pivot: "none",
    label: "Design",
    re: /\b(senior designer|lead designer|principal designer|staff designer|designer)\b/i,
  },
  // New field: real estate, sales, partnerships.
  {
    track: "new_field",
    field: "real_estate",
    pivot: "big",
    label: "Real estate",
    re: /\b(real estate|nieruchomo\w*|property (consultant|advisor|manager|agent|marketing)|estate agent|realtor|broker|leasing (manager|consultant|agent)|agent nieruchomo\w*|po[sś]redni\w*|commercial agent|asset manager|letting\w*|investment (consultant|sales))\b/i,
  },
  {
    track: "new_field",
    field: "partnerships",
    pivot: "big",
    label: "Partnerships and business development",
    re: /\b(partnership\w*|partner manager|alliances?|business development|biz ?dev|bdm|new business|rozw[oó]j biznesu)\b/i,
  },
  {
    track: "new_field",
    field: "sales",
    pivot: "big",
    label: "Sales",
    re: /\b(sales|account executive|account manager|key account|ae|sdr|bdr|handlow\w*|sprzeda\w*|przedstawiciel\w*|doradca klienta|customer success|client partner|solutions? consultant|pre-?sales)\b/i,
  },
  // Adjacent: marketing, product, consulting, education.
  {
    track: "adjacent",
    field: "marketing",
    pivot: "pivot",
    label: "Brand and marketing",
    re: /\b(brand manager|head of brand|brand lead|brand director|marketing (manager|lead|director)|head of marketing|cmo|content (lead|director|manager)|communications? (manager|lead|director)|campaign (manager|lead)|growth (lead|manager)|marketing\w*|marketing communications|kierownik\w* marketingu)\b/i,
  },
  {
    track: "adjacent",
    field: "product",
    pivot: "pivot",
    label: "Product",
    re: /\b(product (manager|owner|lead|director)|head of product|group product)\b/i,
  },
  {
    track: "adjacent",
    field: "consulting",
    pivot: "pivot",
    label: "AI and creative consulting",
    re: /\b((ai|design|innovation|digital|transformation|brand|creative) (consultant|advisor|lead|evangelist|enablement)|ai (adoption|transformation|enablement)|solutions? architect\w* ai)\b/i,
  },
  {
    track: "adjacent",
    field: "education",
    pivot: "pivot",
    label: "Training and teaching",
    re: /\b(trainer|instructor|lecturer|teacher of design|design educator|wyk[łl]adowc\w*|trener\w*|mentor|facilitator|workshop lead)\b/i,
  },
];

/** Roles that share a word with the rules but are clearly not for this profile. */
export const OFF_TARGET =
  /\b((software|frontend|front-end|backend|back-end|full[- ]?stack|java|python|\.net|ios|android|web|game|data|platform|cloud|devops|ml|machine learning|site reliability|qa|test|hardware|mechanical|electrical|civil|chip|asic|fpga) (developer|engineer|architect)|engineering manager|accountant|ksi[eę]gow\w*|driver|kierowc\w*|warehouse|magazyn\w*|nurse|piel[eę]gniar\w*|doctor|lekarz\w*|pharmac\w*|clinical|physician|dentist|personal trainer|fitness|gym|restaurant|kitchen|chef|cook|barista|cashier|kasjer\w*|cleaner|sprz[aą]ta\w*|security guard|ochron\w*|interior designer|fashion designer|textile designer|landscape designer|floral|hair|nail|makeup|tattoo|jewel\w*|instructional designer|game designer|level designer|sound designer|electrical designer|mechanical designer|cad designer|pcb designer|structural designer|data annotat\w*|call cent\w*|telemarket\w*|door[- ]to[- ]door)\b/i;

export const JUNIOR =
  /\b(junior|intern|internship|trainee|working student|werkstudent|praktyk\w*|sta[zż]\w*|asystent\w*|assistant|entry[- ]level)\b/i;
export const SENIOR =
  /\b(senior|sr\.?|lead|principal|staff|head|director|dyrektor\w*|kierownik\w*|manager|starsz\w*)\b/i;

/** Description words that count for each track (CV keywords count everywhere). */
export const TOPICS: Record<Track, string[]> = {
  core: [
    "brand identity",
    "visual identity",
    "branding",
    "art direction",
    "campaign",
    "key visual",
    "design system",
    "typography",
    "layout",
    "presentation",
    "landing page",
    "social media",
    "motion",
    "adobe",
    "photoshop",
    "illustrator",
    "after effects",
    "figma",
    "midjourney",
    "firefly",
    "generative",
    "ai tools",
    "e-commerce",
    "performance",
  ],
  beyond: [
    "generative ai",
    "genai",
    "midjourney",
    "firefly",
    "runway",
    "stable diffusion",
    "comfyui",
    "krea",
    "prompt",
    "llm",
    "claude",
    "chatgpt",
    "workflow",
    "automation",
    "prototype",
    "creative direction",
    "creative strategy",
    "brand strategy",
    "concept",
    "storytelling",
    "innovation",
    "experimentation",
    "ai tools",
    "creative technology",
    "stakeholder",
  ],
  adjacent: [
    "brand strategy",
    "positioning",
    "go-to-market",
    "campaign",
    "stakeholder",
    "roadmap",
    "discovery",
    "workshop",
    "ai adoption",
    "change",
    "presentation",
    "leadership",
    "team",
    "budget",
  ],
  new_field: [
    "negotiation",
    "client",
    "relationship",
    "presentation",
    "pitch",
    "commission",
    "b2b",
    "crm",
    "pipeline",
    "property",
    "investment",
    "luxury",
    "premium",
    "consultative",
    "storytelling",
  ],
};

export type TrackHit = {
  track: Track;
  field: ExploreField | null;
  pivot: Pivot;
  label: string;
};

/** The track of a title, or null when the title fits none of them. */
export function trackOf(title: string, companySector?: string | null): TrackHit | null {
  const t = title.trim();
  for (const r of RULES) {
    if (!r.re.test(t)) continue;
    return { track: r.track, field: r.field ?? null, pivot: r.pivot, label: r.label };
  }
  // At a real estate company, sales, consulting and leasing titles are real estate roles.
  if (
    companySector === "real_estate" &&
    /\b(consultant|advisor|agent|leasing|sales|doradc\w*|specjalist\w*)\b/i.test(t)
  )
    return { track: "new_field", field: "real_estate", pivot: "big", label: "Real estate" };
  return null;
}

/** Roughly how much day-to-day Figma work the role holds. */
export function figmaShareOf(title: string, track: Track, description: string): FigmaShare {
  if (track === "new_field" || track === "adjacent") return "none";
  const directs =
    /\b(director|head|lead|strateg\w*|technolog\w*|manager|principal|prompt|producer|dyrektor\w*)\b/i.test(
      title,
    );
  const figmaMentions = (description.match(/\bfigma\b/gi) ?? []).length;
  if (directs) return figmaMentions >= 3 ? "mixed" : "direction";
  if (track === "beyond") return figmaMentions >= 2 ? "mixed" : "direction";
  return figmaMentions >= 1 || /\b(ui|ux|product|web|digital)\b/i.test(title) ? "hands_on" : "mixed";
}
