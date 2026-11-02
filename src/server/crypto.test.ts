import { describe, expect, it } from "vitest";
import { hashPassword, safeEqual, verifyPassword } from "./crypto.ts";

describe("crypto", () => {
  it("hashes and verifies passwords", () => {
    const h = hashPassword("correct horse battery");
    expect(h).not.toContain("$");
    expect(verifyPassword("correct horse battery", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
  it("compares secrets in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
