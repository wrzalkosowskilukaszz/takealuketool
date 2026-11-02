import { describe, expect, it } from "vitest";
import { clip } from "./client.ts";
import { clipFit, scoreErrorText } from "./score.ts";

describe("clip", () => {
  it("keeps short text and cuts long text at a word", () => {
    expect(clip("  short  ", 10)).toBe("short");
    const out = clip("one two three four five six seven", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("clipFit", () => {
  it("enforces the limits the output schema cannot", () => {
    const f = clipFit({
      score: 104.4,
      summary: "s".repeat(400),
      why: ["a ".repeat(200), "b", "c", "d"],
      gaps: [],
      angle: "x",
      track: "beyond",
      pivot: "none",
      figmaShare: "direction",
    });
    expect(f.score).toBe(100);
    expect(f.summary.length).toBeLessThanOrEqual(300);
    expect(f.why).toHaveLength(3);
    expect(f.why[0]!.length).toBeLessThanOrEqual(220);
  });
});

describe("scoreErrorText", () => {
  it("hides parser dumps", () => {
    expect(scoreErrorText(new Error('Failed to parse structured output: [{"code":"too_big"}]'))).toMatch(
      /unexpected format/,
    );
  });
});
