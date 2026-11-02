/**
 * Free, explainable job matching (no AI): the role track from the title, words from the CV and the
 * track's topics in the description, location, required languages and seniority. Every point added or
 * taken away comes with a reason, so the score is never a black box. Claude's reading of the offer
 * (src/server/ai/score.ts) is a second pass on top of this one, only for offers that pass these rules.
 */
import {
  type FigmaShare,
  figmaShareOf,
  JUNIOR,
  OFF_TARGET,
  type Pivot,
  SENIOR,
  TOPICS,
  TRACK_LABEL,
  trackOf,
} from "./tracks.ts";
import type { ExploreField, Track } from "./types.ts";

export type LocationPref = "warsaw" | "poland_other" | "remote_poland" | "eu" | "world";
export type WorkType = "full_time" | "freelance" | "part_time";

export type CareerPrefs = {
  tracks: Track[];
  exploreFields: ExploreField[];
  locations: LocationPref[];
  languages: string[]; // ISO 639-1: "en", "pl", …
  workTypes: WorkType[];
  cvKeywords: string[];
  extraKeywords: string[];
  excludeKeywords: string[];
};

export type JobInput = {
  title: string;
  description: string;
  location: string | null;
  countries?: string[]; // ISO 3166 alpha-2 when the source states them
  workplace?: "remote" | "hybrid" | "onsite" | "unknown";
  employmentType?: string | null;
  companyName: string;
  companySector?: string | null;
  favourite?: boolean;
  postedAt?: Date | null;
};

export type Region =
  | "warsaw"
  | "poland"
  | "remote_ok"
  | "remote_unclear"
  | "eu"
  | "europe"
  | "non_eu"
  | "unknown";

export const REGION_LABEL: Record<Region, string> = {
  warsaw: "Warsaw",
  poland: "Poland",
  remote_ok: "Remote",
  remote_unclear: "Remote, check location",
  eu: "EU",
  europe: "Europe",
  non_eu: "Outside Europe",
  unknown: "Unknown",
};

/** The three Matches tabs. EEA countries and Switzerland count as EU: a Polish citizen needs no permit there. */
export const AREAS = ["pl", "eu", "world"] as const;
export type Area = (typeof AREAS)[number];
export const AREA_LABEL: Record<Area, string> = {
  pl: "Poland",
  eu: "European Union",
  world: "Rest of the world",
};

/** What working there takes for a Polish citizen. */
export type Permit = "none" | "remote" | "visa" | "check";
export const PERMIT_LABEL: Record<Permit, string> = {
  none: "No work permit needed",
  remote: "Remote from Poland",
  visa: "Needs a work visa",
  check: "Check where they hire",
};

export type MatchResult = {
  score: number;
  eligible: boolean;
  region: Region;
  area: Area;
  track: Track;
  field: ExploreField | null;
  pivot: Pivot;
  figmaShare: FigmaShare;
  reasons: { text: string; tone: "good" | "warn" | "bad" }[];
  requiredLanguages: string[];
  hits: string[];
};

// ------------------------------------------------------------------------------------------------
// Locations: Warsaw and Poland (on-site or hybrid), and remote roles open to someone in Poland
// ------------------------------------------------------------------------------------------------

