/**
 * The experience base and CV versions, shared by the server and the browser. This was ported from
 * Łukasz's "Kreator CV pod oferty", and its rules still hold:
 * - The base is a list of atomic facts, each with a status. Only "confirmed" facts may reach a CV.
 * - Every line of a CV cites the fact ids it rests on. Employers, titles and dates always come from the
 *   base and are never written by the model.
 * - A number in a CV line must appear in one of the facts that line cites.
 * The data format matches the Kreator's, so its JSON exports import as they are.
 */
import { z } from "zod";

export const FACT_STATUSES = ["confirmed", "to_verify", "interpretation"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];
export const STATUS_LABEL: Record<FactStatus, string> = {
  confirmed: "Confirmed",
  to_verify: "To confirm",
  interpretation: "Interpretation",
};

/** Fact kinds keep the Kreator's Polish values so its data imports unchanged; the UI shows English labels. */
export const KINDS = [
  "obowiązek",
  "odpowiedzialność",
  "projekt",
  "osiągnięcie",
  "współpraca",
  "kontekst",
  "profil",
  "kompetencja",
  "narzędzie",
  "edukacja",
  "certyfikat",
  "szkolenie",
  "język",
] as const;
export const KIND_LABEL: Record<string, string> = {
  obowiązek: "Duty",
  odpowiedzialność: "Responsibility",
  projekt: "Project",
  osiągnięcie: "Achievement",
  współpraca: "Collaboration",
  kontekst: "Context",
  profil: "Profile",
  kompetencja: "Skill",
  narzędzie: "Tool",
  edukacja: "Education",
  certyfikat: "Certificate",
  szkolenie: "Training",
  język: "Language",
};

const str = (max: number) => z.string().max(max).catch("");

export const Fact = z.object({
  id: z.string().min(1).max(60),
  text: z.string().max(2000),
  kind: z.string().max(40).catch("obowiązek"),
  status: z.enum(FACT_STATUSES).catch("to_verify"),
  source: str(400).optional().default(""),
  note: str(1000).optional().default(""),
});
export type Fact = z.infer<typeof Fact>;

export const Role = z.object({
  id: z.string().min(1).max(60),
  company: z.string().max(200),
  title: z.string().max(200),
  contract: str(100).optional().default(""),
  /** "YYYY-MM" or "YYYY". */
  start: z.string().max(10).catch(""),
  /** null = ongoing. */
  end: z.string().max(10).nullable().catch(null),
  dateFormat: z.enum(["month", "year"]).catch("month"),
  facts: z.array(Fact).max(200).default([]),
});
export type Role = z.infer<typeof Role>;

export const Personal = z.object({
  name: str(200).default(""),
  headline: str(300).default(""),
  phone: str(60).default(""),
  email: str(200).default(""),
  linkedin: str(300).default(""),
  website: str(300).default(""),
  location: str(200).default(""),
});

export const ExperienceBase = z.object({
  schemaVersion: z.number().int().catch(1).default(1),
  personal: Personal,
  profile: z.array(Fact).max(100).default([]),
  roles: z.array(Role).max(60),
  skills: z.array(Fact).max(300).default([]),
  education: z.array(Fact).max(100).default([]),
  languages: z.array(Fact).max(30).default([]),
  roles_note: str(2000).optional(),
  updatedAt: z.string().nullable().optional(),
});
export type ExperienceBase = z.infer<typeof ExperienceBase>;

export const BASE_SECTIONS = ["profile", "skills", "education", "languages"] as const;

export type SectionFact = Fact & {
  section: "profile" | "role" | "skills" | "education" | "languages";
  roleId?: string;
};

export function allFacts(base: ExperienceBase | null): SectionFact[] {
  if (!base) return [];
  const out: SectionFact[] = [];
  for (const f of base.profile) out.push({ ...f, section: "profile" });
  for (const r of base.roles) for (const f of r.facts) out.push({ ...f, section: "role", roleId: r.id });
  for (const s of ["skills", "education", "languages"] as const)
    for (const f of base[s]) out.push({ ...f, section: s });
  return out;
}

