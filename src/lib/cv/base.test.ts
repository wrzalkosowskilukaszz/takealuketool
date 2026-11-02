import { describe, expect, it } from "vitest";
import {
  baseAsPrompt,
  cvItems,
  cvModel,
  cvPlainText,
  ExperienceBase,
  fmtDate,
  localChecks,
  normalizeCv,
  sortedRoles,
} from "./base";

const base = ExperienceBase.parse({
  personal: { name: "Łukasz", headline: "AI Creative Lead", email: "l@example.com" },
  profile: [{ id: "p1", text: "Creative lead with AI focus.", kind: "profil", status: "confirmed" }],
  roles: [
    {
      id: "r_old",
      company: "Expondo",
      title: "Senior Creative Designer",
      start: "2019-03",
      end: "2021-08",
      dateFormat: "month",
      facts: [{ id: "f1", text: "Designed campaigns for 17 markets.", kind: "projekt", status: "confirmed" }],
    },
    {
      id: "r_new",
      company: "UNICEF Poland",
      title: "Creative Lead",
      contract: "B2B contract",
      start: "2023-05",
      end: null,
      dateFormat: "month",
      facts: [
        { id: "f2", text: "Led the creative team.", kind: "odpowiedzialność", status: "confirmed" },
        {
          id: "f3",
          text: "Maybe improved conversion by 30%.",
          kind: "osiągnięcie",
          status: "interpretation",
        },
      ],
    },
  ],
  skills: [{ id: "s1", text: "Prompt design", kind: "kompetencja", status: "to_verify" }],
});

describe("experience base", () => {
  it("accepts a Kreator export and fills defaults", () => {
    expect(base.education).toEqual([]);
    expect(base.roles[0]!.contract).toBe("");
  });

  it("sorts roles newest first", () => {
    expect(sortedRoles(base).map((r) => r.id)).toEqual(["r_new", "r_old"]);
  });

  it("formats dates and ongoing roles", () => {
    expect(fmtDate("2023-05", "month")).toBe("05.2023");
    expect(fmtDate("2023-05", "year")).toBe("2023");
    expect(fmtDate(null, "month", "obecnie")).toBe("obecnie");
  });

  it("keeps unconfirmed facts out of the usable prompt", () => {
    const usable = baseAsPrompt(base, "confirmed");
    expect(usable).toContain("[f2]");
    expect(usable).not.toContain("[f3]");
    expect(usable).not.toContain("[s1]");
    const info = baseAsPrompt(base, "unconfirmed");
    expect(info).toContain("[f3]");
    expect(info).toContain("[s1]");
    expect(info).not.toContain("[f2]");
  });
});

describe("CV drafts", () => {
  const cv = normalizeCv(
    {
      labels: { experience: "Doświadczenie" },
      headline: "",
      summary: [{ text: "Creative lead for 17 markets.", fact_ids: ["f1"] }],
      core_skills: [{ text: "Team leadership", fact_ids: ["f2"] }],
      experience: [
        // The model may not change employers, titles or dates: they come from the base.
        {
          role_id: "r_new",
          contract_label: "Kontrakt B2B",
          function_note: "",
          bullets: [
            { text: "Led a team of 12.", fact_ids: ["f2"] },
            { text: "Raised conversion by 30%.", fact_ids: ["f3"] },
            { text: "Ran workshops.", fact_ids: [] },
            { text: "Shipped things.", fact_ids: ["nope"] },
          ],
        },
      ],
    },
    base,
  );

  it("fills role headers from the base, in base order, including roles the model skipped", () => {
    expect(cv.experience.map((e) => [e.role_id, e.company, e.start])).toEqual([
      ["r_new", "UNICEF Poland", "2023-05"],
      ["r_old", "Expondo", "2019-03"],
    ]);
    expect(cv.experience[0]!.contract).toBe("Kontrakt B2B");
    expect(cv.experience[1]!.contract).toBe("");
    expect(cv.headline).toBe("AI Creative Lead");
    expect(cv.labels.experience).toBe("Doświadczenie");
    expect(cv.labels.summary).toBe("Summary");
  });

  it("lists every line with its path", () => {
    expect(cvItems(cv).map(([p]) => p)).toEqual([
      "summary.0",
      "core_skills.0",
      "experience.0.bullets.0",
      "experience.0.bullets.1",
      "experience.0.bullets.2",
      "experience.0.bullets.3",
    ]);
  });

  it("flags lines without sources, unknown or unconfirmed sources, and invented numbers", () => {
    const issues = localChecks(cv, base);
    const at = (p: string) => issues.filter((i) => i.path === p).map((i) => i.problem);
    expect(at("summary.0")).toEqual([]); // 17 is in f1
    expect(at("core_skills.0")).toEqual([]);
    expect(at("experience.0.bullets.0")[0]).toMatch(/number not found.*12/);
    expect(at("experience.0.bullets.1").some((p) => /unconfirmed fact: f3/.test(p))).toBe(true);
    expect(at("experience.0.bullets.2")[0]).toMatch(/No source/);
    expect(at("experience.0.bullets.3")[0]).toMatch(/do not exist: nope/);
  });

  it("renders plain text with headers from the base", () => {
    const text = cvPlainText(cv);
    expect(text).toContain("Creative Lead — UNICEF Poland | 05.2023 – present");
    expect(text).toContain("DOŚWIADCZENIE");
    expect(cvModel(cv).contact).toBe("l@example.com");
  });
});