const EU: Record<string, string[]> = {
  AT: ["austria", "österreich", "vienna", "wien", "graz", "linz"],
  BE: ["belgium", "belgië", "belgique", "brussels", "bruxelles", "antwerp", "ghent"],
  BG: ["bulgaria", "sofia"],
  HR: ["croatia", "zagreb"],
  CY: ["cyprus", "limassol", "nicosia"],
  CZ: ["czech", "czechia", "prague", "praha", "brno"],
  DK: ["denmark", "copenhagen", "aarhus"],
  EE: ["estonia", "tallinn"],
  FI: ["finland", "helsinki", "espoo"],
  FR: ["france", "paris", "lyon", "marseille", "toulouse", "lille", "nantes"],
  DE: [
    "germany",
    "deutschland",
    "niemcy",
    "berlin",
    "munich",
    "münchen",
    "hamburg",
    "frankfurt",
    "cologne",
    "köln",
    "düsseldorf",
    "stuttgart",
    "leipzig",
    "dresden",
    "hannover",
    "nuremberg",
    "nürnberg",
    "bonn",
    "essen",
  ],
  GR: ["greece", "athens", "thessaloniki"],
  HU: ["hungary", "budapest"],
  IE: ["ireland", "dublin", "cork", "galway"],
  IT: ["italy", "italia", "milan", "milano", "rome", "roma", "turin", "torino", "bologna"],
  LV: ["latvia", "riga"],
  LT: ["lithuania", "vilnius", "kaunas"],
  LU: ["luxembourg"],
  MT: ["malta", "valletta"],
  NL: ["netherlands", "nederland", "holland", "amsterdam", "rotterdam", "utrecht", "the hague", "eindhoven"],
  PT: ["portugal", "lisbon", "lisboa", "porto"],
  RO: ["romania", "bucharest", "bucurești", "cluj"],
  SK: ["slovakia", "bratislava", "košice"],
  SI: ["slovenia", "ljubljana"],
  ES: ["spain", "españa", "madrid", "barcelona", "valencia", "seville", "malaga", "málaga"],
  SE: ["sweden", "stockholm", "gothenburg", "göteborg", "malmö"],
};
const EUROPE_NON_EU: Record<string, string[]> = {
  CH: [
    "switzerland",
    "schweiz",
    "suisse",
    "zurich",
    "zürich",
    "geneva",
    "genève",
    "basel",
    "lausanne",
    "zug",
  ],
  NO: ["norway", "oslo", "bergen"],
  IS: ["iceland", "reykjavik"],
};
const NON_EU =
  /\b(united kingdom|\buk\b|england|scotland|wales|london|manchester|edinburgh|birmingham|bristol|united states|\busa?\b|new york|san francisco|los angeles|seattle|chicago|boston|austin|texas|california|canada|toronto|vancouver|montreal|india|bangalore|bengaluru|hyderabad|mumbai|singapore|australia|sydney|melbourne|brazil|são paulo|mexico|japan|tokyo|china|hong kong|dubai|uae|israel|tel aviv|turkey|istanbul|ukraine|kyiv|serbia|belgrade|philippines|south africa|argentina|colombia|egypt)\b/i;
const POLAND_OTHER =
  /\b(krak[oó]w|cracow|wroc[lł]aw|pozna[nń]|gda[nń]sk|gdynia|sopot|tr[oó]jmiasto|tricity|[lł][oó]d[zź]|katowice|szczecin|lublin|bydgoszcz|bia[lł]ystok|rzesz[oó]w|toru[nń]|opole|kielce|gliwice)\b/i;
const WARSAW = /\b(warszaw\w*|warsaw|varsovie)\b/i;
const POLAND = /\b(poland|polska|polsce|pl)\b/i;
const REMOTE = /\b(remote|zdaln\w*|home office|work from home|anywhere|distributed|telecommut\w*)\b/i;
const HYBRID = /\b(hybrid|hybrydow\w*)\b/i;
const REMOTE_OK_SCOPE =
  /\b(emea|europe|european union|\beu\b|cet|cest|poland|polska|worldwide|global|anywhere)\b/i;
const REMOTE_BAD_SCOPE =
  /\b(us only|usa only|united states|u\.s\.|uk only|united kingdom|canada|latam|americas|apac|north america)\b/i;

// Country codes some career sites put first ("CAN - Mississauga", "POL - Warszawa").
const EU_ISO3 =
  /^(POL|DEU|FRA|ESP|ITA|NLD|BEL|AUT|PRT|IRL|SWE|DNK|FIN|CZE|SVK|HUN|ROU|BGR|GRC|HRV|SVN|EST|LVA|LTU|LUX|MLT|CYP)\b/;
const NON_EU_ISO3 =
  /^(USA|CAN|GBR|IND|MEX|BRA|AUS|CHN|JPN|SGP|ARE|ISR|TUR|ZAF|ARG|COL|PHL|KOR|MYS|IDN|EGY|NGA|KEN|SAU|QAT|NZL|CHL|PER|THA|VNM|UKR|SRB)\b/;

