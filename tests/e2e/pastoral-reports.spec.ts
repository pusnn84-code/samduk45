import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import sharp from "sharp";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { hashPhonePassword, normalizeName, phoneLookupHash } from "../../src/features/auth/crypto";
import { encryptRosterPhone } from "../../src/features/roster/crypto";
import { seoulToday, type MemberSubmission } from "../../src/features/pastoral/policy";
import { login, expectNoOverflow } from "./helpers";

// These tests must never run against the user's Supabase project.
test.describe("private pastoral reports", () => {
  test.describe.configure({ mode: "default" });
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable local CI database");
  let db: ReturnType<typeof postgres>;
  const ids = { leader: randomUUID(), head: randomUUID(), outsider: randomUUID(), sam: randomUUID(), otherSam: randomUUID(), foreignSam: randomUUID() };
  const accounts = {
    leader: { name: "목양리더검증", phone: "01000000711", rosterId: randomUUID(), userId: ids.leader },
    head: { name: "목양마을장검증", phone: "01000000712", rosterId: randomUUID(), userId: ids.head },
    outsider: { name: "목양타마을검증", phone: "01000000713", rosterId: randomUUID(), userId: ids.outsider },
  };
  const today = seoulToday(), year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  let requestId: string;
  const digest = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

  async function loginAs(page: Page, kind: keyof typeof accounts) {
    await page.goto("/login");
    await page.getByLabel("이름 (아이디)").fill(accounts[kind].name);
    await page.getByLabel("비밀번호", { exact: true }).fill(accounts[kind].phone);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "메뉴 선택", exact: true })).toBeVisible();
  }
  function input(): MemberSubmission {
    return { id: randomUUID(), form: {
      noMeeting: false, noMeetingReason: "", meetings: [{ when: today + " 19:30", place: "가상 모임장소", attendees: "가상가정" }],
      sharing: [], news: [], memberNotes: [{ rosterId: accounts.leader.rosterId, member: "조작된 표시명", sharing: "감사 나눔", prayer: "샘원 기도제목", news: "가상 소식" }],
      leaderPrayer: "리더 기도제목", other: "기타 검증 내용",
    } };
  }
  async function submitted(api: APIRequestContext, value = input()) {
    const response = await api.post("/api/pastoral/submit", { data: value });
    expect(response.status()).toBe(201);
    expect(await response.json()).toEqual({ id: value.id, submitted: true });
    return value;
  }
  async function fillMeeting(page: Page) {
    await page.getByLabel("샘모임 날짜", { exact: true }).fill(today);
    await page.getByLabel("샘모임 시간", { exact: true }).fill("19:30");
    await page.getByLabel("샘모임 장소", { exact: true }).fill("검증 장소");
    await page.getByLabel("샘모임 참석자", { exact: true }).fill("가상가정");
  }
  async function openHistory(page: Page) {
    const history = page.locator(".pastoral-history");
    await page.getByText("내가 제출한 목양지 보기", { exact: true }).click();
    return history;
  }
  function editInput(version = 0) {
    return { id: randomUUID(), expectedVersion: version, method: "form", writtenDate: today, form: { ...input().form, other: "정정된 기타" }, keepSlots: [], files: [] };
  }
  // Historical attachments remain supported for review/editing. New member creation is form-only.
  async function legacyReport(method: "photo" | "file", files: { name: string; data: Buffer }[]) {
    const id = randomUUID();
    const metadata = files.map(file => ({ name: file.name, size: file.data.length, sha256: digest(file.data) }));
    await db`insert into prayer_app.pastoral_reports(id,request_id,sam_id,author_user_id,sam_name,village,leader_name,submitted_by,written_date,method,form,files,fingerprint,submitted_at)
      values(${id},${requestId},${ids.sam},${ids.leader},'901-1','901',${accounts.leader.name},${accounts.leader.name},${today},${method},null,${db.json(metadata)},${digest(id)},now())`;
    for (let slot = 0; slot < files.length; slot++) for (let offset = 0, index = 0; offset < files[slot].data.length; offset += 524288, index++) {
      await db`insert into prayer_app.pastoral_report_chunks(report_id,slot,chunk_index,data) values(${id},${slot},${index},${files[slot].data.subarray(offset, offset + 524288)})`;
    }
    return { id, files: metadata };
  }

  test.beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (process.env.CI !== "true" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/prayer_e2e") throw new Error("PASTORAL_TESTS_REQUIRE_DISPOSABLE_LOCAL_DB");
    db = postgres(url.toString(), { ssl: "require", prepare: false, max: 1 });
    await db`insert into prayer_app.sams(id,name,leader_name) values(${ids.sam},'901-1',${accounts.leader.name}),(${ids.otherSam},'901-2','직접지정검증'),(${ids.foreignSam},'902-1',${accounts.outsider.name})`;
    for (const [kind, account] of Object.entries(accounts)) {
      const village = kind === "outsider" ? "902" : "901", sam = kind === "head" ? "2" : "1";
      await db`insert into prayer_app.member_roster(id,source_name,canonical_name,phone_lookup_hash,phone_ciphertext,village,sam,sam_label,source) values(${account.rosterId},${account.name},${account.name},${phoneLookupHash(account.phone)},${encryptRosterPhone(account.phone)},${village},${sam},${village + "-" + sam},'manual')`;
      await db`insert into prayer_app.users(id,roster_id,display_name,normalized_name,phone_lookup_hash,phone_password_hash,role) values(${account.userId},${account.rosterId},${account.name},${normalizeName(account.name)},${phoneLookupHash(account.phone)},${await hashPhonePassword(account.phone)},'member')`;
    }
  });
  test.beforeEach(async () => {
    await db`update prayer_app.sams set leader_roster_id=${accounts.leader.rosterId},leader_binding_locked=true,is_active=true where id=${ids.sam}`;
    await db`update prayer_app.sams set leader_roster_id=${accounts.outsider.rosterId},leader_binding_locked=true,is_active=true where id=${ids.foreignSam}`;
    await db`delete from prayer_app.pastoral_reports`;
    await db`delete from prayer_app.pastoral_requests`;
    await db`delete from prayer_app.village_leaders`;
    await db`delete from prayer_app.pastoral_schedule_versions`;
    requestId = randomUUID();
    await db`insert into prayer_app.pastoral_requests(id,year,month,enabled) values(${requestId},${year},${month},false)`;
    await db`insert into prayer_app.village_leaders(name,village,leader_name,leader_roster_id,leader_binding_locked) values('901마을장','901',${accounts.head.name},${accounts.head.rosterId},true)`;
  });
  test.afterAll(async () => {
    if (!db) return;
    try {
      await db`delete from prayer_app.pastoral_reports`;
      await db`delete from prayer_app.pastoral_requests`;
      await db`delete from prayer_app.village_leaders`;
      await db`delete from prayer_app.pastoral_schedule_versions`;
      for (const account of Object.values(accounts)) {
        await db`delete from prayer_app.users where id=${account.userId}`;
        await db`delete from prayer_app.member_roster where id=${account.rosterId}`;
      }
      for (const id of [ids.sam, ids.otherSam, ids.foreignSam]) await db`delete from prayer_app.sams where id=${id}`;
    } finally { await db.end(); }
  });

  test("ordinary members cannot open the composer or invoke member/admin report handlers", async ({ page, request }) => {
    await login(page);
    await expect(page.getByRole("link", { name: /목양지/ })).toHaveCount(0);
    for (const path of ["/api/pastoral/compose", "/api/pastoral/reports", `/api/pastoral/sams/${ids.sam}/members`, `/api/pastoral/reports/${randomUUID()}`, `/api/pastoral/reports/${randomUUID()}/txt`, `/api/pastoral/reports/${randomUUID()}/files/0/image`, `/api/pastoral/reports/${randomUUID()}/files/0/chunks/0`]) {
      expect((await request.get(path)).status()).toBe(401);
      expect((await page.request.get(path)).status()).toBe(403);
    }
    for (const path of ["schedule", "reports", "overview"]) {
      expect((await request.get(`/api/admin/pastoral/${path}`)).status()).toBe(403);
      expect((await page.request.get(`/api/admin/pastoral/${path}`)).status()).toBe(403);
    }
    expect((await request.post("/api/pastoral/submit", { data: input() })).status()).toBe(401);
    expect((await page.request.post("/api/pastoral/submit", { data: input() })).status()).toBe(403);
    await page.goto("/pastoral-reports"); await expect(page).toHaveURL(/\/$/);
  });

  test("only an actual own-SAM binding grants member composition; administrator and village-head roles do not bypass it", async ({ page, browser }) => {
    await loginAs(page, "leader");
    const compose = await page.request.get("/api/pastoral/compose");
    expect(compose.status()).toBe(200);
    const context = await compose.json();
    expect(context.sam.id).toBe(ids.sam); expect(context.authorName).toBe(accounts.leader.name); expect(context.today).toBe(today);
    const roster = await page.request.get(`/api/pastoral/sams/${ids.sam}/members`);
    expect(await roster.json()).toEqual({ members: [{ rosterId: accounts.leader.rosterId, member: accounts.leader.name }] });
    expect((await page.request.get(`/api/pastoral/sams/${ids.foreignSam}/members`)).status()).toBe(403);
    const forged = input(); forged.form.memberNotes![0].rosterId = accounts.outsider.rosterId;
    expect((await page.request.post("/api/pastoral/submit", { data: forged })).status()).toBe(409);
    const ctx = await browser.newContext(), other = await ctx.newPage();
    try {
      for (const kind of ["head", "admin"] as const) {
        if (kind === "head") await loginAs(other, kind); else { await other.request.post("/api/auth/logout"); await login(other, kind); }
        await expect(other.getByRole("link", { name: /목양지/ })).toHaveCount(0);
        expect((await other.request.get("/api/pastoral/compose")).status()).toBe(403);
        expect((await other.request.post("/api/pastoral/submit", { data: input() })).status()).toBe(403);
      }
      expect((await other.request.get("/api/admin/pastoral/reports")).status()).toBe(200);
    } finally { await ctx.close(); }
  });

  test("typed form records server-owned identity/date/method without enabling monthly reminders", async ({ page, browser }) => {
    await loginAs(page, "leader"); await page.setViewportSize({ width: 360, height: 900 }); await page.goto("/pastoral-reports");
    await expect(page.getByRole("radio")).toHaveCount(0); await expect(page.getByLabel("작성일", { exact: true })).toHaveCount(0);
    await expect(page.locator('input[type="file"], select')).toHaveCount(0);
    await fillMeeting(page);
    await page.getByLabel(`${accounts.leader.name} 나눔`, { exact: true }).fill("나눔 검증 내용");
    await page.getByLabel(`${accounts.leader.name} 기도제목`, { exact: true }).fill("샘원 기도제목");
    await page.getByLabel(`${accounts.leader.name} 소식`, { exact: true }).fill("가상 소식");
    await page.getByLabel("샘리더 기도제목", { exact: true }).fill("리더 기도제목");
    await page.getByLabel("기타", { exact: true }).fill("기타 검증 내용");
    await expectNoOverflow(page); await page.screenshot({ path: test.info().outputPath("pastoral-entry-360.png"), fullPage: true });
    const response = page.waitForResponse(res => new URL(res.url()).pathname === "/api/pastoral/submit" && res.status() === 201);
    await page.getByRole("button", { name: "목양지 제출", exact: true }).click();
    const result = await (await response).json();
    await expect(page.locator(".pastoral-detail")).toContainText("나눔 검증 내용");
    const stored = await db`select written_date::text,method,author_user_id,submitted_by,form from prayer_app.pastoral_reports where id=${result.id}`;
    expect(stored[0]).toMatchObject({ written_date: today, method: "form", author_user_id: ids.leader, submitted_by: accounts.leader.name });
    expect(stored[0].form.memberNotes[0].member).toBe(accounts.leader.name);
    expect((await (await page.request.get("/api/pastoral/status")).json()).count).toBe(0);
    expect((await db`select enabled from prayer_app.pastoral_requests where id=${requestId}`)[0].enabled).toBe(false);
    expect((await db`select count(*)::int as n from prayer_app.pastoral_schedule_versions`)[0].n).toBe(0);
    const ctx = await browser.newContext(), admin = await ctx.newPage();
    try {
      await login(admin, "admin");
      const txt = await admin.request.get(`/api/pastoral/reports/${result.id}/txt`);
      expect(txt.status()).toBe(200); expect(txt.headers()["content-disposition"]).toContain("attachment"); expect(txt.headers()["cache-control"]).toContain("no-store");
      const text = await txt.text();
      for (const content of ["19:30", "검증 장소", "가상가정", "나눔 검증 내용", "샘원 기도제목", "가상 소식", "리더 기도제목", "기타 검증 내용"]) expect(text).toContain(content);
      await admin.goto(`/admin/pastoral-reports?id=${result.id}`);
      await expect(admin.locator(".pastoral-detail")).toContainText("기타 검증 내용");
    } finally { await ctx.close(); }
  });

  test("new submissions need one complete meeting and reject forged server fields and retired draft creation", async ({ page }) => {
    await loginAs(page, "leader");
    for (const field of ["samId", "requestId", "submittedBy", "authorId", "writtenDate", "method", "files"]) {
      expect((await page.request.post("/api/pastoral/submit", { data: { ...input(), [field]: "forged" } })).status()).toBe(400);
    }
    for (const form of [{ meetings: [] }, { noMeeting: true, noMeetingReason: "가상 사유" }, { meetings: [{ when: today, place: "장소", attendees: "참석자" }] }, { meetings: [{ when: today + " 12:00", place: "", attendees: "참석자" }] }]) {
      expect((await page.request.post("/api/pastoral/submit", { data: { id: randomUUID(), form } })).status()).toBe(400);
    }
    expect((await page.request.post("/api/pastoral/reports", { data: input() })).status()).toBe(409);
    const value = await submitted(page.request);
    const detail = (await (await page.request.get(`/api/pastoral/reports/${value.id}`)).json()).report;
    expect(detail.submittedBy).toBe(accounts.leader.name); expect(detail.form.memberNotes[0].member).toBe(accounts.leader.name);
  });

  test("the same submit ID retries atomically and different content cannot replace it", async ({ page }) => {
    await loginAs(page, "leader");
    const value = await submitted(page.request); await submitted(page.request, value);
    expect((await (await page.request.get("/api/pastoral/reports")).json()).total).toBe(1);
    expect((await page.request.post("/api/pastoral/submit", { data: { ...value, form: { ...value.form, other: "다른 내용" } } })).status()).toBe(409);
  });

  test("lost submit response retries the frozen ID without duplicate creation", async ({ page }) => {
    await loginAs(page, "leader"); await page.goto("/pastoral-reports"); await fillMeeting(page);
    await page.getByLabel("샘리더 기도제목", { exact: true }).fill("통신 재시도 검증");
    await page.route("**/api/pastoral/submit", async route => { const response = await route.fetch(); expect(response.status()).toBe(201); await route.abort("failed"); });
    await page.getByRole("button", { name: "목양지 제출", exact: true }).click();
    await expect(page.locator(".pastoral-entry").getByRole("alert")).toBeVisible();
    await page.unroute("**/api/pastoral/submit"); await page.getByRole("button", { name: "같은 내용으로 다시 시도", exact: true }).click();
    await expect(page.locator(".pastoral-detail")).toContainText("통신 재시도 검증");
    expect((await (await page.request.get("/api/pastoral/reports")).json()).total).toBe(1);
  });

  test("viewing old history preserves unsent content and a lost-response retry ID", async ({ page }) => {
    await loginAs(page, "leader"); await submitted(page.request);
    await page.goto("/pastoral-reports"); await fillMeeting(page);
    const prayer = page.getByLabel("샘리더 기도제목", { exact: true });
    await prayer.fill("보관할 새 원고");
    const history = await openHistory(page);
    await history.getByRole("button", { name: /목양지 보기/ }).first().click();
    await expect(page.locator(".pastoral-detail")).toContainText("기타 검증 내용");
    await page.getByRole("button", { name: "목록으로", exact: true }).click();
    await expect(prayer).toHaveValue("보관할 새 원고");
    await page.route("**/api/pastoral/submit", async route => { const response = await route.fetch(); expect(response.status()).toBe(201); await route.abort("failed"); });
    await page.getByRole("button", { name: "목양지 제출", exact: true }).click();
    await expect(page.locator(".pastoral-entry").getByRole("alert")).toBeVisible();
    await history.getByRole("button", { name: /목양지 보기/ }).first().click();
    await page.getByRole("button", { name: "목록으로", exact: true }).click();
    await expect(prayer).toHaveValue("보관할 새 원고"); await expect(prayer).toBeDisabled();
    await page.unroute("**/api/pastoral/submit");
    await page.getByRole("button", { name: "같은 내용으로 다시 시도", exact: true }).click();
    await expect(page.locator(".pastoral-detail")).toContainText("보관할 새 원고");
    expect((await (await page.request.get("/api/pastoral/reports")).json()).total).toBe(2);
  });

  test("a missing current period is created disabled and cancelled periods never block new form submission", async ({ page }) => {
    await loginAs(page, "leader");
    await db`delete from prayer_app.pastoral_requests where id=${requestId}`;
    await submitted(page.request);
    const periods = await db`select id,enabled from prayer_app.pastoral_requests where year=${year} and month=${month}`;
    expect(periods).toHaveLength(1); expect(periods[0].enabled).toBe(false); requestId = periods[0].id;
    await submitted(page.request);
    expect((await (await page.request.get("/api/pastoral/reports")).json()).total).toBe(2);
    expect((await (await page.request.get("/api/pastoral/status")).json()).count).toBe(0);
  });

  test("outsider leaders cannot read another author's details, TXT, photos or chunks", async ({ page, browser, request }) => {
    const image = await sharp({ create: { width: 64, height: 80, channels: 3, background: "white" } }).png().toBuffer();
    const value = await legacyReport("photo", [{ name: "과거목양지.png", data: image }]);
    await loginAs(page, "leader");
    const preview = await page.request.get(`/api/pastoral/reports/${value.id}/files/0/image`);
    expect(preview.status()).toBe(200); expect(preview.headers()["content-type"]).toBe("image/webp");
    const ctx = await browser.newContext(), outsider = await ctx.newPage();
    try {
      await loginAs(outsider, "outsider");
      for (const suffix of ["", "/txt", "/files/0/image", "/files/0/chunks/0"]) {
        expect((await outsider.request.get(`/api/pastoral/reports/${value.id}${suffix}`)).status()).toBe(404);
        expect((await request.get(`/api/pastoral/reports/${value.id}${suffix}`)).status()).toBe(401);
      }
    } finally { await ctx.close(); }
  });

  test("cross-site submissions and persisted leader revocation fail closed", async ({ page }) => {
    await loginAs(page, "leader"); const value = await submitted(page.request);
    expect((await page.request.post("/api/pastoral/submit", { headers: { origin: "https://other.example" }, data: input() })).status()).toBe(403);
    await db`update prayer_app.sams set leader_roster_id=null where id=${ids.sam}`;
    expect((await (await page.request.get("/api/pastoral/status")).json()).visible).toBe(false);
    expect((await page.request.get("/api/pastoral/compose")).status()).toBe(403);
    expect((await page.request.post("/api/pastoral/submit", { data: input() })).status()).toBe(403);
    expect((await page.request.get(`/api/pastoral/reports/${value.id}`)).status()).toBe(403);
  });

  test("own history receives admin review and becomes unreviewed again after revision", async ({ page, browser }, info) => {
    await loginAs(page, "leader"); const value = await submitted(page.request);
    await page.clock.install(); await page.goto("/pastoral-reports");
    const history = await openHistory(page), receipt = history.getByText("접수 완료", { exact: true });
    await expect(history.locator("article")).toHaveCount(1); await expect(receipt).toHaveCount(0);
    const ctx = await browser.newContext(), admin = await ctx.newPage(), endpoint = `/api/admin/pastoral/reports/${value.id}/review`;
    try {
      await login(admin, "admin");
      await admin.route(`**${endpoint}`, route => route.fulfill({ status: 503, json: { code: "PASTORAL_UNAVAILABLE" } }));
      await admin.goto(`/admin/pastoral-reports?id=${value.id}`);
      await expect(admin.getByRole("button", { name: "확인 다시 저장", exact: true })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(receipt).toHaveCount(0);
      await admin.unroute(`**${endpoint}`); await admin.getByRole("button", { name: "확인 다시 저장", exact: true }).click();
      await expect(admin.locator(".pastoral-detail")).toContainText("관리자 확인 완료");
      await page.clock.runFor(30000); await expect(receipt).toBeVisible();
      for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page);
        const card = await history.locator("article").boundingBox(), badge = await receipt.boundingBox();
        expect(badge!.x + badge!.width / 2).toBeGreaterThan(card!.x + card!.width / 2);
        await history.screenshot({ path: info.outputPath(`pastoral-receipt-${width}.png`), animations: "disabled" });
      }
      const change = editInput();
      expect((await page.request.post(`/api/pastoral/reports/${value.id}/edits`, { data: change })).status()).toBe(201);
      expect((await page.request.post(`/api/pastoral/reports/${value.id}/edits/${change.id}/publish`)).status()).toBe(200);
      await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(receipt).toHaveCount(0);
      await admin.reload(); await expect(admin.locator(".pastoral-detail")).toContainText("관리자 확인 완료");
      await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(receipt).toBeVisible();
    } finally { await ctx.close(); }
  });

  test("owner edits and deletes submitted forms while administrator review stays available", async ({ page }) => {
    await loginAs(page, "leader"); const value = await submitted(page.request);
    await page.goto("/pastoral-reports"); const history = await openHistory(page);
    await history.getByRole("button", { name: /목양지 보기/ }).click();
    await page.getByRole("button", { name: "목양지 수정", exact: true }).click();
    const editor = page.getByRole("form", { name: "목양지 수정", exact: true });
    await expect(editor.getByLabel("작성일", { exact: true })).toHaveCount(0);
    await expect(editor.getByRole("radio")).toHaveCount(0);
    await expect(editor.getByRole("button", { name: /행 추가|행 제거/ })).toHaveCount(0);
    await editor.getByLabel("기타", { exact: true }).fill("수정한 기타 내용");
    await page.getByRole("button", { name: "수정 저장", exact: true }).click();
    await expect(page.locator(".pastoral-detail")).toContainText("수정한 기타 내용");
    const report = (await (await page.request.get(`/api/pastoral/reports/${value.id}`)).json()).report;
    expect(report.version).toBe(1); expect(report.submittedBy).toBe(accounts.leader.name); expect(report.writtenDate).toBe(today);
    page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "목양지 삭제", exact: true }).click();
    await expect.poll(async () => (await (await page.request.get("/api/pastoral/reports")).json()).total).toBe(0);
    expect((await (await page.request.get("/api/pastoral/status")).json()).count).toBe(0);
    expect((await page.request.get(`/api/pastoral/reports/${value.id}/txt`)).status()).toBe(404);
  });

  test("administrator edits another author's report without transferring authorship", async ({ page, browser }) => {
    await loginAs(page, "leader"); const value = await submitted(page.request);
    const ctx = await browser.newContext(), admin = await ctx.newPage();
    try {
      await login(admin, "admin"); await admin.goto(`/admin/pastoral-reports?id=${value.id}`);
      await expect(admin.locator(".pastoral-detail")).toContainText("관리자 확인 완료");
      await expect(admin.locator(".pastoral-meta")).not.toContainText("제출일시");
      await admin.getByRole("button", { name: "목양지 수정", exact: true }).click();
      await admin.getByLabel("기타", { exact: true }).fill("관리자 정정");
      await admin.getByRole("button", { name: "수정 저장", exact: true }).click();
      await expect(admin.locator(".pastoral-detail")).toContainText("관리자 정정");
      const report = (await (await page.request.get(`/api/pastoral/reports/${value.id}`)).json()).report;
      expect(report.authorId).toBe(ids.leader); expect(report.submittedBy).toBe(accounts.leader.name); expect(report.version).toBe(1);
      admin.once("dialog", dialog => dialog.accept()); await admin.getByRole("button", { name: "목양지 삭제", exact: true }).click();
      expect((await page.request.get(`/api/pastoral/reports/${value.id}`)).status()).toBe(404);
    } finally { await ctx.close(); }
  });

  test("legacy 6MiB revisions preserve old files until publish and support retain/replace/retry/cancel", async ({ page }) => {
    await loginAs(page, "leader");
    const old = Buffer.from("원본파일"), retained = Buffer.from("보존파일");
    const value = await legacyReport("file", [{ name: "원본.txt", data: old }, { name: "보존.txt", data: retained }]);
    const replacement = Buffer.alloc(6291456, 67);
    const change = { ...editInput(), method: "file", form: null, keepSlots: [1], files: [{ name: "교체.txt", size: replacement.length, sha256: digest(replacement) }] };
    const base = `/api/pastoral/reports/${value.id}/edits`;
    expect((await page.request.post(base, { data: change })).status()).toBe(201);
    expect((await page.request.post(`${base}/${change.id}/publish`)).status()).toBe(409);
    expect(await (await page.request.get(`/api/pastoral/reports/${value.id}/files/0/chunks/0`)).body()).toEqual(old);
    for (let index = 0; index < 12; index++) expect((await page.request.put(`${base}/${change.id}/files/0/chunks/${index}`, { headers: { "content-type": "application/octet-stream" }, data: replacement.subarray(index * 524288, (index + 1) * 524288) })).status()).toBe(200);
    expect((await page.request.post(`${base}/${change.id}/publish`)).status()).toBe(200);
    expect((await page.request.post(`${base}/${change.id}/publish`)).status()).toBe(200);
    expect((await page.request.delete(`${base}/${change.id}`)).status()).toBe(409);
    const report = (await (await page.request.get(`/api/pastoral/reports/${value.id}`)).json()).report;
    expect(report.version).toBe(1); expect(report.files.map((file: { name: string }) => file.name)).toEqual(["보존.txt", "교체.txt"]);
    const parts: Buffer[] = [];
    for (let index = 0; index < 12; index++) parts.push(await (await page.request.get(`/api/pastoral/reports/${value.id}/files/1/chunks/${index}`)).body());
    expect(digest(Buffer.concat(parts))).toBe(digest(replacement));
    const cancelled = editInput(1);
    expect((await page.request.post(base, { data: cancelled })).status()).toBe(201);
    expect((await page.request.delete(`${base}/${cancelled.id}`)).status()).toBe(200);
    expect((await (await page.request.get(`/api/pastoral/reports/${value.id}`)).json()).report.version).toBe(1);
    expect((await db`select count(*)::int as n from prayer_app.pastoral_edit_chunks`)[0].n).toBe(0);
  });

  test("stale edits and deletes cannot overwrite and cancelled historic months remain editable", async ({ page }) => {
    await loginAs(page, "leader"); const value = await submitted(page.request), a = editInput(), b = editInput();
    const base = `/api/pastoral/reports/${value.id}/edits`;
    expect((await page.request.post(base, { data: a })).status()).toBe(201);
    expect((await page.request.post(base, { data: b })).status()).toBe(201);
    await db`update prayer_app.pastoral_requests set year=${year - 1},enabled=false where id=${requestId}`;
    expect((await page.request.post(`${base}/${a.id}/publish`)).status()).toBe(200);
    expect((await page.request.post(`${base}/${b.id}/publish`)).status()).toBe(409);
    expect((await page.request.delete(`/api/pastoral/reports/${value.id}/submission`, { data: { expectedVersion: 0 } })).status()).toBe(409);
    expect((await page.request.delete(`/api/pastoral/reports/${value.id}`)).status()).toBe(409);
    for (let retry = 0; retry < 2; retry++) expect((await page.request.delete(`/api/pastoral/reports/${value.id}/submission`, { data: { expectedVersion: 1 } })).status()).toBe(200);
    expect((await db`select count(*)::int as n from prayer_app.pastoral_report_edits`)[0].n).toBe(0);
  });

  test("revision/deletion enforce owner, administrator, session and origin boundaries", async ({ page, browser, request }) => {
    await loginAs(page, "leader"); const value = await submitted(page.request), change = editInput();
    const paths = [`/api/pastoral/reports/${value.id}/edits`, `/api/admin/pastoral/reports/${value.id}/edits`];
    const ctx = await browser.newContext(), outsider = await ctx.newPage();
    try {
      await loginAs(outsider, "outsider");
      for (const path of paths) {
        expect((await outsider.request.post(path, { data: change })).status()).toBe(403);
        expect((await request.post(path, { data: change })).status()).toBe(path.includes("/admin/") ? 403 : 401);
      }
      expect((await outsider.request.delete(`/api/pastoral/reports/${value.id}/submission`, { data: { expectedVersion: 0 } })).status()).toBe(403);
      expect((await page.request.post(paths[0], { headers: { origin: "https://evil.example" }, data: change })).status()).toBe(403);
      expect((await page.request.delete(`/api/pastoral/reports/${value.id}/submission`, { headers: { origin: "https://evil.example" }, data: { expectedVersion: 0 } })).status()).toBe(403);
      await outsider.request.post("/api/auth/logout"); await login(outsider, "admin");
      expect((await outsider.request.post(paths[0], { data: change })).status()).toBe(403);
      expect((await outsider.request.post(paths[1], { data: change })).status()).toBe(201);
    } finally { await ctx.close(); }
  });

  test("revision response loss is idempotent and preserves retired JSON fields", async ({ page }) => {
    await loginAs(page, "leader"); const value = await submitted(page.request);
    await db`update prayer_app.pastoral_reports set form=form || ${db.json({ visits: [{ reason: "과거 기록 보존" }] })}::jsonb where id=${value.id}`;
    await page.goto("/pastoral-reports"); const history = await openHistory(page);
    await history.getByRole("button", { name: /목양지 보기/ }).click();
    await expect(page.locator(".pastoral-detail")).not.toContainText("과거 기록 보존");
    await page.getByRole("button", { name: "목양지 수정", exact: true }).click();
    await page.getByRole("form", { name: "목양지 수정", exact: true }).getByLabel("기타", { exact: true }).fill("응답유실검증");
    await page.route("**/api/pastoral/reports/*/edits/*/publish", async route => { const response = await route.fetch(); expect(response.ok()).toBe(true); await route.abort("failed"); });
    await page.getByRole("button", { name: "수정 저장", exact: true }).click(); await expect(page.locator(".pastoral-entry").getByRole("alert")).toBeVisible();
    await page.unroute("**/api/pastoral/reports/*/edits/*/publish"); await page.getByRole("button", { name: "같은 수정으로 다시 시도", exact: true }).click();
    await expect(page.locator(".pastoral-detail")).toContainText("응답유실검증");
    const stored = await db`select version,form from prayer_app.pastoral_reports where id=${value.id}`;
    expect(stored[0].version).toBe(1); expect(stored[0].form.visits[0].reason).toBe("과거 기록 보존");
  });

  test("admin monthly schedule remains explicit and stale-save protected; disabling it preserves received reports", async ({ page, browser }) => {
    const ctx = await browser.newContext(), leader = await ctx.newPage();
    try {
      await loginAs(leader, "leader"); const value = await submitted(leader.request);
      await login(page, "admin");
      const prior = await (await page.request.get(`/api/admin/pastoral/schedule?year=${year}`)).json();
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year, expectedVersion: prior.version, selected: [{ month }] } })).status()).toBe(200);
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year, expectedVersion: prior.version, selected: [] } })).status()).toBe(409);
      const current = await (await page.request.get(`/api/admin/pastoral/schedule?year=${year}`)).json();
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year, expectedVersion: current.version, selected: [] } })).status()).toBe(200);
      expect((await page.request.get(`/api/pastoral/reports/${value.id}`)).status()).toBe(200);
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year: year + 1, expectedVersion: 0, selected: [{ month: 1 }] } })).status()).toBe(200);
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year: year + 2, expectedVersion: 0, selected: [] } })).status()).toBe(400);
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year, expectedVersion: current.version + 1, selected: [{ month, week: 1 }] } })).status()).toBe(400);
    } finally { await ctx.close(); }
  });

  for (const method of ["photo", "file"] as const) test(`legacy ${method} remains private and administrator can download the original`, async ({ page }) => {
    const bytes = method === "photo" ? await sharp({ create: { width: 64, height: 80, channels: 3, background: "white" } }).png().toBuffer() : Buffer.from("가상 과거 목양지", "utf8");
    const filename = method === "photo" ? "과거사진.png" : "과거파일.txt";
    const value = await legacyReport(method, [{ name: filename, data: bytes }]);
    await login(page, "admin"); await page.goto(`/admin/pastoral-reports?id=${value.id}`);
    if (method === "photo") {
      const image = page.getByRole("img", { name: "목양지 사진 1", exact: true });
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
    await expectNoOverflow(page);
    const waiting = page.waitForEvent("download"); await page.getByRole("button", { name: `${filename} 내려받기`, exact: true }).click();
    const download = await waiting; expect(download.suggestedFilename()).toBe(filename);
    const path = await download.path(); expect(path).not.toBeNull(); expect(digest(await readFile(path!))).toBe(digest(bytes));
  });

  test("forged legacy raster content is never rendered as an image", async ({ page }) => {
    const value = await legacyReport("photo", [{ name: "fake.png", data: Buffer.from('<svg onload="alert(1)"></svg>') }]);
    await loginAs(page, "leader");
    expect((await page.request.get(`/api/pastoral/reports/${value.id}/files/0/image`)).status()).toBe(415);
  });

  test("pastoral tables and village leader directory deny direct public database privileges", async () => {
    const data = await db`select tablename,rowsecurity,has_table_privilege('anon','prayer_app.'||tablename,'select,insert,update,delete') as anon_access,has_table_privilege('authenticated','prayer_app.'||tablename,'select,insert,update,delete') as auth_access from pg_tables where schemaname='prayer_app' and (tablename like 'pastoral_%' or tablename='village_leaders')`;
    expect(data).toHaveLength(7);
    for (const row of data) { expect(row.rowsecurity).toBe(true); expect(row.anon_access).toBe(false); expect(row.auth_access).toBe(false); }
  });
});