export function factIndex(base: ExperienceBase | null): Map<string, SectionFact> {
  return new Map(allFacts(base).map((f) => [f.id, f]));
}

/** Newest first; ongoing roles before ended ones that started in the same month. */
export function sortedRoles(base: ExperienceBase): Role[] {
  return [...base.roles].sort(
    (a, b) => String(b.start).localeCompare(String(a.start)) || (a.end === null ? -1 : 1),
  );
}

export function fmtDate(v: string | null, fmt: "month" | "year", present = "present"): string {
  if (!v) return present;
  if (fmt === "year") return v.slice(0, 4);
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  return m ? `${m[2]}.${m[1]}` : v;
}

export const roleDates = (r: Pick<Role, "start" | "end" | "dateFormat">, present = "present") =>
  `${fmtDate(r.start, r.dateFormat)} – ${fmtDate(r.end, r.dateFormat, present)}`;

/** The base as prompt text: confirmed facts (usable) or the rest (information only). */
export function baseAsPrompt(base: ExperienceBase, which: "confirmed" | "unconfirmed"): string {
  const keep = (f: Fact) => (which === "confirmed" ? f.status === "confirmed" : f.status !== "confirmed");
  const line = (f: Fact) => `  [${f.id}] (${f.kind}) ${f.text}`;
  const L: string[] = [];
  const prof = base.profile.filter(keep);
  if (prof.length) L.push("PROFILE", ...prof.map(line));
  for (const r of sortedRoles(base)) {
    const fs = r.facts.filter(keep);
    if (which === "confirmed" || fs.length) {
      L.push(
        `ROLE ${r.id} | title: ${r.title} | employer: ${r.company}${r.contract ? ` | ${r.contract}` : ""} | ${roleDates(r)}`,
        ...fs.map(line),
      );
    }
  }
  for (const [sec, name] of [
    ["skills", "SKILLS & TOOLS"],
    ["education", "EDUCATION, CERTIFICATES, TRAINING"],
    ["languages", "LANGUAGES"],
  ] as const) {
    const fs = base[sec].filter(keep);
    if (fs.length) L.push(name, ...fs.map(line));
  }
  return L.join("\n");
}

export function baseToMarkdown(base: ExperienceBase): string {
  const fl = (fs: Fact[]) =>
    fs
      .map(
        (f) =>
          `- [${f.id}] (${KIND_LABEL[f.kind] ?? f.kind}) ${f.text} — ${STATUS_LABEL[f.status]}${f.note ? ` — note: ${f.note}` : ""}`,
      )
      .join("\n");
  const p = base.personal;
  const o = [
    `# Experience base — ${p.name}`,
    "",
    `Headline: ${p.headline}`,
    `Contact: ${[p.phone, p.email, p.linkedin, p.website, p.location].filter(Boolean).join(" · ")}`,
    "",
    "## Profile",
    fl(base.profile),
    "",
    "## Experience",
  ];
  for (const r of sortedRoles(base))
    o.push(
      "",
      `### ${r.title} — ${r.company}`,
      roleDates(r) + (r.contract ? ` · ${r.contract}` : ""),
      "",
      fl(r.facts),
    );
  o.push(
    "",
    "## Skills and tools",
    fl(base.skills),
    "",
    "## Education, certificates, training",
    fl(base.education),
    "",
    "## Languages",
    fl(base.languages),
  );
  return o.join("\n");
}

// ---------------------------------------------------------------------------
// CV versions
// ---------------------------------------------------------------------------

export const CvLine = z.object({
  text: z.string().max(3000),
  fact_ids: z.array(z.string().max(60)).max(40).default([]),
});
export type CvLine = z.infer<typeof CvLine>;

export const CvRole = z.object({
  role_id: z.string(),
  title: z.string(),
  company: z.string(),
  contract: z.string().default(""),
  start: z.string(),
  end: z.string().nullable(),
  dateFormat: z.enum(["month", "year"]).catch("month"),
  function_note: z.string().default(""),
  bullets: z.array(CvLine).default([]),
});

