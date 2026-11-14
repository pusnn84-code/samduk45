import { expect, test } from "@playwright/test";
import { expectNoOverflow } from "./helpers";
import { CONTACT_INSTRUCTION, getBranding } from "../../src/lib/branding";

const branding = getBranding();

for (const width of [360, 1280]) {
  for (const [path, title] of [["/about", "앱 소개"], ["/privacy", "개인정보처리방침"], ["/2027", "2027 사역 계획"]] as const) {
    test(`anonymous ${path} works at ${width}px without authenticated API calls`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      const authRequests: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) authRequests.push(request.url()); });
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page).toHaveTitle(`${title} | 삼덕사오`);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "공개 안내 메뉴" })).toBeVisible();
      if (branding.appOrigin) await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${branding.appOrigin}${path}`);
      else await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      await expect.poll(() => page.locator(".public-brand img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`${path.slice(1)}-${width}.png`), fullPage: path === "/about" });
      expect(authRequests).toEqual([]);
      expect((await context.cookies()).filter(cookie => cookie.name === "prayer_session")).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test("public introduction links directly to the privacy policy and its Google section", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("link", { name: "개인정보처리방침 읽기 →" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole("navigation", { name: "개인정보처리방침 목차" }).getByRole("link", { name: "심방 캘린더" }).click();
  await expect(page).toHaveURL(/\/privacy#google-calendar$/);
  await expect(page.locator("#google-calendar")).toContainText("Limited Use");
  await expect(page.locator("#google-calendar")).toContainText("calendar.calendarlist.readonly");
  if (branding.supportEmail) await expect(page.locator("#rights").getByRole("link", { name: branding.supportEmail })).toHaveAttribute("href", `mailto:${branding.supportEmail}`);
  else {
    await expect(page.locator("#rights")).toContainText(CONTACT_INSTRUCTION);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  }
});

test("login exposes public information without opening member or admin data", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByRole("navigation", { name: "앱 안내", exact: true }).getByRole("link", { name: "앱 소개", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  expect((await request.get("/api/checkins")).status()).toBe(401);
  expect((await request.get("/api/admin/prayer")).status()).toBe(403);
  expect((await request.get("/admin", { maxRedirects: 0 })).status()).toBe(307);
});

test("public information and the 2027 plan remain readable with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const path of ["/about", "/privacy", "/2027"]) {
      expect((await page.goto(path))?.status()).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      if (path === "/2027") {
        await expect(page.getByRole("navigation", { name: "2027 사역 계획 바로가기" })).toBeVisible();
        await expect(page.getByRole("link", { name: "로그인하고 공지 확인하기" })).toBeVisible();
      } else await expect(page.getByRole("main")).toContainText(path === "/about" ? "심방" : "Google");
    }
  } finally { await context.close(); }
});

test("plan contents and timeline links reach existing destinations without sign-in", async ({ page }) => {
  await page.goto("/2027");
  const destinations = await page.locator('.plan2027 a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute("href")!.slice(1)));
  expect(destinations.length).toBeGreaterThan(4);
  for (const id of destinations) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  await page.getByRole("navigation", { name: "2027 사역 계획 바로가기" }).getByRole("link", { name: "한눈에 보는 한 해" }).click();
  await expect(page).toHaveURL(/\/2027#plan2027-timeline$/);
  await expect(page.getByRole("heading", { name: "2027년, 이렇게 함께해요." })).toBeInViewport();
});
