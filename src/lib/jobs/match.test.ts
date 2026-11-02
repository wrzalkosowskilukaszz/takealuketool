import { describe, expect, it } from "vitest";
import {
  adLanguage,
  type CareerPrefs,
  classifyLocation,
  extractCvKeywords,
  requiredLanguages,
  scoreJob,
  titleLooksRelevant,
  worthKeeping,
} from "./match.ts";
import { EXPLORE_FIELDS, TRACKS } from "./types.ts";

const prefs: CareerPrefs = {
  tracks: [...TRACKS],
  exploreFields: [...EXPLORE_FIELDS],
  locations: ["warsaw", "poland_other", "remote_poland"],
  languages: ["en", "pl"],
  workTypes: ["full_time", "freelance"],
  cvKeywords: ["art direction", "midjourney", "brand identity", "figma"],
  extraKeywords: [],
  excludeKeywords: [],
};

const en = (s: string) =>
  `${s} You will work with our teams and partners across the region. We are looking for someone who will shape how our brand looks and feels, and present the work to leadership.`;

describe("job matching", () => {
  it("ranks a senior creative role in Warsaw high, with reasons", () => {
    const m = scoreJob(
      {
        title: "Senior Art Director",
        description: en(
          "Lead art direction for campaigns, brand identity work and AI imagery made with Midjourney.",
        ),
        location: "Warsaw, Poland (hybrid)",
        companyName: "Acme",
      },
      prefs,
    );
    expect(m.eligible).toBe(true);
    expect(m.track).toBe("core");
    expect(m.pivot).toBe("none");
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(m.reasons.map((r) => r.text)).toContain("Warsaw, hybrid");
    expect(m.reasons.some((r) => r.text.startsWith("Matches your CV"))).toBe(true);
  });

  it("reads AI Designer as core, and AI Creative Lead and Creative Technologist as beyond Figma", () => {
    const place = { location: "Remote - EMEA", companyName: "X" };
    expect(scoreJob({ ...place, title: "AI Designer", description: en("") }, prefs).track).toBe("core");
    for (const title of [
      "AI Creative Lead",
      "Creative Technologist",
      "Prompt Engineer, Creative",
      "Creative Strategist",
    ]) {
      const m = scoreJob({ ...place, title, description: en("") }, prefs);
      expect(m.track, title).toBe("beyond");
      expect(m.eligible, title).toBe(true);
    }
  });

  it("files real estate and sales roles under new fields, flagged as a pivot", () => {
    const re = scoreJob(
      { title: "Agent nieruchomości", description: en(""), location: "Warszawa", companyName: "Biuro X" },
      prefs,
    );
    expect(re.track).toBe("new_field");
    expect(re.field).toBe("real_estate");
    expect(["pivot", "big"]).toContain(re.pivot);
    expect(re.figmaShare).toBe("none");
    const sales = scoreJob(
      {
        title: "Account Executive (SaaS)",
        description: en(""),
        location: "Remote, Poland",
        companyName: "Y",
      },
      prefs,
    );
    expect(sales.track).toBe("new_field");
    expect(sales.field).toBe("sales");
    // A junior start is normal for a pivot: it warns but does not punish.
    const junior = scoreJob(
      { title: "Junior Sales Representative", description: en(""), location: "Warszawa", companyName: "Z" },
      prefs,
    );
    expect(junior.eligible).toBe(true);
    expect(junior.reasons.some((r) => r.text.startsWith("Entry level"))).toBe(true);
  });

  it("drops fields that are switched off", () => {
    const job = { title: "Real Estate Agent", description: en(""), location: "Warsaw", companyName: "X" };
    expect(scoreJob(job, { ...prefs, exploreFields: ["sales"] }).eligible).toBe(false);
    expect(titleLooksRelevant("Real Estate Agent", { ...prefs, exploreFields: ["sales"] })).toBe(false);
  });

  it("keeps engineering and unrelated roles out", () => {
    for (const t of ["Staff Software Engineer - Java Platform", "Personal Trainer", "Warehouse Operative"])
      expect(titleLooksRelevant(t, prefs), t).toBe(false);
    expect(titleLooksRelevant("Senior Graphic Designer", prefs)).toBe(true);
  });

  it("keeps Warsaw, Poland and remote-open-to-Poland, and drops everything else", () => {
    expect(classifyLocation({ location: "Remote - EMEA" })).toBe("remote_ok");
    expect(classifyLocation({ location: "Remote", countries: ["PL", "DE"], workplace: "remote" })).toBe(
      "remote_ok",
    );
    expect(classifyLocation({ location: "Remote (US only)" })).toBe("non_eu");
    expect(classifyLocation({ location: "London, United Kingdom" })).toBe("non_eu");
    expect(classifyLocation({ location: "Kraków" })).toBe("poland");
    expect(classifyLocation({ location: "POL - Warszawa" })).toBe("warsaw");
    expect(classifyLocation({ location: "Berlin, Germany" })).toBe("eu");
    const berlin = scoreJob(
      {
        title: "Senior Graphic Designer",
        description: en(""),
        location: "Berlin, Germany",
        companyName: "X",
      },
      prefs,
    );
    expect(berlin.eligible).toBe(false);
    expect(berlin.score).toBe(0);
    const nowhere = scoreJob(
      { title: "Art Director", description: en(""), location: null, companyName: "X" },
      prefs,
    );
    expect(nowhere.eligible).toBe(false);
  });

  it("respects the chosen places: other Polish cities only when switched on", () => {
    const job = { title: "Graphic Designer", description: en(""), location: "Kraków", companyName: "X" };
    expect(scoreJob(job, prefs).eligible).toBe(true);
    expect(scoreJob(job, { ...prefs, locations: ["warsaw", "remote_poland"] }).eligible).toBe(false);
  });

  it("marks German-language ads and required languages you do not speak", () => {
    const de =
      "Wir suchen eine Designerin für unsere Teams. Sie sind verantwortlich für die Entwicklung und Durchführung von Kampagnen und Markenauftritten für Kunden in der Region. Fließende Deutschkenntnisse sind erforderlich und wir bieten eine tolle Arbeit mit der Möglichkeit für Wachstum.";
    expect(adLanguage(de)).toBe("de");
    expect(requiredLanguages("Fluent German and English are required.")).toEqual(
      expect.arrayContaining(["de", "en"]),
    );
    const m = scoreJob(
      { title: "Senior Graphic Designer", description: de, location: "Warszawa", companyName: "X" },
      prefs,
    );
    expect(m.reasons.some((r) => r.tone === "bad" && /German/.test(r.text))).toBe(true);
  });

  it("estimates how much hands-on Figma work a role has", () => {
    const place = { location: "Warsaw", companyName: "X" };
    expect(
      scoreJob({ ...place, title: "Product Designer", description: en("Daily work in Figma.") }, prefs)
        .figmaShare,
    ).toBe("hands_on");
    expect(scoreJob({ ...place, title: "Creative Director", description: en("") }, prefs).figmaShare).toBe(
      "direction",
    );
  });

  it("keeps eligible offers above the floor, and every eligible offer from a favourite company", () => {
    const m = scoreJob(
      { title: "Graphic Designer", description: en(""), location: "Warsaw", companyName: "X" },
      prefs,
    );
    expect(worthKeeping(m, false)).toBe(m.score >= 25);
    expect(worthKeeping({ ...m, score: 5 }, true)).toBe(true);
    expect(worthKeeping({ ...m, eligible: false }, true)).toBe(false);
  });

  it("finds known skills in a CV", () => {
    const k = extractCvKeywords(
      "Art Director and AI Creative Lead. Brand identity, campaigns, Midjourney, Figma, prompt engineering, presentations to C-level.",
    );
    expect(k).toEqual(expect.arrayContaining(["midjourney", "figma"]));
  });
});