const EUROPE_SCOPE = /\b(emea|europe|european union|\beu\b|cet|cest)\b/i;

/** Which Matches tab an offer belongs to. Mirrored in drizzle/0002_areas.sql for offers stored before. */
export function areaOf(region: Region, location: string | null | undefined, countries: string[] = []): Area {
  const loc = location ?? "";
  const cc = countries.map((c) => c.toUpperCase());
  switch (region) {
    case "warsaw":
    case "poland":
      return "pl";
    case "eu":
    case "europe":
      return "eu";
    case "remote_ok":
      if (
        WARSAW.test(loc) ||
        POLAND.test(loc) ||
        POLAND_OTHER.test(loc) ||
        (cc.length && cc.every((c) => c === "PL"))
      )
        return "pl";
      if (EUROPE_SCOPE.test(loc) || cc.some((c) => c in EU || c in EUROPE_NON_EU)) return "eu";
      return "world";
    default:
      return "world";
  }
}

export function permitOf(region: Region | string, area: Area | string | undefined): Permit {
  if (area === "pl" || area === "eu") return "none";
  if (region === "remote_ok") return "remote";
  if (region === "non_eu") return "visa";
  return "check";
}

function countryOf(text: string): string | null {
  const t = text.toLowerCase();
  for (const [code, words] of Object.entries(EU)) if (words.some((w) => t.includes(w))) return code;
  return null;
}

export function classifyLocation(job: Pick<JobInput, "location" | "countries" | "workplace">): Region {
  const loc = job.location ?? "";
  const countries = (job.countries ?? []).map((c) => c.toUpperCase());
  const remote = job.workplace === "remote" || REMOTE.test(loc);
  if (WARSAW.test(loc)) return "warsaw";
  if (/^POL\b/.test(loc.trim())) return remote ? "remote_ok" : "poland";
  if (EU_ISO3.test(loc.trim()) && !remote) return "eu";
  if (NON_EU_ISO3.test(loc.trim()) && !/;/.test(loc)) return "non_eu";
  if (remote) {
    if (countries.length) {
      if (countries.includes("PL")) return "remote_ok";
      if (countries.some((c) => c in EU)) return "remote_ok";
      return "non_eu";
    }
    if (REMOTE_BAD_SCOPE.test(loc) && !REMOTE_OK_SCOPE.test(loc)) return "non_eu";
    if (REMOTE_OK_SCOPE.test(loc) || POLAND.test(loc)) return "remote_ok";
    if (NON_EU.test(loc)) return "non_eu";
    return "remote_unclear";
  }
  if (countries.includes("PL") || POLAND.test(loc) || POLAND_OTHER.test(loc)) return "poland";
  if (countries.some((c) => c in EU) || countryOf(loc)) return "eu";
  if (
    countries.some((c) => c in EUROPE_NON_EU) ||
    Object.values(EUROPE_NON_EU)
      .flat()
      .some((w) => loc.toLowerCase().includes(w))
  )
    return "europe";
  if (countries.length || NON_EU.test(loc)) return "non_eu";
  return "unknown";
}

// ------------------------------------------------------------------------------------------------
// Languages: required languages and the language the ad itself is written in
// ------------------------------------------------------------------------------------------------

