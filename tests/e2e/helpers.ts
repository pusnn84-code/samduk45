import { expect, type Page } from "@playwright/test";
import { e2eAccounts } from "../fixtures/e2e-data";

export async function login(page: Page, role: keyof typeof e2eAccounts = "member") {
  return loginIdentity(page, e2eAccounts[role]);
}

// Exercise the real first-use gate rather than bypassing password setup in DB.
export async function loginIdentity(page: Page, account: { name: string; phone: string }) {
  const pin = account.phone.slice(-6);
  await page.goto("/login");
  const switchAccount = page.getByRole("button", { name: "다른 계정으로 로그인", exact: true });
  if (await switchAccount.isVisible()) await switchAccount.click();
  await page.getByLabel("이름 (아이디)").fill(account.name);
  await page.getByLabel("비밀번호", { exact: true }).fill(pin);
  const response = page.waitForResponse(r => r.url().endsWith("/api/auth/login") && r.request().method() === "POST");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  if ((await response).status() === 401) {
    await page.getByLabel("비밀번호", { exact: true }).fill(account.phone);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/(?:set-password)?$/);
  if (new URL(page.url()).pathname === "/set-password") {
    await page.getByLabel("새 6자리 번호", { exact: true }).fill(pin);
    await page.getByLabel("6자리 번호 확인", { exact: true }).fill(pin);
  }
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "메뉴 선택", exact: true })).toBeVisible();
  // Do not let an unauthenticated API client make role-denial tests pass falsely.
  expect((await page.request.get("/api/checkins")).status()).toBe(200);
}

export async function expectNoOverflow(page: Page) {
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflowing).toBe(false);
}
