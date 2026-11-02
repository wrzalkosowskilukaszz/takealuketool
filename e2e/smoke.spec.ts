import { expect, type Page, test } from "@playwright/test";

const password = process.env.E2E_PASSWORD;
test.skip(!password, "Set E2E_PASSWORD (and E2E_BASE_URL) to run the smoke tests.");

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="password"]', password!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/matches/);
}

test("login is required and a wrong password is refused", async ({ page }) => {
  await page.goto("/matches");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="password"]', "definitely-not-the-password");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/login/);
});

const SCREENS: [string, RegExp][] = [
  ["/matches", /Matches/],
  ["/explore", /Explore/],
  ["/pipeline", /Pipeline/],
  ["/grow", /Grow/],
  ["/grow/real-estate", /Real estate/],
  ["/companies", /Companies/],
  ["/settings", /Settings/],
];

test("every screen renders without errors or horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await login(page);
  for (const [path, heading] of SCREENS) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("h1").first(), path).toHaveText(heading);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("the APIs behind each screen answer", async ({ page }) => {
  await login(page);
  for (const path of [
    "/api/jobs?screen=matches&view=best",
    "/api/jobs?screen=explore&view=all",
    "/api/pipeline",
    "/api/companies",
    "/api/status",
    "/api/advisor/general",
  ]) {
    const r = await page.request.get(path);
    expect(r.status(), path).toBe(200);
  }
  expect((await page.request.get("/api/digest")).status(), "digest needs its token").toBe(401);
});