export const CvDoc = z.object({
  labels: z.object({
    summary: z.string(),
    skills: z.string(),
    experience: z.string(),
    education: z.string(),
    languages: z.string(),
    tools: z.string(),
    present: z.string(),
  }),
  headline: z.string().max(400),
  personal: Personal,
  summary: z.array(CvLine).max(12),
  core_skills: z.array(CvLine).max(30),
  experience: z.array(CvRole).max(60),
  education: z.array(CvLine).max(30),
  languages: z.array(CvLine).max(20),
  tools: z.array(CvLine).max(60),
});
export type CvDoc = z.infer<typeof CvDoc>;

export const CvIssue = z.object({
  path: z.string(),
  severity: z.enum(["high", "low"]),
  problem: z.string(),
  suggestion: z.string().default(""),
  by: z.string().optional(),
});
export type CvIssue = z.infer<typeof CvIssue>;

export const CvChecks = z.object({
  local: z.array(CvIssue).default([]),
  claude: z.array(CvIssue).default([]),
  language_notes: z.array(z.string()).default([]),
  dismissed: z.array(z.string()).default([]),
  failed: z.boolean().optional(),
  at: z.string().optional(),
});
export type CvChecks = z.infer<typeof CvChecks>;

/** Every statement slot of a CV with its path, e.g. "experience.2.bullets.0". */
export function cvItems(cv: CvDoc): [string, CvLine][] {
  const L: [string, CvLine][] = [];
  for (const [i, x] of cv.summary.entries()) L.push([`summary.${i}`, x]);
  for (const [i, x] of cv.core_skills.entries()) L.push([`core_skills.${i}`, x]);
  for (const [j, e] of cv.experience.entries())
    for (const [i, x] of e.bullets.entries()) L.push([`experience.${j}.bullets.${i}`, x]);
  for (const sec of ["education", "languages", "tools"] as const)
    for (const [i, x] of cv[sec].entries()) L.push([`${sec}.${i}`, x]);
  return L;
}

export function getLine(cv: CvDoc, path: string): CvLine | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: walking a dotted path through a typed object.
  return path.split(".").reduce<any>((o, k) => o?.[k], cv) as CvLine | undefined;
}

const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));

/** Rule checks that need no model: every line has sources, the sources exist and are confirmed, numbers match. */
export function localChecks(cv: CvDoc, base: ExperienceBase): CvIssue[] {
  const idx = factIndex(base);
  const issues: CvIssue[] = [];
  for (const [path, x] of cvItems(cv)) {
    const src = x.fact_ids.map((id) => idx.get(id)).filter((f): f is SectionFact => Boolean(f));
    const missing = x.fact_ids.filter((id) => !idx.has(id));
    const unconfirmed = src.filter((f) => f.status !== "confirmed");
    if (!x.fact_ids.length)
      issues.push({ path, severity: "high", problem: "No source in the experience base.", suggestion: "" });
    else if (missing.length)
      issues.push({
        path,
        severity: "high",
        problem: `Cites facts that do not exist: ${missing.join(", ")}`,
        suggestion: "",
      });
    if (unconfirmed.length)
      issues.push({
        path,
        severity: "high",
        problem: `Rests on an unconfirmed fact: ${unconfirmed.map((f) => f.id).join(", ")}`,
        suggestion: "",
      });
    const srcNums = new Set(src.flatMap((f) => nums(f.text)));
    const extra = nums(x.text).filter((n) => !srcNums.has(n));
    if (src.length && extra.length)
      issues.push({
        path,
        severity: "high",
        problem: `A number not found in the sources: ${extra.join(", ")}`,
        suggestion: "",
      });
  }
  return issues;
}

export const issueKey = (i: Pick<CvIssue, "path" | "problem">) => `${i.path}|${i.problem}`;

