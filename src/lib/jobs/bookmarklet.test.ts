import { describe, expect, it } from "vitest";
import { bookmarkletHref, decodeSavedAd } from "./bookmarklet";

const enc = (o: unknown) => Buffer.from(JSON.stringify(o), "utf8").toString("base64");

describe("bookmarklet", () => {
  it("is a valid javascript: link pointing at the Studio", () => {
    const href = bookmarkletHref("https://studio.example/");
    expect(href.startsWith("javascript:")).toBe(true);
    const code = decodeURIComponent(href.slice("javascript:".length));
    expect(code).toContain("'https://studio.example/save#d='");
    expect(() => new Function(code)).not.toThrow();
  });

  it("decodes Polish text from the fragment", () => {
    const ad = decodeSavedAd(
      `#d=${enc({ u: "https://www.pracuj.pl/praca/x", t: "Projektant graficzny", c: "Żabka", l: "Kraków, PL", p: "x", x: "Opis stanowiska — łódź", r: false })}`,
    );
    expect(ad?.t).toBe("Projektant graficzny");
    expect(ad?.c).toBe("Żabka");
    expect(ad?.x).toBe("Opis stanowiska — łódź");
  });

  it("rejects missing, mangled or non-http data", () => {
    expect(decodeSavedAd("")).toBeNull();
    expect(decodeSavedAd("#d=%%%")).toBeNull();
    expect(decodeSavedAd(`#d=${enc({ u: "javascript:alert(1)", t: "x" })}`)).toBeNull();
  });
});
