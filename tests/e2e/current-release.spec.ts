import { expect, test } from "@playwright/test";
import { login, expectNoOverflow } from "./helpers";

test.describe("current approved member experience", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Disposable database only");
  for (const width of [360, 1280]) {
    test(`all member menus render without horizontal overflow at ${width}px`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width, height: 900 });
      await login(page);
      const routes = ["/", "/notices", "/birthdays", "/bible-reading", "/scripture", "/scripture/bible", "/scripture/hymns", "/prayer-requests", "/visits", "/community", "/our-community", "/pastoral-reports", "/autumn-light", "/ministry-plan", "/profile"];
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("main").first()).toBeVisible();
        await expect(page.getByText("화면을 불러오고 있습니다.", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: /Application error|Internal Server Error/ })).toHaveCount(0);
        await expectNoOverflow(page);
      }
    });
  }
  test("Doran primary and secondary actions have equal height and alignment", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/community");
    const refresh = page.getByRole("button", { name: "새로고침", exact: true });
    const write = page.getByRole("link", { name: "글쓰기", exact: true });
    await expect(refresh).toBeVisible();
    const a = await refresh.boundingBox(), b = await write.boundingBox();
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect(a!.height).toBeGreaterThanOrEqual(48);
    expect(a!.height).toBe(b!.height);
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
  });
  test("pastor-created visits are confirmed, duplicate dates are supported and members see them", async ({ page, browser }) => {
    await login(page, "admin");
    const visitDate = new Date().toISOString().slice(0, 10);
    const month = visitDate.slice(0, 7);
    const title = "브라우저검증 심방대상";
    for (let i = 0; i < 2; i++) {
      const response = await page.request.post("/api/admin/visits", { data: { visitDate, visitType: "personal", recipientName: title, preferredTime: `1${i}:00` } });
      expect(response.status()).toBe(201);
    }
    const context = await browser.newContext();
    try {
      const member = await context.newPage();
      await login(member);
      const response = await member.request.get(`/api/visits/calendar?month=${month}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      const entries = body.entries.filter((entry: { title: string }) => entry.title === title);
      expect(entries).toHaveLength(2);
      expect(entries.every((entry: { status: string }) => entry.status === "confirmed")).toBe(true);
      expect(JSON.stringify(body)).not.toContain("phoneCiphertext");
    } finally { await context.close(); }
  });
});
