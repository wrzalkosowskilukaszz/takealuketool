/**
 * Tailoring the CV to one job offer, without AI: which skill words of the offer the CV already shows and
 * which it does not, and splitting an AI answer into the CV and its "To check" notes. A word counts
 * only when it is literally in the text (or its Polish/English twin); nothing is inferred.
 */
import { adLanguage, LANG_NAMES, LANGUAGE_LABEL, requiredLanguages } from "./match.ts";

type Skill = { label: string; ci: RegExp | null; cs: RegExp | null };

/**
 * `*` at the end of a word allows any ending ("facilitat*" → facilitation, facilitator). Alternatives in
 * capitals ("LMS", "AI") or marked with a leading `=` ("=Workday") are matched case-sensitively, so
 * "aid", "excel at" or "during the workday" do not count.
 */
function skill(label: string, ...alts: string[]): Skill {
  const word = (w: string) =>
    w.replace(/\*$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (w.endsWith("*") ? "[\\p{L}\\p{N}]*" : "");
  const part = (a: string) => a.replace(/^=/, "").split(" ").map(word).join("[\\s-]+");
  const build = (xs: string[], flags: string) =>
    xs.length
      ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${xs.map(part).join("|")})(?![\\p{L}\\p{N}])`, flags)
      : null;
  const exact = alts.filter((a) => a.startsWith("=") || (/^[A-Z0-9&/-]+$/.test(a) && /[A-Z]/.test(a)));
  return {
    label,
    ci: build(
      alts.filter((a) => !exact.includes(a)),
      "iu",
    ),
    cs: build(exact, "u"),
  };
}

const SKILLS: Skill[] = [
  // Creative and brand
  skill("art direction", "art direct*", "dyrekcj* artystyczn*"),
  skill("creative direction", "creative direct*", "creative lead*", "kierownictwo kreatywn*"),
  skill("brand identity", "brand identit*", "visual identit*", "identyfikacj* wizualn*", "branding"),
  skill("brand strategy", "brand strateg*", "positioning", "pozycjonowani*", "strategi* mark*"),
  skill("campaigns", "campaign*", "kampani*"),
  skill("key visuals", "key visual*", "KV"),
  skill("typography", "typograph*", "typografi*"),
  skill("presentations", "presentation*", "pitch deck*", "prezentacj*", "keynote"),
  skill("social media", "social media", "social content", "media społecznościow*"),
  skill("motion design", "motion design*", "motion graphic*", "animation*", "animacj*"),
  skill("illustration", "illustrat*", "ilustracj*"),
  skill("packaging", "packaging", "opakowa*"),
  skill("print", "print*", "DTP", "druk*"),
  skill("copywriting", "copywrit*", "tone of voice"),
  // Product and UX
  skill("UX/UI", "UX", "UI", "user experience", "user interface", "interface design*"),
  skill("product design", "product design*"),
  skill("design systems", "design system*"),
  skill("prototyping", "prototyp*"),
  skill("user research", "user research", "usability", "badani* użytkownik*"),
  skill("landing pages", "landing page*", "website*", "stron* internetow*"),
  skill("e-commerce", "e-commerce", "ecommerce", "online store*"),
  skill("CRM and email", "CRM", "email marketing", "newsletter*"),
  // Tools
  skill("Figma", "figma"),
  skill("Adobe Creative Cloud", "adobe", "photoshop", "illustrator", "indesign", "creative cloud"),
  skill("After Effects", "after effects"),
  skill("Jitter", "jitter"),
  skill("Framer / Webflow", "framer", "webflow"),
  // AI
  skill(
    "generative AI",
    "generative AI",
    "genai",
    "gen AI",
    "generatywn* AI",
    "AI-generated",
    "AI generated",
  ),
  skill("Midjourney", "midjourney"),
  skill("Adobe Firefly", "firefly"),
  skill("Runway", "=Runway", "runwayml"),
  skill("Stable Diffusion / ComfyUI", "stable diffusion", "comfyui", "comfy ui", "SDXL", "flux"),
  skill("Krea", "krea"),
  skill(
    "LLMs (Claude, ChatGPT)",
    "LLM",
    "LLMs",
    "large language model*",
    "claude",
    "chatgpt",
    "openai",
    "GPT",
  ),
  skill("prompt engineering", "prompt*"),
  skill("AI workflows and automation", "AI workflow*", "automation*", "automatyzacj*", "agents", "agentic"),
  skill("no-code / vibe coding", "lovable", "v0", "no-code", "low-code", "bolt"),
  skill("coding (HTML, CSS, JS)", "HTML", "CSS", "javascript", "typescript", "react", "creative coding"),
  // Leadership
  skill(
    "team leadership",
    "team lead*",
    "leading a team",
    "led a team",
    "manage* a team",
    "zarządzani* zespoł*",
    "people management",
  ),
  skill("stakeholder management", "stakeholder*", "C-level", "board", "zarząd*"),
  skill("agency experience", "agency", "agencj*"),
  skill("workshops", "workshop*", "warsztat*", "facilitat*"),
  // Commercial
  skill("sales", "sales", "sprzeda*", "selling"),
  skill("negotiation", "negotiat*", "negocjac*"),
  skill("client relationships", "client relationship*", "account management", "relacj* z klient*"),
  skill("business development", "business development", "new business", "lead generation"),
  skill("real estate", "real estate", "nieruchomo*", "property", "properties"),
  skill("fundraising", "fundrais*", "donor*", "darczyń*"),
  skill("B2B", "B2B"),
  skill("SaaS", "SaaS"),
];

const found = (s: Skill, text: string, raw: string) => Boolean(s.ci?.test(text) || s.cs?.test(raw));

export type CvGap = { inCv: string[]; missing: string[] };

/** Skill words and required languages of an offer, split into what the CV shows and what it does not. */
export function cvGap(offer: { title: string; description: string }, cvText: string): CvGap {
  const offerRaw = `${offer.title}\n${offer.description}`;
  const offerText = offerRaw.toLowerCase();
  const cvLower = cvText.toLowerCase();
  const cvLanguage = adLanguage(cvText);
  const inCv: string[] = [];
  const missing: string[] = [];
  for (const s of SKILLS) {
    if (!found(s, offerText, offerRaw)) continue;
    (found(s, cvLower, cvText) ? inCv : missing).push(s.label);
  }
  for (const code of requiredLanguages(offer.description)) {
    const label = `${LANGUAGE_LABEL[code] ?? code} language`;
    // A CV written in the language counts too, even without a "Languages" line.
    (LANG_NAMES[code]?.test(cvText) || cvLanguage === code ? inCv : missing).push(label);
  }
  return { inCv, missing };
}

const CHECKS_HEADING = /^\s*(?:#{1,6}\s*|\*\*\s*)?(?:to check|do sprawdzenia)\b[^\n]*$/im;

/**
 * An AI answer is the CV, then (as the prompt asks) a "To check" section with the offer's
 * requirements the CV does not show. The section never goes into the Word file.
 */
export function splitTailored(text: string): { cv: string; checks: string[] } {
  const t = text.replace(/\r\n?/g, "\n");
  const m = CHECKS_HEADING.exec(t);
  if (!m) return { cv: t.trim(), checks: [] };
  const cv = t
    .slice(0, m.index)
    .replace(/\n\s*(-{3,}|\*{3,}|_{3,})\s*$/, "")
    .trim();
  const checks = t
    .slice(m.index + m[0].length)
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter((l) => l && !/^(-{3,}|\*{3,}|_{3,})$/.test(l))
    .slice(0, 30);
  return { cv, checks };
}
