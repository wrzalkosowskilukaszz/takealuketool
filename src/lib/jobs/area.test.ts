import { describe, expect, it } from "vitest";
import { areaOf, type CareerPrefs, permitOf, scoreJob } from "./match.ts";
import { EXPLORE_FIELDS, TRACKS } from "./types.ts";

const prefs: CareerPrefs = {
  tracks: [...TRACKS],
  exploreFields: [...EXPLORE_FIELDS],
  locations: ["warsaw", "poland_other", "remote_poland", "eu", "world"],
  languages: ["en", "pl"],
  workTypes: ["full_time", "freelance"],
  cvKeywords: ["art direction"],
  extraKeywords: [],
  excludeKeywords: [],
};
const desc =
  "Lead art direction for campaigns. You will work with our teams and partners across the region and present the work to leadership.";
const job = (location: string, workplace?: "remote" | "hybrid" | "onsite") => ({
  title: "Senior Art Director",
  description: desc,
  location,
  workplace,
  companyName: "Acme",
});

describe("Matches tabs", () => {
  it("puts each place in Poland, the EU or the rest of the world", () => {
    expect(scoreJob(job("Warsaw, Poland"), prefs).area).toBe("pl");
    expect(scoreJob(job("Kraków"), prefs).area).toBe("pl");
    expect(scoreJob(job("Remote, Poland", "remote"), prefs).area).toBe("pl");
    expect(scoreJob(job("Berlin, Germany", "hybrid"), prefs).area).toBe("eu");
    expect(scoreJob(job("Zurich, Switzerland"), prefs).area).toBe("eu");
    expect(scoreJob(job("Remote (Europe)", "remote"), prefs).area).toBe("eu");
    expect(scoreJob(job("Remote (Anywhere in the World)", "remote"), prefs).area).toBe("world");
    expect(scoreJob(job("London, United Kingdom"), prefs).area).toBe("world");
    expect(scoreJob(job("New York, USA"), prefs).area).toBe("world");
  });

  it("keeps EU jobs with no permit and marks the rest of the world honestly", () => {
    const berlin = scoreJob(job("Berlin, Germany", "hybrid"), prefs);
    expect(berlin.eligible).toBe(true);
    expect(berlin.reasons.some((r) => /no work permit/.test(r.text))).toBe(true);
    expect(permitOf(berlin.region, berlin.area)).toBe("none");

    const london = scoreJob(job("London, United Kingdom"), prefs);
    expect(london.eligible).toBe(true);
    expect(london.reasons.some((r) => /work visa/.test(r.text) && r.tone === "warn")).toBe(true);
    expect(permitOf(london.region, london.area)).toBe("visa");

    const anywhere = scoreJob(job("Remote (Anywhere in the World)", "remote"), prefs);
    expect(permitOf(anywhere.region, anywhere.area)).toBe("remote");
  });

  it("drops abroad jobs when those places are switched off", () => {
    const pl = {
      ...prefs,
      locations: ["warsaw", "poland_other", "remote_poland"] as CareerPrefs["locations"],
    };
    expect(scoreJob(job("Berlin, Germany", "hybrid"), pl).eligible).toBe(false);
    expect(scoreJob(job("London, United Kingdom"), pl).eligible).toBe(false);
  });

  it("uses the countries a source states", () => {
    expect(areaOf("remote_ok", "Remote", ["PL"])).toBe("pl");
    expect(areaOf("remote_ok", "Remote", ["DE", "FR"])).toBe("eu");
    expect(areaOf("remote_ok", "Remote", [])).toBe("world");
  });
});
