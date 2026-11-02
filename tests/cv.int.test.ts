import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { normalizeCv } from "../src/lib/cv/base.ts";
import {
  createVersion,
  deleteVersion,
  duplicateVersion,
  getBase,
  getVersion,
  importBundle,
  listVersions,
  saveBase,
  saveVersion,
} from "../src/server/cv/service.ts";
import { closeDb } from "../src/server/db/client.ts";
import { hasDb, resetDb } from "./db.ts";

const kreatorBase = {
  schemaVersion: 1,
  personal: {
    name: "Łukasz",
    headline: "AI Creative Lead",
    phone: "",
    email: "",
    linkedin: "",
    website: "",
    location: "Warsaw",
  },
  profile: [],
  roles: [
    {
      id: "r_unicef",
      company: "UNICEF Poland",
      title: "Creative Lead",
      contract: "B2B contract",
      start: "2023-05",
      end: null,
      dateFormat: "month",
      facts: [
        {
          id: "f1",
          text: "Led the creative team for 17 markets.",
          kind: "odpowiedzialność",
          status: "confirmed",
          source: "CV",
          note: "",
        },
        { id: "f2", text: "", kind: "obowiązek", status: "confirmed", source: "", note: "" },
      ],
    },
  ],
  skills: [
    { id: "s1", text: "Prompt design", kind: "kompetencja", status: "to_verify", source: "", note: "" },
  ],
  education: [],
  languages: [],
  updatedAt: "2026-11-01T10:00:00.000Z",
};

const posting = `Senior Creative Lead, Warsaw. ${"You will lead a team of designers and own campaigns across markets. ".repeat(5)}`;

describe.skipIf(!hasDb)("CV studio", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("imports a Kreator base on its own, dropping empty facts", async () => {
    const r = await importBundle(kreatorBase);
    expect(r).toEqual({ facts: 2, versions: 0 });
    const b = await getBase();
    expect(b!.roles[0]!.facts.map((f) => f.id)).toEqual(["f1"]);
    expect(b!.updatedAt).not.toBe(kreatorBase.updatedAt);
  });

  it("imports a bundle with versions once, even when run twice", async () => {
    await importBundle(kreatorBase);
    const cv = normalizeCv(
      {
        experience: [
          { role_id: "r_unicef", bullets: [{ text: "Led the team for 17 markets.", fact_ids: ["f1"] }] },
        ],
      },
      (await getBase())!,
    );
    const version = {
      id: "vabc",
      createdAt: "2026-11-01T15:00:00.000Z",
      company: "Meta",
      position: "Creative Strategist",
      language: "en",
      link: "https://example.com/meta",
      offerText: posting,
      analysis: { summary: "x" },
      cv,
      meta: { changes: ["a"], gaps: [], questions: [] },
      checks: { local: [], claude: [], language_notes: [], dismissed: [] },
    };
    expect((await importBundle({ base: kreatorBase, versions: [version] })).versions).toBe(1);
    expect((await importBundle({ base: kreatorBase, versions: [version] })).versions).toBe(0);
    const list = await listVersions();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ company: "Meta", stage: "done", issues: 0 });
  });

  it("refuses to overwrite a base saved in another window", async () => {
    await importBundle(kreatorBase);
    const b = (await getBase())!;
    await saveBase(b, b.updatedAt);
    await expect(saveBase(b, b.updatedAt)).rejects.toThrow(/another window/);
  });

  it("needs a full posting and a base before writing a CV", async () => {
    await expect(createVersion({ offerText: posting })).rejects.toThrow(/experience base is empty/);
    await importBundle(kreatorBase);
    await expect(createVersion({ offerText: "https://example.com/job" })).rejects.toThrow(/full posting/);
    await expect(createVersion({ offerText: "Art Director" })).rejects.toThrow(/full posting/);
    const { id } = await createVersion({ offerText: posting, link: " https://example.com/x " });
    const v = await getVersion(id);
    expect(v).toMatchObject({ stage: "new", link: "https://example.com/x", cv: null });
  });

  it("recomputes rule checks on save and keeps dismissed ones dismissed", async () => {
    await importBundle(kreatorBase);
    const base = (await getBase())!;
    const { id } = await createVersion({ offerText: posting });
    const cv = normalizeCv(
      {
        experience: [
          {
            role_id: "r_unicef",
            bullets: [
              { text: "Led a team of 9.", fact_ids: ["f1"] },
              { text: "Prompt design.", fact_ids: ["s1"] },
            ],
          },
        ],
      },
      base,
    );
    let v = await saveVersion(id, { cv, checks: {} });
    expect(v.checks.local.map((i) => i.path)).toEqual(["experience.0.bullets.0", "experience.0.bullets.1"]);
    const first = v.checks.local[0]!;
    v = await saveVersion(id, { cv, checks: { dismissed: [`${first.path}|${first.problem}`] } });
    expect(v.checks.local.map((i) => i.path)).toEqual(["experience.0.bullets.1"]);

    const copy = await duplicateVersion(id);
    expect((await getVersion(copy.id)).position).toMatch(/\(copy\)$/);
    await deleteVersion(id);
    expect((await listVersions()).map((x) => x.id)).toEqual([copy.id]);
  });
});