export const LANG_NAMES: Record<string, RegExp> = {
  de: /\b(german|deutsch\w*|niemieck\w*)\b/i,
  fr: /\b(french|français|francusk\w*)\b/i,
  nl: /\b(dutch|nederlands|niderlandzk\w*)\b/i,
  es: /\b(spanish|español|hiszpańsk\w*)\b/i,
  it: /\b(italian|italiano|włosk\w*)\b/i,
  sv: /\b(swedish|svenska|szwedzk\w*)\b/i,
  da: /\b(danish|dansk|duńsk\w*)\b/i,
  fi: /\b(finnish|suomi|fińsk\w*)\b/i,
  cs: /\b(czech|čeština|czesk\w*)\b/i,
  hu: /\b(hungarian|magyar|węgiersk\w*)\b/i,
  pt: /\b(portuguese|português|portugalsk\w*)\b/i,
  ro: /\b(romanian|română|rumuńsk\w*)\b/i,
  pl: /\b(polish|polski\w*|język\w* polsk\w*)\b/i,
  en: /\b(english|angielsk\w*)\b/i,
  uk: /\b(ukrainian|ukraińsk\w*)\b/i,
  ru: /\b(russian|rosyjsk\w*)\b/i,
};
export const LANGUAGE_LABEL: Record<string, string> = {
  de: "German",
  fr: "French",
  nl: "Dutch",
  es: "Spanish",
  it: "Italian",
  sv: "Swedish",
  da: "Danish",
  fi: "Finnish",
  cs: "Czech",
  hu: "Hungarian",
  pt: "Portuguese",
  ro: "Romanian",
  pl: "Polish",
  en: "English",
  uk: "Ukrainian",
  ru: "Russian",
};
const REQUIRED_NEAR =
  /(fluent|fluency|native|mother tongue|business[- ]level|proficien\w*|excellent|very good|strong|advanced|c1|c2|required|must|mandatory|essential|flie(ss|ß)end|verhandlungssicher|biegł\w*|bardzo dobr\w*|wymagan\w*|komunikatywn\w*)/i;

/** Languages the ad says you must speak (only when a requirement word is next to the language). */
export function requiredLanguages(description: string): string[] {
  const out = new Set<string>();
  const sentences = description.split(/(?<=[.!?;\n•])\s+/);
  for (const s of sentences) {
    if (!REQUIRED_NEAR.test(s)) continue;
    for (const [code, re] of Object.entries(LANG_NAMES)) if (re.test(s)) out.add(code);
  }
  return [...out];
}

const STOP: Record<string, string[]> = {
  de: [
    "und",
    "der",
    "die",
    "das",
    "mit",
    "für",
    "wir",
    "sie",
    "ihre",
    "eine",
    "bei",
    "auf",
    "sind",
    "werden",
  ],
  fr: ["et", "les", "des", "pour", "avec", "nous", "vous", "une", "dans", "sur", "votre"],
  nl: ["en", "het", "een", "voor", "met", "wij", "jij", "van", "zijn", "jouw"],
  es: ["y", "los", "las", "para", "con", "nosotros", "una", "en", "del", "tu"],
  pl: ["i", "w", "na", "z", "do", "się", "oraz", "dla", "jest", "nasz", "będziesz"],
  en: ["and", "the", "for", "with", "you", "our", "will", "are", "your", "this"],
};

/** The language the ad is written in, from common short words (good enough to spot German ads). */
export function adLanguage(text: string): string {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 20) return "unknown";
  let best = "unknown";
  let bestN = 0;
  for (const [lang, stop] of Object.entries(STOP)) {
    const set = new Set(stop);
    const n = words.reduce((a, w) => a + (set.has(w) ? 1 : 0), 0);
    if (n > bestN) {
      best = lang;
      bestN = n;
    }
  }
  return bestN / words.length > 0.04 ? best : "unknown";
}

// ------------------------------------------------------------------------------------------------
// CV keywords
// ------------------------------------------------------------------------------------------------

const CV_VOCAB = [
  ...new Set([
    ...Object.values(TOPICS).flat(),
    "creative direction",
    "creative lead",
    "art director",
    "brand strategy",
    "visual identity",
    "brand identity",
    "tone of voice",
    "positioning",
    "customer journey",
    "ux",
    "ui",
    "ux/ui",
    "product design",
    "design system",
    "design systems",
    "landing pages",
    "crm",
    "performance campaigns",
    "digital campaigns",
    "fundraising",
    "presentations",
    "c-level",
    "stakeholder management",
    "team leadership",
    "animation",
    "motion",
    "websites",
    "e-commerce",
    "design thinking",
    "workshops",
    "ai",
    "ai tools",
    "ai workflows",
    "generative ai",
    "prompt engineering",
    "midjourney",
    "firefly",
    "figma",
    "figma ai",
    "jitter",
    "lovable",
    "v0",
    "claude",
    "claude code",
    "krea",
    "runway",
    "llms",
    "real estate",
    "economics",
    "streetwear",
    "international",
    "b2b",
  ]),
];

