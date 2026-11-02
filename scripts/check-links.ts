/**
 * Checks every link in the Grow library (src/lib/grow/paths.ts) and prints the ones that fail.
 *   pnpm links:check
 * Some sites refuse automated requests (403/429); those are reported separately so they can be
 * checked by hand.
 */
import { PATHS } from "../src/lib/grow/paths.ts";

const urls = [...new Set(PATHS.flatMap((p) => p.links.map((l) => l.url)))];
const UA = "Mozilla/5.0 (TakeALukeStudio link check; +https://lukaszwrzal.com)";
let broken = 0;
let blocked = 0;

async function check(url: string): Promise<string> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return "ok";
      if (method === "GET") return String(res.status);
    } catch (e) {
      if (method === "GET") return e instanceof Error ? e.message : String(e);
    }
  }
  return "unknown";
}

for (const url of urls) {
  const r = await check(url);
  if (r === "ok") continue;
  if (r === "403" || r === "429") {
    blocked++;
    console.log(`blocked ${r}  ${url}`);
  } else {
    broken++;
    console.log(`BROKEN  ${r}  ${url}`);
  }
}
console.log(`${urls.length} links, ${broken} broken, ${blocked} refused automated checks.`);
process.exit(broken ? 1 : 0);