/** The model's CV draft, with headers (employer, title, dates) filled in from the base, never from the model. */
export function normalizeCv(
  raw: {
    labels?: Partial<CvDoc["labels"]>;
    headline?: string;
    summary?: CvLine[];
    core_skills?: CvLine[];
    experience?: { role_id: string; contract_label?: string; function_note?: string; bullets?: CvLine[] }[];
    education?: CvLine[];
    languages?: CvLine[];
    tools?: CvLine[];
  },
  base: ExperienceBase,
): CvDoc {
  const arr = (a: CvLine[] | undefined) =>
    (a ?? [])
      .filter((x) => x && String(x.text ?? "").trim())
      .map((x) => ({ text: String(x.text).trim(), fact_ids: (x.fact_ids ?? []).map(String) }));
  const byId = new Map((raw.experience ?? []).map((e) => [e.role_id, e]));
  const out: CvDoc = {
    labels: {
      summary: "Summary",
      skills: "Skills",
      experience: "Experience",
      education: "Education",
      languages: "Languages",
      tools: "Tools",
      present: "present",
      ...Object.fromEntries(
        Object.entries(raw.labels ?? {}).filter(([, v]) => typeof v === "string" && v.trim()),
      ),
    },
    headline: String(raw.headline || base.personal.headline || ""),
    personal: { ...base.personal },
    summary: arr(raw.summary),
    core_skills: arr(raw.core_skills),
    education: arr(raw.education),
    languages: arr(raw.languages),
    tools: arr(raw.tools),
    experience: sortedRoles(base).map((r) => {
      const e = byId.get(r.id);
      return {
        role_id: r.id,
        title: r.title,
        company: r.company,
        contract: r.contract ? String(e?.contract_label ?? "").trim() || r.contract : "",
        start: r.start,
        end: r.end,
        dateFormat: r.dateFormat,
        function_note: String(e?.function_note ?? ""),
        bullets: arr(e?.bullets),
      };
    }),
  };
  return out;
}

export type CvSection =
  | { title: string; type: "para"; text: string }
  | { title: string; type: "list"; items: string[] }
  | {
      title: string;
      type: "roles";
      roles: { head: string; dates: string; sub: string; bullets: string[] }[];
    };

/** The CV as a layout-neutral model for Word, plain text and print. */
export function cvModel(cv: CvDoc) {
  const L = cv.labels;
  const p = cv.personal;
  const sections: (CvSection | null)[] = [
    cv.summary.length
      ? { title: L.summary, type: "para", text: cv.summary.map((x) => x.text).join(" ") }
      : null,
    cv.core_skills.length
      ? { title: L.skills, type: "para", text: cv.core_skills.map((x) => x.text).join(" | ") }
      : null,
    {
      title: L.experience,
      type: "roles",
      roles: cv.experience.map((e) => ({
        head: `${e.title} — ${e.company}`,
        dates: `${fmtDate(e.start, e.dateFormat)} – ${fmtDate(e.end, e.dateFormat, L.present)}`,
        sub: [e.contract, e.function_note].filter(Boolean).join(" · "),
        bullets: e.bullets.map((b) => b.text),
      })),
    },
    cv.education.length ? { title: L.education, type: "list", items: cv.education.map((x) => x.text) } : null,
    cv.languages.length ? { title: L.languages, type: "list", items: cv.languages.map((x) => x.text) } : null,
    cv.tools.length ? { title: L.tools, type: "para", text: cv.tools.map((x) => x.text).join(", ") } : null,
  ];
  return {
    name: p.name,
    headline: cv.headline,
    contact: [p.phone, p.email, p.linkedin, p.website, p.location].filter(Boolean).join(" | "),
    sections: sections.filter((s): s is CvSection => s !== null),
  };
}

export function cvPlainText(cv: CvDoc): string {
  const m = cvModel(cv);
  const o = [m.name, m.headline, m.contact, ""];
  for (const s of m.sections) {
    o.push(s.title.toUpperCase());
    if (s.type === "para") o.push(s.text);
    if (s.type === "list") for (const i of s.items) o.push(`• ${i}`);
    if (s.type === "roles")
      for (const r of s.roles) {
        o.push("", `${r.head} | ${r.dates}`);
        if (r.sub) o.push(r.sub);
        for (const b of r.bullets) o.push(`• ${b}`);
      }
    o.push("");
  }
  return `${o.join("\n").trim()}\n`;
}

export const LANGS: Record<string, string> = {
  pl: "Polish",
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  nl: "Dutch",
  cs: "Czech",
  uk: "Ukrainian",
  pt: "Portuguese",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
};