/** Topic words from the CV text: known skills and phrases that actually appear in it. */
export function extractCvKeywords(cvText: string): string[] {
  const t = ` ${cvText.toLowerCase().replace(/\s+/g, " ")} `;
  return CV_VOCAB.filter((k) => has(t, k)).slice(0, 60);
}

// ------------------------------------------------------------------------------------------------
// Score
// ------------------------------------------------------------------------------------------------

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
function has(text: string, word: string): boolean {
  const w = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${w}($|[^\\p{L}])`, "iu").test(text);
}

const TRACK_POINTS: Record<Track, number> = { core: 45, beyond: 46, adjacent: 34, new_field: 32 };

export function scoreJob(job: JobInput, prefs: CareerPrefs, now = new Date()): MatchResult {
  const reasons: MatchResult["reasons"] = [];
  const title = job.title.trim();
  const desc = job.description.toLowerCase();
  let score = 0;

  // Place first: some places are simply out.
  const region = classifyLocation(job);
  const loc = prefs.locations;
  let eligible = true;
  const hybrid = job.workplace === "hybrid" || HYBRID.test(job.location ?? "");
  if (region === "warsaw") {
    if (loc.includes("warsaw") || (job.workplace === "remote" && loc.includes("remote_poland"))) {
      score += 15;
      reasons.push({
        text: `Warsaw${hybrid ? ", hybrid" : job.workplace === "remote" ? ", remote" : ""}`,
        tone: "good",
      });
    } else eligible = false;
  } else if (region === "remote_ok") {
    if (loc.includes("remote_poland")) {
      score += 14;
      reasons.push({ text: "Remote, open to Poland", tone: "good" });
    } else eligible = false;
  } else if (region === "remote_unclear") {
    if (loc.includes("remote_poland")) {
      score += 4;
      reasons.push({ text: "Remote: check location", tone: "warn" });
    } else eligible = false;
  } else if (region === "poland") {
    if (loc.includes("poland_other")) {
      score += 9;
      reasons.push({ text: job.location ? (shortPlace(job.location) ?? "Poland") : "Poland", tone: "good" });
    } else eligible = false;
  } else if (region === "eu" || region === "europe") {
    if (loc.includes("eu")) {
      score += 8;
      reasons.push({ text: `${shortPlace(job.location) ?? "EU"}: no work permit needed`, tone: "good" });
    } else eligible = false;
  } else if (region === "non_eu") {
    if (loc.includes("world")) reasons.push({ text: "Outside the EU: needs a work visa", tone: "warn" });
    else eligible = false;
  } else if (region === "unknown" && /\b(poland|polska|polsce|warsaw|warszaw\w*)\b/i.test(job.description)) {
    reasons.push({ text: "Place unclear: the ad mentions Poland", tone: "warn" });
  } else eligible = false; // remote limited to other countries, or no place at all

  // Role: the title says the most.
  const hit = trackOf(title, job.companySector);
  const track: Track = hit?.track ?? "core";
  const field = hit?.field ?? null;
  const pivot: Pivot = hit?.pivot ?? "none";
  if (!hit) eligible = false;
  else if (!prefs.tracks.includes(hit.track)) eligible = false;
  else if (hit.field && !prefs.exploreFields.includes(hit.field)) eligible = false;
  else {
    score += TRACK_POINTS[hit.track];
    reasons.push({ text: `${TRACK_LABEL[hit.track]}: ${hit.label}`, tone: "good" });
  }
  if (OFF_TARGET.test(title)) {
    eligible = false;
    reasons.push({ text: "Different profile", tone: "bad" });
  }

  // Description: your CV words, your extra words and the track's topics.
  const words = [...new Set([...prefs.cvKeywords, ...prefs.extraKeywords, ...TOPICS[track]])].filter(
    (w) => w.trim().length > 1,
  );
  const lowTitle = title.toLowerCase();
  const hits = words.filter((w) => has(desc, w) || has(lowTitle, w));
  const cvHits = hits.filter((h) => prefs.cvKeywords.includes(h) || prefs.extraKeywords.includes(h));
  score += Math.min(25, hits.length * 3);
  if (cvHits.length)
    reasons.push({ text: `Matches your CV: ${cvHits.slice(0, 4).join(", ")}`, tone: "good" });
  else if (hits.length >= 3) reasons.push({ text: `Topics: ${hits.slice(0, 3).join(", ")}`, tone: "good" });

  const excluded = prefs.excludeKeywords.find((w) => w.trim() && has(lowTitle, w));
  if (excluded) {
    score -= 40;
    reasons.push({ text: `Excluded word: ${excluded}`, tone: "bad" });
  }

  // Languages.
  const required = requiredLanguages(job.description).filter((l) => !prefs.languages.includes(l));
  if (required.length) {
    score -= 30;
    reasons.push({ text: `Requires ${required.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ")}`, tone: "bad" });
  }
  const written = adLanguage(`${job.title} ${job.description}`);
  if (written !== "unknown" && !prefs.languages.includes(written) && !required.includes(written)) {
    score -= 25;
    reasons.push({ text: `Ad written in ${LANGUAGE_LABEL[written] ?? written}`, tone: "bad" });
  }

  // Seniority: senior design roles fit; junior ones only make sense for a career change.
  if (JUNIOR.test(title)) {
    if (track === "new_field")
      reasons.push({ text: "Entry level: a common start for a pivot", tone: "warn" });
    else {
      score -= 20;
      reasons.push({ text: "Junior role or internship", tone: "warn" });
    }
  } else if (SENIOR.test(title) && (track === "core" || track === "beyond")) {
    score += 6;
    reasons.push({ text: "Senior level", tone: "good" });
  }

  const type = `${job.employmentType ?? ""} ${title}`.toLowerCase();
  if (/part[- ]?time|teilzeit|część etatu|niepełn/.test(type) && !prefs.workTypes.includes("part_time")) {
    score -= 15;
    reasons.push({ text: "Part-time", tone: "warn" });
  }
  if (/freelanc|contract|b2b|kontrakt|zlecen/.test(type)) {
    if (prefs.workTypes.includes("freelance")) reasons.push({ text: "Contract / B2B", tone: "good" });
    else score -= 15;
  }

  if (job.favourite) {
    score += 10;
    reasons.push({ text: `Favourite company: ${job.companyName}`, tone: "good" });
  }
  if (job.postedAt && now.getTime() - job.postedAt.getTime() < 3 * 86_400_000) score += 3;

  return {
    score: eligible ? clamp(score) : 0,
    eligible,
    region,
    area: areaOf(region, job.location, job.countries ?? []),
    track,
    field,
    pivot,
    figmaShare: figmaShareOf(title, track, job.description),
    reasons,
    requiredLanguages: requiredLanguages(job.description),
    hits,
  };
}

/** "Kraków, Małopolskie, Poland; Gdańsk, Poland" → "Kraków, Gdańsk". */
function shortPlace(location: string | null | undefined): string | null {
  if (!location) return null;
  const parts = location.split(/;\s*/).filter(Boolean);
  const cities = [...new Set(parts.map((p) => p.split(",")[0]?.trim() ?? p))];
  return cities.length > 2 ? `${cities.slice(0, 2).join(", ")} +${cities.length - 2}` : cities.join(", ");
}

/** Kept in the database: eligible and relevant enough, or from a favourite company. */
export function worthKeeping(m: MatchResult, favourite: boolean, minKeep = 25): boolean {
  return m.eligible && (m.score >= minKeep || favourite);
}

/** A quick, cheap check before fetching a full description (titles only). */
export function titleLooksRelevant(title: string, prefs: CareerPrefs): boolean {
  if (OFF_TARGET.test(title)) return false;
  const hit = trackOf(title);
  return Boolean(
    hit && prefs.tracks.includes(hit.track) && (!hit.field || prefs.exploreFields.includes(hit.field)),
  );
}
