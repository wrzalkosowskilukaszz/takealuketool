import { describe, expect, it } from "vitest";
import { cvGap, splitTailored } from "./tailor.ts";

const offer = {
  title: "Senior Art Director",
  description:
    "You will lead art direction for integrated campaigns, build brand identity systems and present to C-level. " +
    "Experience with Midjourney or Runway and After Effects is a plus. Fluent German is required. " +
    "During the workday you will excel at keeping things simple. We aid our teams.",
};

describe("CV gap for one offer", () => {
  it("splits the offer's skills into what the CV shows and what it does not", () => {
    const cv =
      "Art Director. Led art direction of campaigns for Win Casino and UNICEF, brand identity and key visuals. " +
      "Generative imagery in Midjourney. Presented to the board. Languages: English C1, Polish native.";
    const g = cvGap(offer, cv);
    expect(g.inCv).toEqual(
      expect.arrayContaining(["art direction", "campaigns", "brand identity", "Midjourney"]),
    );
    expect(g.missing).toEqual(expect.arrayContaining(["After Effects", "German language"]));
  });

  it("does not count ordinary words as tools", () => {
    const g = cvGap(offer, "");
    const all = [...g.inCv, ...g.missing];
    expect(all).not.toContain("Workday");
    expect(all).not.toContain("generative AI"); // "aid"
  });

  it("counts a language the CV is written in", () => {
    const g = cvGap(
      { title: "Designer", description: "Fluent English is required for this role with our clients." },
      "I am a designer with ten years of experience. I have worked with the teams and the leaders of the " +
        "largest companies in the region, and I have designed brands and campaigns for them that are still " +
        "running in the market today.",
    );
    expect(g.inCv).toContain("English language");
  });
});

describe("splitting an AI answer", () => {
  it("separates the CV from the To check notes", () => {
    const { cv, checks } = splitTailored(
      "# Łukasz\n\n## Experience\n- Art Director\n\n## To check\n1. German is not in the CV.\n2. Confirm the UNICEF wording.",
    );
    expect(cv).toContain("## Experience");
    expect(cv).not.toContain("To check");
    expect(checks).toHaveLength(2);
  });
});
