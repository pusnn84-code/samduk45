import { randomUUID, createHash } from "node:crypto";
import postgres from "postgres";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { e2eAccounts } from "../fixtures/e2e-data";
import { seoulToday } from "../../src/features/pastoral/policy";
import { login, expectNoOverflow } from "./helpers";

test("administrator can revise a historical photo without member-creation privileges, retry upload and preserve legacy conversion", async ({ page }, info) => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Disposable CI database only");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (process.env.CI !== "true" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/prayer_e2e") throw new Error("LOCAL_TEST_DB_REQUIRED");
  const db = postgres(url.toString(), { ssl: "require", prepare: false, max: 1 });
  const id = randomUUID(), candidateRequest = randomUUID(), samId = randomUUID(), today = seoulToday();
  const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
  let createdRequest: string | null = null;
  try {
    const inserted = await db`insert into prayer_app.pastoral_requests(id,year,month,enabled) values(${candidateRequest},${Number(today.slice(0, 4))},${Number(today.slice(5, 7))},false) on conflict(year,month) do nothing returning id`;
    createdRequest = inserted[0]?.id ?? null;
    const [period] = await db`select id from prayer_app.pastoral_requests where year=${Number(today.slice(0, 4))} and month=${Number(today.slice(5, 7))}`;
    await db`insert into prayer_app.sams(id,name,leader_name) values(${samId},${"903-" + samId.slice(0, 8)},'과거담당검증')`;
    const first = await sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } }).png().toBuffer();
    const second = await sharp({ create: { width: 80, height: 60, channels: 3, background: "gray" } }).png().toBuffer();
    // A historical fixture, not a bypass of the new form-only member creation API.
    const files = [{ name: "원본사진.png", size: first.length, sha256: hash(first) }];
    await db`insert into prayer_app.pastoral_reports(id,request_id,sam_id,author_user_id,sam_name,village,leader_name,submitted_by,written_date,method,form,files,fingerprint,submitted_at)
      values(${id},${period.id},${samId},${e2eAccounts.admin.userId},'903-과거','903','과거담당검증',${e2eAccounts.admin.name},${today},'photo',null,${db.json(files)},${hash(id)},now())`;
    await db`insert into prayer_app.pastoral_report_chunks(report_id,slot,chunk_index,data) values(${id},0,0,${first})`;

    await login(page, "admin");
    expect((await page.request.get("/api/pastoral/compose")).status()).toBe(403);
    expect((await page.request.post("/api/pastoral/submit", { data: { id: randomUUID(), form: {} } })).status()).toBe(403);
    await page.goto(`/admin/pastoral-reports?id=${id}`);
    await expect(page.locator(".pastoral-detail")).toContainText("관리자 확인 완료");
    await page.getByRole("button", { name: "목양지 수정", exact: true }).click();
    await page.getByLabel("원본사진.png 유지", { exact: true }).uncheck();
    await page.getByLabel("새 첨부파일 추가", { exact: true }).setInputFiles({ name: "교체사진.png", mimeType: "image/png", buffer: second });
    await page.route("**/api/admin/pastoral/reports/*/edits/*/files/*/chunks/*", route => route.abort("failed"));
    await page.getByRole("button", { name: "수정 저장", exact: true }).click();
    await expect(page.locator(".pastoral-entry").getByRole("alert")).toBeVisible();
    expect(await (await page.request.get(`/api/pastoral/reports/${id}/files/0/chunks/0`)).body()).toEqual(first);
    await page.unroute("**/api/admin/pastoral/reports/*/edits/*/files/*/chunks/*");
    await page.getByRole("button", { name: "같은 수정으로 다시 시도", exact: true }).click();
    await expect(page.locator(".pastoral-detail").getByRole("button", { name: "교체사진.png 내려받기", exact: true })).toBeVisible();
    const image = page.getByRole("img", { name: "목양지 사진 1", exact: true });
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    expect(await (await page.request.get(`/api/pastoral/reports/${id}/files/0/chunks/0`)).body()).toEqual(second);

    await page.getByRole("button", { name: "목양지 수정", exact: true }).click();
    await page.getByRole("radio", { name: "직접 입력", exact: true }).check();
    await page.getByLabel("이번 기간 샘모임 없음", { exact: true }).check();
    await page.getByRole("button", { name: "수정 저장", exact: true }).click();
    expect(await page.getByLabel("샘모임을 하지 못한 이유", { exact: true }).evaluate((element: HTMLTextAreaElement) => element.validity.valueMissing)).toBe(true);
    expect((await (await page.request.get(`/api/pastoral/reports/${id}`)).json()).report.version).toBe(1);
    await page.getByLabel("샘모임을 하지 못한 이유", { exact: true }).fill("가상 사유");
    await page.getByLabel("기타", { exact: true }).fill("과거 목양지 변환 확인");
    await page.setViewportSize({ width: 360, height: 900 }); await expectNoOverflow(page);
    await page.screenshot({ path: info.outputPath("pastoral-legacy-revision-editor-360.png"), fullPage: true });
    await page.getByRole("button", { name: "수정 저장", exact: true }).click();
    await expect(page.locator(".pastoral-detail")).toContainText("과거 목양지 변환 확인");
    const converted = (await (await page.request.get(`/api/pastoral/reports/${id}`)).json()).report;
    expect(converted.method).toBe("form"); expect(converted.files).toEqual([]); expect(converted.version).toBe(2);
    expect(converted.authorId).toBe(e2eAccounts.admin.userId);
    expect((await page.request.get(`/api/pastoral/reports/${id}/files/0/image`)).status()).toBe(415);
  } finally {
    await db`delete from prayer_app.pastoral_reports where id=${id}`;
    await db`delete from prayer_app.sams where id=${samId}`;
    if (createdRequest) await db`delete from prayer_app.pastoral_requests where id=${createdRequest}`;
    await db.end();
  }
});
